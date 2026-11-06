"use client";

// The studio selects a tracked story box or a 360° view; capability errors never change that choice.
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorldExperience } from "@/lib/scan-actions";
import { ArrowLeft, Compass, Hand, LoaderCircle, Orbit, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { EIGHTH_WALL_CREDIT, EIGHTH_WALL_LICENSE_URL, isTouchPhone, loadEighthWall, startEighthWallSession } from "@/ar/eighth-wall-session";
import type { RoomSession } from "@/ar/room-controls";
import { canPlaceRoom, startRoomSession, type RoomState } from "@/ar/room-session";
import { disposeRoom, loadStoryRoom, ROOM, updateStoryRoom } from "@/ar/story-room";
import { cn } from "@/lib/utils";
import { usePageSounds, type SoundLayer } from "@/lib/page-sound";
import { requestStoryMotion, storyMotionReady } from "@/lib/story-motion";
import type { WorldEffect } from "@/lib/world-effects";

export type World = { url: string; effect: WorldEffect; title: string; bookTitle: string; color: string; narrationUrl: string | null; sounds: SoundLayer[] };
type Phase = "camera" | "loading" | "inside";

const glass = "bg-black/35 text-white ring-1 ring-white/15 backdrop-blur-md";
const primaryButton = "mt-8 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-base font-bold text-ink-950 transition active:scale-[0.98] disabled:opacity-70";
const FOV = { min: 35, max: 90, start: 72 };

// The phone's orientation as a camera rotation (the maths of three.js's old DeviceOrientationControls).
const zee = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90° round X: from "screen up" to "looking ahead"

function deviceQuaternion(target: THREE.Quaternion, alpha: number, beta: number, gamma: number, screen: number) {
  euler.set(beta, alpha, -gamma, "YXZ");
  target.setFromEuler(euler);
  target.multiply(q1);
  target.multiply(q0.setFromAxisAngle(zee, -screen));
}

/** Starts the selected experience directly, without a placement or mode chooser. */
export function WorldViewer({
  world,
  backHref,
  experience,
  onExit,
}: {
  world: World;
  backHref: string;
  experience: WorldExperience;
  onExit?: () => void;
}) {
  const router = useRouter();
  const autoPlace = experience === "box";
  const container = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(autoPlace ? "camera" : "loading");
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"motion" | "drag">("drag");
  const [hint, setHint] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const audio = useRef<HTMLAudioElement>(null);
  // Walking into the room in AR: how this device can do it, and where a session is.
  const [placeWith, setPlaceWith] = useState<"webxr" | "eighthwall" | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const session = useRef<RoomSession | null>(null);
  const mounted = useRef(false);
  const cameraFailed = useRef(false);
  const cameraStarting = useRef(false);

  useEffect(() => {
    let alive = true;
    mounted.current = true;
    if (autoPlace) canPlaceRoom().then((webxr) => {
      if (!alive) return;
      if (webxr) setPlaceWith("webxr");
      else if (isTouchPhone()) {
        setPlaceWith("eighthwall");
        // Warm the engine while the camera starts.
        loadEighthWall().catch(() => {});
      } else {
        setRoomError("Open this page on a phone with camera and motion support to step inside the story box.");
      }
    }).catch(() => {
      if (alive) setRoomError("Camera tracking is unavailable. Open this page on a supported phone to step inside.");
    });
    return () => {
      alive = false;
      mounted.current = false;
      session.current?.end();
    };
  }, []);

  // Delay one task so React's development cleanup cancels an abandoned mount before opening a camera.
  useEffect(() => {
    if (!autoPlace || !placeWith) return;
    const timer = window.setTimeout(() => void placeRoom(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- launch once when the camera backend is known
  }, [autoPlace, placeWith]);

  async function placeRoom() {
    if (cameraStarting.current || session.current) return;
    cameraStarting.current = true;
    setRoomState("starting");
    setRoomError(null);
    cameraFailed.current = false;
    setPhase("camera");
    const onState = (state: RoomState) => {
      if (!mounted.current) return;
      setRoomState(state === "ended" ? null : state);
      if (state === "ended") {
        session.current = null;
        if (cameraFailed.current) return;
        // Closing the camera returns to the caller; it never opens a different experience.
        if (onExit) onExit();
        else router.push(backHref);
      }
    };
    try {
      if (placeWith === "eighthwall") {
        // iPhone only lets a page read the motion sensors after asking, from a tap: first thing.
        if (!(await storyMotionReady())) throw new Error("Allow motion access, then tap Try again to open the camera.");
        if (!mounted.current) return;
        session.current = await startEighthWallSession(world.url, world.effect, overlay.current!, stage.current!, onState, (message) => {
          if (!mounted.current) return;
          cameraFailed.current = true;
          setRoomError(message);
          setRoomState(null);
          session.current?.end();
        });
      } else {
        session.current = await startRoomSession(world.url, world.effect, overlay.current!, onState);
      }
      if (!mounted.current || cameraFailed.current) session.current?.end();
    } catch (error) {
      if (!mounted.current) return;
      setRoomState(null);
      setRoomError((error as Error).message || "AR couldn't start on this phone.");
    } finally {
      cameraStarting.current = false;
    }
  }
  // Shared with the render loop without re-creating the scene.
  const look = useRef({ yaw: 0, pitch: 0, fov: FOV.start, heading: null as number | null, motion: null as { alpha: number; beta: number; gamma: number } | null });

  const recenter = useCallback(() => {
    const state = look.current;
    state.yaw = 0;
    state.pitch = 0;
    // The way the phone points now becomes "ahead".
    state.heading = state.motion ? state.motion.alpha : null;
  }, []);

  // The scene is built once, when the child steps inside.
  const started = phase !== "camera";
  useEffect(() => {
    if (started && audio.current) {
      audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [started]);
  useEffect(() => {
    if (!started) return;
    const el = container.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Standing in the middle of the room, at eye height: the panorama all round, the rain in front.
    // Far enough to see the story's sky, drawn well beyond the box's walls.
    const camera = new THREE.PerspectiveCamera(FOV.start, el.clientWidth / el.clientHeight, 0.05, 200);
    camera.position.set(0, ROOM.eye, 0);

    let alive = true;
    let room: THREE.Group | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    loadStoryRoom(world.url, { effect: world.effect })
      .then((built) => {
        if (!alive) return disposeRoom(built.room);
        room = built.room;
        for (const map of new Set(collectMaps(built.room))) map.anisotropy = renderer.capabilities.getMaxAnisotropy();
        scene.add(room);
        if (built.clip) {
          mixer = new THREE.AnimationMixer(room);
          mixer.clipAction(built.clip).play();
        }
        setPhase("inside");
      })
      .catch(() => alive && setFailed(true));

    const state = look.current;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null || event.gamma === null) return;
      if (!state.motion) setMode("motion");
      state.motion = { alpha: event.alpha, beta: event.beta, gamma: event.gamma };
      // Whichever way the phone points when the world opens is "ahead".
      if (state.heading === null) state.heading = event.alpha;
    };
    window.addEventListener("deviceorientation", onOrientation);

    // Drag to look around (or to turn the world a little in motion mode); pinch or scroll to zoom.
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      setHint(false);
    };
    const move = (e: PointerEvent) => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const before = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [c, d] = [...pointers.values()];
        const after = Math.hypot(c!.x - d!.x, c!.y - d!.y);
        if (pinch && before) state.fov = THREE.MathUtils.clamp(state.fov * (before / after), FOV.min, FOV.max);
        pinch = after;
        return;
      }
      const speed = (state.fov / el.clientHeight) * (Math.PI / 180);
      state.yaw += (e.clientX - last.x) * speed;
      state.pitch = THREE.MathUtils.clamp(state.pitch + (e.clientY - last.y) * speed, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      state.fov = THREE.MathUtils.clamp(state.fov + e.deltaY * 0.03, FOV.min, FOV.max);
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", resize);

    const deviceView = new THREE.Quaternion();
    const turn = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    let frame = 0;
    let last = performance.now();
    const render = () => {
      frame = requestAnimationFrame(render);
      const now = performance.now();
      mixer?.update(Math.min((now - last) / 1000, 0.1));
      last = now;
      if (room) updateStoryRoom(room, camera);
      if (state.motion && state.heading !== null) {
        const toRad = THREE.MathUtils.degToRad;
        const screen = toRad(screenAngle());
        deviceQuaternion(deviceView, toRad(state.motion.alpha - state.heading), toRad(state.motion.beta), toRad(state.motion.gamma), screen);
        // A drag still turns the world sideways, on top of the phone's own motion.
        camera.quaternion.copy(turn.setFromAxisAngle(yAxis, state.yaw)).multiply(deviceView);
      } else {
        camera.rotation.set(state.pitch, state.yaw, 0, "YXZ");
      }
      if (camera.fov !== state.fov) {
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    };
    render();

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("resize", resize);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      mixer?.stopAllAction();
      if (room) disposeRoom(room);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [started, world.url, world.effect]);

  // The hint fades once the child has had a look round.
  useEffect(() => {
    if (phase !== "inside") return;
    const timer = setTimeout(() => setHint(false), 6000);
    return () => clearTimeout(timer);
  }, [phase]);

  // The world's own sounds play from the moment the child is inside, a little quieter under the voice.
  usePageSounds(phase === "inside" || roomState === "placed" ? world.sounds : null, { muted: !soundOn, ducked: playing });

  /** One switch for everything the world says and plays. */
  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    const el = audio.current;
    if (!el) return;
    if (next) el.play().then(() => setPlaying(true)).catch(() => {});
    else {
      el.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white select-none" style={{ "--accent": world.color } as CSSProperties}>
      <div ref={container} className="absolute inset-0 touch-none" />
      {world.narrationUrl && <audio ref={audio} src={world.narrationUrl} preload="none" onEnded={() => setPlaying(false)} />}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 safe-top">
        {onExit ? (
          <button onClick={onExit} className={cn("grid size-11 shrink-0 place-items-center rounded-full", glass)} aria-label="Leave the story world">
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <Link href={backHref} className={cn("grid size-11 shrink-0 place-items-center rounded-full", glass)} aria-label="Leave the story world">
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <div className={cn("min-w-0 rounded-full px-4 py-2 leading-tight", glass)}>
          <span className="block truncate text-[13px] font-semibold">{world.title}</span>
          <span className="block truncate text-[11px] text-white/60">{world.bookTitle}</span>
        </div>
        {phase === "inside" && (
          <div className="ml-auto flex gap-2">
            {(world.narrationUrl || world.sounds.length > 0) && (
              <button onClick={toggleSound} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label={soundOn ? "Turn the sound off" : "Turn the sound on"}>
                {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              </button>
            )}
            <button onClick={recenter} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label="Look ahead again">
              <Compass className="size-5" />
            </button>
          </div>
        )}
      </div>

      {phase === "camera" && !roomState && (
        <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
          {roomError ? (
            <div className="flex max-w-sm flex-col items-center">
              <p role="alert" className="text-white/80">{roomError}</p>
              {placeWith && <button onClick={() => { void requestStoryMotion(); void placeRoom(); }} className={primaryButton}>
                Try again
              </button>}
            </div>
          ) : (
            <div role="status" className="flex flex-col items-center gap-3">
              <LoaderCircle className="size-8 animate-spin" /> Starting the camera…
            </div>
          )}
        </div>
      )}

      {phase === "loading" && (
        <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center">
          {failed ? (
            <p className="text-white/80">This story world couldn&apos;t be loaded. Check your connection and try again.</p>
          ) : (
            <LoaderCircle className="size-8 animate-spin text-white/80" />
          )}
        </div>
      )}

      {/* Shown over the camera during the AR session (WebXR's DOM overlay). */}
      <div ref={overlay} className={cn("fixed inset-0 z-50 text-white", !roomState && "pointer-events-none")}>
        {/* The camera picture (8th Wall), below the controls. */}
        <div ref={stage} className="absolute inset-0" />
        {roomState && (
          <>
            <div className="absolute inset-x-0 top-0 flex justify-end px-4 safe-top">
              <button onClick={() => session.current?.end()} className={cn("pointer-events-auto grid size-11 place-items-center rounded-full", glass)} aria-label="Leave AR">
                <X className="size-5" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-6 pb-6 safe-bottom">
              <span className={cn("flex items-center gap-2 rounded-full px-4 py-2.5 text-center text-sm font-semibold", glass)}>
                {roomState === "starting" && <><LoaderCircle className="size-4 animate-spin" /> Starting the camera…</>}
                {roomState === "finding" && <><Hand className="size-4" /> Point your phone at the floor to find the ring</>}
                {roomState === "ready" && <><Hand className="size-4" /> Aim the ring where you want to enter</>}
                {roomState === "placed" && <><Hand className="size-4 shrink-0" /> You’re inside. Look around with your phone</>}
              </span>
              {roomState === "ready" && <button type="button" onClick={() => session.current?.placeAtMarker()} className="pointer-events-auto rounded-full bg-white px-5 py-3 text-sm font-bold text-ink-950 shadow-lift">Step in here</button>}
              {placeWith === "eighthwall" && <EighthWallCredit className="pointer-events-auto max-w-xs text-white/60 [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]" />}
            </div>
          </>
        )}
      </div>

      {phase === "inside" && hint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-6 pb-10 safe-bottom">
          <span className={cn("flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold", glass)}>
            {mode === "motion" ? <Orbit className="size-4" /> : <Hand className="size-4" />}
            {mode === "motion" ? "Turn around with your phone to look around" : "Drag to look around"}
          </span>
        </div>
      )}
    </div>
  );
}

/** The credit the 8th Wall engine's licence asks for wherever its world tracking is used. */
function EighthWallCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-center text-[10px] leading-snug text-white/40", className)}>
      {EIGHTH_WALL_CREDIT}{" "}
      <a href={EIGHTH_WALL_LICENSE_URL} target="_blank" rel="noreferrer" className="underline">
        License
      </a>
    </p>
  );
}

/** The room's pictures, to sharpen them when seen at a slant. */
function collectMaps(room: THREE.Object3D): THREE.Texture[] {
  const maps: THREE.Texture[] = [];
  room.traverse((object) => {
    const map = object instanceof THREE.Mesh ? (object.material as THREE.MeshBasicMaterial).map : null;
    if (map) maps.push(map);
  });
  return maps;
}

/** How the screen is turned, in degrees (0 upright, 90 or -90 sideways). */
function screenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation) return screen.orientation.angle;
  return Number((window as unknown as { orientation?: number }).orientation ?? 0);
}
