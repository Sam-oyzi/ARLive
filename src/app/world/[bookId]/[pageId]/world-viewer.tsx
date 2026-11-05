"use client";

// A page's story world, three ways, best first:
//   - Android (WebXR) and iPhone (the 8th Wall engine): find the floor, stand the story box there, and
//     walk into it, all inside the page; AR Quick Look (the box as a USDZ file) stays a second choice;
//   - anywhere: look around from the middle of the room, the view following the phone's motion
//     sensors (or a drag on a laptop), so the world stays still while the child turns round in it.
// All three show the same cube room with the same rain or snow playing in it.
import Link from "next/link";
import { ArrowLeft, Box, Compass, DoorOpen, Hand, LoaderCircle, Orbit, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import * as THREE from "three";
import { EIGHTH_WALL_CREDIT, EIGHTH_WALL_LICENSE_URL, isTouchPhone, loadEighthWall, startEighthWallSession } from "@/ar/eighth-wall-session";
import type { RoomSession } from "@/ar/room-controls";
import { canPlaceRoom, startRoomSession, type RoomState } from "@/ar/room-session";
import { disposeRoom, exportStoryRoomUsdz, loadStoryRoom, ROOM } from "@/ar/story-room";
import { cn } from "@/lib/utils";
import type { WorldEffect } from "@/lib/world-effects";

type World = { url: string; effect: WorldEffect; title: string; bookTitle: string; color: string; narrationUrl: string | null };
type Phase = "intro" | "loading" | "inside";

const glass = "bg-black/35 text-white ring-1 ring-white/15 backdrop-blur-md";
const primaryButton = "mt-8 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-base font-bold text-ink-950 transition active:scale-[0.98] disabled:opacity-70";
const secondButton = "mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-semibold ring-1 ring-white/15";
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

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export function WorldViewer({ world, backHref }: { world: World; backHref: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("intro");
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<"motion" | "drag">("drag");
  const [hint, setHint] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  // Walking into the room in AR: how this device can do it, and where a session is.
  const [placeWith, setPlaceWith] = useState<"webxr" | "eighthwall" | null>(null);
  const [quickLook, setQuickLook] = useState(false);
  const [usdz, setUsdz] = useState<string | "failed" | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const session = useRef<RoomSession | null>(null);

  useEffect(() => {
    let alive = true;
    setQuickLook(document.createElement("a").relList.supports("ar"));
    canPlaceRoom().then((webxr) => {
      if (!alive) return;
      if (webxr) setPlaceWith("webxr");
      else if (isTouchPhone()) {
        setPlaceWith("eighthwall");
        // Fetched while the child reads the screen, so the camera opens soon after the tap.
        loadEighthWall().catch(() => {});
      }
    });
    return () => {
      alive = false;
      session.current?.end();
    };
  }, []);

  // iPhone: build the room file before the tap, so Safari opens it straight away.
  useEffect(() => {
    if (!quickLook) return;
    let url: string | null = null;
    let alive = true;
    exportStoryRoomUsdz(world.url, world.effect)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (alive) setUsdz(url);
      })
      .catch(() => alive && setUsdz("failed"));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [quickLook, world.url, world.effect]);

  async function placeRoom() {
    setRoomError(null);
    const onState = (state: RoomState) => {
      setRoomState(state === "ended" ? null : state);
      if (state === "ended") session.current = null;
    };
    try {
      if (placeWith === "eighthwall") {
        // iPhone only lets a page read the motion sensors after asking, from a tap: first thing.
        const motion = (globalThis.DeviceMotionEvent as unknown as MotionPermission | undefined)?.requestPermission;
        const orientation = (globalThis.DeviceOrientationEvent as unknown as MotionPermission | undefined)?.requestPermission;
        const granted = await Promise.all([motion?.(), orientation?.()].map((asked) => asked?.catch(() => "denied")));
        if (granted.includes("denied")) throw new Error("The story box needs your phone's motion sensors. Allow them, then try again.");
        session.current = await startEighthWallSession(world.url, world.effect, overlay.current!, stage.current!, onState, (message) => {
          setRoomError(message);
          session.current?.end();
        });
      } else {
        session.current = await startRoomSession(world.url, world.effect, overlay.current!, onState);
      }
    } catch (error) {
      setRoomState(null);
      setRoomError((error as Error).message || "AR couldn't start on this phone.");
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

  async function enter() {
    // iPhone asks for motion access, and only from a tap. Elsewhere the sensors just start (or,
    // on a laptop, never send anything, and dragging stays the way to look round).
    const permission = (globalThis.DeviceOrientationEvent as unknown as MotionPermission | undefined)?.requestPermission;
    if (permission) await permission().catch(() => "denied");
    setPhase("loading");
    if (world.narrationUrl && audio.current) {
      audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  // The scene is built once, when the child steps inside.
  const started = phase !== "intro";
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
    const camera = new THREE.PerspectiveCamera(FOV.start, el.clientWidth / el.clientHeight, 0.05, 20);
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

  function toggleVoice() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) el.play().then(() => setPlaying(true)).catch(() => {});
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
        <Link href={backHref} className={cn("grid size-11 shrink-0 place-items-center rounded-full", glass)} aria-label="Leave the story world">
          <ArrowLeft className="size-5" />
        </Link>
        <div className={cn("min-w-0 rounded-full px-4 py-2 leading-tight", glass)}>
          <span className="block truncate text-[13px] font-semibold">{world.title}</span>
          <span className="block truncate text-[11px] text-white/60">{world.bookTitle}</span>
        </div>
        {phase === "inside" && (
          <div className="ml-auto flex gap-2">
            {world.narrationUrl && (
              <button onClick={toggleVoice} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label={playing ? "Stop the voice" : "Play the voice"}>
                {playing ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              </button>
            )}
            <button onClick={recenter} className={cn("grid size-11 place-items-center rounded-full", glass)} aria-label="Look ahead again">
              <Compass className="size-5" />
            </button>
          </div>
        )}
      </div>

      {phase === "intro" && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[radial-gradient(120%_80%_at_50%_30%,color-mix(in_oklab,var(--accent)_45%,black),black)] px-6">
          <div className="flex max-w-sm flex-col items-center text-center">
            <span className="grid size-20 place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
              <Orbit className="size-9" />
            </span>
            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">Step into the story</h1>
            <p className="mt-2 text-white/70">
              {placeWith ? (
                <>
                  Stand <span className="font-semibold text-white">{world.title}</span> in your room as a big story box, then walk
                  into it and look all around you.
                </>
              ) : (
                <>
                  You&apos;re about to go inside <span className="font-semibold text-white">{world.title}</span>. Hold your phone up and turn
                  around to look all over the story world.
                </>
              )}
            </p>
            {placeWith && (
              <button onClick={placeRoom} disabled={!!roomState} className={primaryButton}>
                <Box className="size-5" /> Place the story box in your space
              </button>
            )}
            {quickLook &&
              (usdz && usdz !== "failed" ? (
                // Safari's AR viewer needs a rel="ar" link whose only child is an image, and draws nothing
                // else inside it: the label lies over the link and lets taps through to it.
                <div className="relative w-full">
                  <a rel="ar" href={usdz} aria-label="Open the story box in AR Quick Look" className={cn(placeWith ? secondButton : primaryButton)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/ar-quick-look.svg" alt="" className="size-5 opacity-0" />
                  </a>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2",
                      placeWith ? "h-12 text-sm font-semibold text-white" : "h-14 text-base font-bold text-ink-950",
                    )}
                  >
                    <Box className="size-5" /> {placeWith ? "Open in AR Quick Look" : "Place the story box in your space"}
                  </span>
                </div>
              ) : usdz !== "failed" && !placeWith ? (
                <span role="status" className={cn(primaryButton, "bg-white/80")}>
                  <LoaderCircle className="size-5 animate-spin" /> Building the story box…
                </span>
              ) : null)}
            <button onClick={enter} className={placeWith || quickLook ? secondButton : primaryButton}>
              <Orbit className="size-5" /> {placeWith || quickLook ? "Look around here instead" : "Step inside"}
            </button>
            {roomError && <p className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-100">{roomError}</p>}
            <p className="mt-3 text-xs text-white/45">
              {placeWith ? "Your phone will use its camera to find the floor." : "Your phone may ask to use its motion sensors."} Nothing is recorded.
            </p>
            {placeWith === "eighthwall" && <EighthWallCredit className="mt-4" />}
          </div>
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
              {(roomState === "ready" || roomState === "placed") && (
                // Straight into the box, wherever the reader stands: no need to walk to it.
                <button onClick={() => session.current?.stepInside()} className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-ink-950 shadow-lg">
                  <DoorOpen className="size-4" /> Step inside
                </button>
              )}
              <span className={cn("flex items-center gap-2 rounded-full px-4 py-2.5 text-center text-sm font-semibold", glass)}>
                {roomState === "starting" && <><LoaderCircle className="size-4 animate-spin" /> Starting the camera…</>}
                {roomState === "finding" && <><Hand className="size-4" /> Move your phone slowly over the floor</>}
                {roomState === "ready" && <><Box className="size-4" /> Tap to put the story box here</>}
                {roomState === "placed" && <><Hand className="size-4 shrink-0" /> Walk in, or pinch with two fingers to resize the box</>}
              </span>
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
