// Walk into the story on an iPhone, without Quick Look: the 8th Wall engine (by Niantic Spatial) tracks
// the phone's camera and motion in the browser, the floor in front shows a ring, and a tap stands the
// story box there. The child then walks round it and into it, with its rain or snow playing.
// Android Chrome uses WebXR instead (room-session.ts), which is built in.
//
// The engine is a closed binary used under Niantic Spatial's XR Engine License Agreement, which asks
// for the credit shown during the session (EIGHTH_WALL_CREDIT).
import * as THREE from "three";
import type { WorldEffect } from "@/lib/world-effects";
import { automaticRoomEntry, pinchToResize, standAround, type RoomOptions, type RoomSession } from "./room-controls";
import type { RoomState } from "./room-session";
import { disposeRoom, loadStoryRoom, ROOM, updateStoryRoom } from "./story-room";

const ENGINE_URL = "https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1.0.0/dist/xr.js";
export const EIGHTH_WALL_LICENSE_URL = "https://github.com/8thwall/engine/blob/main/LICENSE";
export const EIGHTH_WALL_CREDIT =
  "World tracking by the 8th Wall engine, created by Niantic Spatial, Inc. © 2026 Niantic Spatial, Inc. All rights reserved. Used under the XR Engine License Agreement; provided “as is”, without warranties.";

/**
 * Where the phone is held when tracking starts, in metres. Only a first guess: the engine works in
 * real metres (absolute scale) and moves the camera to its measured height once it knows it.
 */
const PHONE_HEIGHT = 1.35;

// The few parts of the engine's API used here.
export type PipelineModule = {
  name: string;
  onStart?: (args: { canvas: HTMLCanvasElement }) => void;
  onUpdate?: (args: { processCpuResult?: { reality?: { trackingStatus?: string } } }) => void;
  onAttach?: (args: { videoWidth: number; videoHeight: number }) => void;
  onVideoSizeChange?: (args: { videoWidth: number; videoHeight: number }) => void;
  onCanvasSizeChange?: () => void;
  onDeviceOrientationChange?: () => void;
  onCameraStatusChange?: (args: { status: string }) => void;
  onException?: (error: unknown) => void;
};
type XR8 = {
  loadChunk: (chunk: string) => Promise<void>;
  addCameraPipelineModules: (modules: unknown[]) => void;
  clearCameraPipelineModules: () => void;
  run: (options: { canvas: HTMLCanvasElement }) => void;
  stop: () => void;
  GlTextureRenderer: { pipelineModule: () => unknown };
  Threejs: { pipelineModule: () => unknown; xrScene: () => { scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer } };
  XrController: {
    configure: (options: { scale?: "responsive" | "absolute" }) => void;
    pipelineModule: () => unknown;
    updateCameraProjectionMatrix: (options: { origin: THREE.Vector3; facing: THREE.Quaternion }) => void;
  };
  XrDevice: { isDeviceBrowserCompatible: (options: { allowedDevices: string }) => boolean };
  XrConfig: { device: () => { MOBILE: string } };
};
type EngineWindow = Window & { XR8?: XR8; THREE?: typeof THREE };

let loading: Promise<XR8> | null = null;

/** Loads the engine (once), with its world tracking part. Can start before the tap that needs it. */
export function loadEighthWall(): Promise<XR8> {
  const win = window as EngineWindow;
  // The engine's three.js module looks for three.js here.
  win.THREE = THREE;
  loading ??= new Promise<XR8>((resolve, reject) => {
    if (win.XR8) return resolve(win.XR8);
    window.addEventListener("xrloaded", () => resolve(win.XR8!), { once: true });
    const script = document.createElement("script");
    script.src = ENGINE_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.preloadChunks = "slam";
    script.onerror = () => {
      loading = null;
      script.remove();
      reject(new Error("The AR engine couldn't be downloaded. Check your connection and try again."));
    };
    document.head.appendChild(script);
  }).then(async (xr8) => {
    await xr8.loadChunk("slam");
    return xr8;
  });
  return loading;
}

/** True on phones and tablets, where the engine can track the camera. */
export function isTouchPhone(): boolean {
  return window.matchMedia("(pointer: coarse)").matches && navigator.maxTouchPoints > 0;
}

/**
 * Starts the session. The camera picture is drawn in `stage`, an empty layer at the bottom of
 * `overlay` (the page's own controls, which stay on top of it); a tap anywhere on the overlay but on
 * its buttons places the box, and two fingers resize it. Problems that happen once the camera is
 * running arrive through `onError`.
 */
export async function startEighthWallSession(
  worldUrl: string,
  effect: WorldEffect,
  overlay: HTMLElement,
  stage: HTMLElement,
  onState: (state: RoomState) => void,
  onError: (message: string) => void,
  { enterAutomatically = false }: RoomOptions = {},
): Promise<RoomSession> {
  onState("starting");
  let ended = false;
  // The camera starts as soon as the engine is here; the box (its pictures take a moment to paint)
  // arrives while the child is still aiming. Placing, pinching and stepping in move this holder, so
  // they work before it has.
  const box = new THREE.Group();
  box.visible = false;
  let room: THREE.Group | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  loadStoryRoom(worldUrl, { effect })
    .then(({ room: built, clip }) => {
      if (ended) return disposeRoom(built);
      room = built;
      box.add(built);
      if (clip) {
        mixer = new THREE.AnimationMixer(built);
        mixer.clipAction(clip).play();
      }
    })
    .catch(() => onError("This story world couldn't be loaded. Check your connection and try again."));

  const xr8 = await loadEighthWall();
  if (!xr8.XrDevice.isDeviceBrowserCompatible({ allowedDevices: xr8.XrConfig.device().MOBILE })) {
    ended = true;
    throw new Error("This browser can't track the camera. Open the page in Safari or Chrome on a phone.");
  }

  const { canvas, fill, sized, dispose: removeCanvas } = createEighthWallCanvas(stage);

  const enter = automaticRoomEntry(box, enterAutomatically);
  let placed = false;
  let last = performance.now();
  let seen = false;
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.22, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.9 }),
  );
  reticle.visible = false;
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ray = new THREE.Raycaster();
  const centre = new THREE.Vector2(0, 0);
  const hit = new THREE.Vector3();
  let camera: THREE.PerspectiveCamera | null = null;

  const storyBox: PipelineModule = {
    name: "sketchling-story-box",
    onAttach: sized,
    onVideoSizeChange: sized,
    onDeviceOrientationChange: () => requestAnimationFrame(fill),
    onCanvasSizeChange: fill,
    onStart: () => {
      const xr = xr8.Threejs.xrScene();
      camera = xr.camera;
      xr.scene.add(box, reticle);
      // The floor is y = 0: the real floor, with the box at life size, once the engine has measured the
      // room. The ring doesn't wait for that, so the child can aim and tap straight away.
      camera.position.set(0, PHONE_HEIGHT, 0);
      xr8.XrController.updateCameraProjectionMatrix({ origin: camera.position, facing: camera.quaternion });
      onState("finding");
    },
    onUpdate: () => {
      // The engine's three.js renderer sizes the canvas in pixels; put it back to the full screen, or the
      // picture is drawn bigger than the screen and off centre (what the engine's own helper does too).
      if (canvas.style.width !== "100%" || canvas.style.height !== "100%") fill();
      const now = performance.now();
      if (placed && camera) {
        mixer?.update(Math.min((now - last) / 1000, 0.1));
        if (room) updateStoryRoom(room, camera);
      }
      last = now;
      if (placed || !camera) return;
      // The engine has updated the camera for this frame. Wait for the artwork as well, then put
      // its middle around the reader once; later frames keep the room anchored in real space.
      if (enterAutomatically) {
        if (enter(camera, 0, !!room)) {
          placed = true;
          reticle.visible = false;
          onState("placed");
        }
        return;
      }
      // The ring sits where the middle of the screen meets the floor, aimed with the lens the engine
      // set this frame (it writes the projection, not its inverse).
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      ray.setFromCamera(centre, camera);
      const onFloor = ray.ray.intersectPlane(floor, hit) && hit.distanceTo(camera.position) < 12;
      reticle.visible = !!onFloor;
      if (onFloor) {
        reticle.position.set(hit.x, 0.005, hit.z);
        if (!seen) onState("ready");
        seen = true;
      }
    },
    onCameraStatusChange: ({ status }) => {
      if (status === "failed") onError("The camera couldn't start. Allow camera access for this site in Settings, then try again.");
    },
    onException: () => onError("AR stopped working on this phone."),
  };

  // A tap anywhere (but on a button) stands the box's front at the ring, square to the reader. Taps are
  // read from pointer events: the engine may cancel the touches a click would be made from.
  const pinch = pinchToResize(overlay, box);
  let down: { x: number; y: number } | null = null;
  const press = (event: PointerEvent) => {
    down = event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
  };
  const place = (event: PointerEvent) => {
    const tap = down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < 14 && !pinch.pinchedRecently();
    down = null;
    if (!tap || placed || !reticle.visible || !camera || (event.target as Element).closest("button, a")) return;
    const toReader = new THREE.Vector3(camera.position.x - hit.x, 0, camera.position.z - hit.z).normalize();
    box.rotation.y = Math.atan2(toReader.x, toReader.z);
    box.position.copy(reticle.position).addScaledVector(toReader, -ROOM.size / 2);
    box.position.y = 0;
    box.visible = true;
    reticle.visible = false;
    placed = true;
    onState("placed");
  };
  overlay.addEventListener("pointerdown", press);
  overlay.addEventListener("pointerup", place);
  const resize = () => fill();
  window.addEventListener("resize", resize);

  // Real metres, so the 3 m box is 3 m in the room (rather than a size guessed from the phone's height).
  xr8.XrController.configure({ scale: "absolute" });
  xr8.addCameraPipelineModules([xr8.GlTextureRenderer.pipelineModule(), xr8.Threejs.pipelineModule(), xr8.XrController.pipelineModule(), storyBox]);
  xr8.run({ canvas });

  const end = () => {
    if (ended) return;
    ended = true;
    pinch.stop();
    overlay.removeEventListener("pointerdown", press);
    overlay.removeEventListener("pointerup", place);
    window.removeEventListener("resize", resize);
    xr8.stop();
    xr8.clearCameraPipelineModules();
    mixer?.stopAllAction();
    disposeRoom(box);
    reticle.geometry.dispose();
    (reticle.material as THREE.Material).dispose();
    removeCanvas();
    onState("ended");
  };
  return {
    end,
    // Straight into the box, wherever the reader stands: the floor is y = 0 here.
    stepInside: () => {
      if (!camera) return;
      standAround(box, camera, 0);
      if (placed) return;
      placed = true;
      reticle.visible = false;
      onState("placed");
    },
  };
}

/** Camera-feed canvas sizing shared by story boxes and individual models. */
export function createEighthWallCanvas(stage: HTMLElement) {
  const canvas = document.createElement("canvas");
  const fullScreen = { width: "100%", height: "100%" };
  Object.assign(canvas.style, { position: "absolute", inset: "0", display: "block", touchAction: "none", ...fullScreen });
  stage.appendChild(canvas);

  // The camera picture fills the screen, cropped like a photo app (the engine's own full-window helper, simplified).
  const video = { width: 0, height: 0 };
  const fill = () => {
    Object.assign(canvas.style, fullScreen);
    const ww = window.innerWidth * devicePixelRatio;
    const wh = window.innerHeight * devicePixelRatio;
    const tall = Math.max(ww, wh) / Math.min(ww, wh);
    const vh = Math.max(video.width, video.height);
    const vw = Math.min(video.width, video.height);
    if (!vh || !vw) return;
    let h = vh;
    let w = Math.round(vh / tall);
    if (w > vw) {
      w = vw;
      h = Math.round(vw * tall);
    }
    if (w > Math.min(ww, wh) || h > Math.max(ww, wh)) {
      w = Math.min(ww, wh);
      h = Math.max(ww, wh);
    }
    [canvas.width, canvas.height] = ww > wh ? [h, w] : [w, h];
  };
  const sized = ({ videoWidth, videoHeight }: { videoWidth: number; videoHeight: number }) => {
    video.width = videoWidth;
    video.height = videoHeight;
    fill();
  };

  return { canvas, fill, sized, dispose: () => canvas.remove() };
}
