import * as THREE from "three";
import type { ContentData } from "@/lib/content";
import { createEighthWallCanvas, loadEighthWall, type PipelineModule } from "./eighth-wall-session";
import { loadPlacementAsset } from "./model-assets";
import { automaticModelPlacement } from "./model-placement";
import { pinchToResize } from "./room-controls";

export type ModelPlacementState = "starting" | "finding" | "placed";
export type ModelPlacementSession = { end: () => void };

/** The target has already been recognised; 8th Wall now anchors its saved 3D model in the room. */
export async function startEighthWallModelSession(
  content: ContentData,
  overlay: HTMLElement,
  stage: HTMLElement,
  onState: (state: ModelPlacementState) => void,
  onError: (message: string) => void,
  signal: AbortSignal,
): Promise<ModelPlacementSession> {
  let ended = false;
  let running = false;
  let asset: Awaited<ReturnType<typeof loadPlacementAsset>> | null = null;
  let canvas: ReturnType<typeof createEighthWallCanvas> | null = null;
  let mixer: THREE.AnimationMixer | null = null;
  let xr8: Awaited<ReturnType<typeof loadEighthWall>> | null = null;
  const holder = new THREE.Group();
  holder.visible = false;
  let camera: THREE.PerspectiveCamera | null = null;
  let placed = false;
  let previous = performance.now();
  const place = automaticModelPlacement(holder);
  const pinch = pinchToResize(overlay, holder);
  let finger: { id: number; x: number } | null = null;
  const down = (event: PointerEvent) => {
    if ((event.target as Element).closest("button, a")) return;
    finger = event.isPrimary ? { id: event.pointerId, x: event.clientX } : null;
  };
  const move = (event: PointerEvent) => {
    if (!placed || !finger || event.pointerId !== finger.id || pinch.pinchedRecently()) return;
    holder.rotation.y += (event.clientX - finger.x) * 0.012;
    finger.x = event.clientX;
  };
  const up = () => { finger = null; };
  const resize = () => canvas?.fill();
  const lights = new THREE.Group();
  lights.add(new THREE.HemisphereLight(0xffffff, 0xb8a893, 2.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(2, 5, 3);
  lights.add(sun);

  const end = () => {
    if (ended) return;
    ended = true;
    signal.removeEventListener("abort", end);
    pinch.stop();
    overlay.removeEventListener("pointerdown", down);
    overlay.removeEventListener("pointermove", move);
    overlay.removeEventListener("pointerup", up);
    overlay.removeEventListener("pointercancel", up);
    window.removeEventListener("resize", resize);
    if (running) {
      xr8?.stop();
      xr8?.clearCameraPipelineModules();
    }
    holder.removeFromParent();
    lights.removeFromParent();
    mixer?.stopAllAction();
    asset?.dispose();
    canvas?.dispose();
  };
  const fail = (message: string) => {
    if (ended) return;
    end();
    onError(message);
  };
  signal.addEventListener("abort", end, { once: true });
  if (signal.aborted) end();

  try {
    onState("starting");
    xr8 = await loadEighthWall();
    if (ended) throw new DOMException("The model viewer closed.", "AbortError");
    if (!xr8.XrDevice.isDeviceBrowserCompatible({ allowedDevices: xr8.XrConfig.device().MOBILE })) {
      throw new Error("Open this page in Safari or Chrome on a phone to place the model with 8th Wall.");
    }
    canvas = createEighthWallCanvas(stage);
    const module: PipelineModule = {
      name: "sketchling-model-placement",
      onAttach: canvas.sized,
      onVideoSizeChange: canvas.sized,
      onCanvasSizeChange: resize,
      onDeviceOrientationChange: resize,
      onStart: () => {
        if (ended) return;
        const scene = xr8!.Threejs.xrScene();
        camera = scene.camera;
        scene.scene.add(holder, lights);
        camera.position.set(0, 1.35, 0);
        xr8!.XrController.updateCameraProjectionMatrix({ origin: camera.position, facing: camera.quaternion });
        onState("finding");
      },
      onUpdate: ({ processCpuResult }) => {
        if (ended) return;
        const now = performance.now();
        mixer?.update(Math.min((now - previous) / 1000, 0.1));
        previous = now;
        if (canvas && (canvas.canvas.style.width !== "100%" || canvas.canvas.style.height !== "100%")) canvas.fill();
        if (!placed && place(camera, processCpuResult?.reality?.trackingStatus === "NORMAL", !!asset)) {
          placed = true;
          onState("placed");
        }
      },
      onCameraStatusChange: ({ status }) => {
        if (status === "failed") fail("Allow camera access for this site, then try again.");
      },
      onException: () => fail("8th Wall couldn't track the camera. Try again in better light."),
    };
    overlay.addEventListener("pointerdown", down);
    overlay.addEventListener("pointermove", move);
    overlay.addEventListener("pointerup", up);
    overlay.addEventListener("pointercancel", up);
    window.addEventListener("resize", resize);
    xr8.XrController.configure({ scale: "absolute" });
    xr8.addCameraPipelineModules([xr8.GlTextureRenderer.pipelineModule(), xr8.Threejs.pipelineModule(), xr8.XrController.pipelineModule(), module]);
    running = true;
    xr8.run({ canvas: canvas.canvas });
    void loadPlacementAsset(content).then((loaded) => {
      if (ended) { loaded.dispose(); return; }
      asset = loaded;
      holder.add(loaded.object);
      if (loaded.animations.length) {
        mixer = new THREE.AnimationMixer(loaded.object);
        for (const clip of loaded.animations) {
          const action = mixer.clipAction(clip);
          action.setLoop(content.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
          action.clampWhenFinished = true;
          action.play();
        }
      }
    }).catch(() => fail("This 3D model couldn't be loaded. Check your connection and try again."));
    return { end };
  } catch (error) {
    end();
    throw error;
  }
}
