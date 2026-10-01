// Image-tracking AR session: camera feed + MindAR's tracking controller + a three.js renderer.
// Ported from MindAR's own three.js wrapper (mindar-image-three), which targets an old three.js
// (it imports the removed `sRGBEncoding`). Owning the renderer also gives us modern colour
// management, PBR environment lighting, snapshots and clean disposal.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Controller, MindARUpdate } from "mind-ar/dist/mindar-image.prod.js";

export type ARStage = "camera" | "targets" | "warmup" | "running";

export class ARError extends Error {
  constructor(
    public code: "insecure" | "unsupported" | "denied" | "no-camera" | "camera" | "targets",
    message: string,
  ) {
    super(message);
  }
}

export type ARAnchor = {
  targetIndex: number;
  /** Receives the tracked pose. Children use target space: 1 unit = target width. */
  group: THREE.Group;
  /** Child of `group`, for viewer gestures (spin / pinch) on top of the authored layout. */
  gesture: THREE.Group;
  visible: boolean;
  onFound?: () => void;
  onLost?: () => void;
};

type Options = {
  mindUrl: string;
  maxTrack?: number;
  /** Lower = smoother but laggier. MindAR defaults: 0.001 / 1000. */
  filterMinCF?: number;
  filterBeta?: number;
  onTrackingChange?: (anyVisible: boolean) => void;
};

/** Loads MindAR's ~2 MB tracking bundle (TensorFlow.js inside). Call early to warm the cache. */
export function loadMindAR() {
  return import("mind-ar/dist/mindar-image.prod.js");
}

export class ARSession {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera();
  readonly renderer: THREE.WebGLRenderer;
  private video: HTMLVideoElement | null = null;
  private controller: Controller | null = null;
  private anchors: ARAnchor[] = [];
  private postMatrices: THREE.Matrix4[] = [];
  private tickers = new Set<(delta: number) => void>();
  private timer = new THREE.Timer();
  private anyVisible = false;
  private disposed = false;
  private readonly onResize = () => this.resize();

  constructor(
    private container: HTMLElement,
    private options: Options,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    Object.assign(this.renderer.domElement.style, { position: "absolute", inset: "0", zIndex: "1" });
    this.container.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8888aa, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(0.4, 1, 0.6); // camera space: above and in front, like a classroom ceiling light
    this.scene.add(sun);

    window.addEventListener("resize", this.onResize);
  }

  addAnchor(targetIndex: number): ARAnchor {
    const group = new THREE.Group();
    group.visible = false;
    group.matrixAutoUpdate = false;
    const gesture = new THREE.Group();
    group.add(gesture);
    const anchor: ARAnchor = { targetIndex, group, gesture, visible: false };
    this.anchors.push(anchor);
    this.scene.add(group);
    return anchor;
  }

  /** Per-frame callbacks (animation mixers, etc.). Returns an unsubscribe function. */
  onTick(fn: (delta: number) => void) {
    this.tickers.add(fn);
    return () => this.tickers.delete(fn);
  }

  async start(onStage?: (stage: ARStage) => void) {
    if (!window.isSecureContext) {
      throw new ARError("insecure", "The camera only works over HTTPS. Open this page with an https:// link.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new ARError("unsupported", "This browser can't open the camera. Try Chrome on Android or Safari on iPhone.");
    }

    onStage?.("camera");
    const [{ Controller }] = await Promise.all([loadMindAR(), this.startVideo()]);
    if (this.disposed) return;
    const video = this.video!;

    onStage?.("targets");
    this.controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: this.options.maxTrack ?? 1,
      filterMinCF: this.options.filterMinCF ?? 0.0001,
      filterBeta: this.options.filterBeta ?? 0.01,
      onUpdate: (data) => this.handleUpdate(data),
    });
    this.resize();

    let dimensions: [number, number][];
    try {
      ({ dimensions } = await this.controller.addImageTargets(this.options.mindUrl));
    } catch {
      throw new ARError("targets", "Couldn't load this book's AR data. Check your connection and try again.");
    }
    // MindAR reports poses in target-image pixels with the origin at a corner; re-centre and
    // normalise so that 1 unit = target width and (0,0) = target centre.
    this.postMatrices = dimensions.map(([width, height]) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(width / 2, width / 2 + (height - width) / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(width, width, width),
      ),
    );

    onStage?.("warmup");
    await new Promise((r) => setTimeout(r, 0)); // let the UI paint before the blocking GPU warm-up
    this.controller.dummyRun(video);
    if (this.disposed) return;
    this.controller.processVideo(video);
    this.timer.reset();
    this.renderer.setAnimationLoop((time) => this.frame(time));
    onStage?.("running");
  }

  private async startVideo() {
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.muted = true;
    Object.assign(video.style, { position: "absolute", zIndex: "0", objectFit: "cover" });
    this.container.prepend(video);
    this.video = video;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } });
    } catch (error) {
      const name = (error as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new ARError("denied", "Camera access was blocked. Allow the camera in your browser settings, then try again.");
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new ARError("no-camera", "No camera was found on this device.");
      }
      throw new ARError("camera", "The camera couldn't start. Close other apps using it and try again.");
    }
    if (this.disposed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    video.srcObject = stream;
    await new Promise<void>((resolve) => {
      if (video.readyState >= 1) resolve();
      else video.addEventListener("loadedmetadata", () => resolve(), { once: true });
    });
    await video.play().catch(() => {});
    video.setAttribute("width", String(video.videoWidth));
    video.setAttribute("height", String(video.videoHeight));
  }

  private handleUpdate(data: MindARUpdate) {
    if (data.type !== "updateMatrix") return;
    const { targetIndex, worldMatrix } = data as { targetIndex: number; worldMatrix: number[] | null };
    for (const anchor of this.anchors) {
      if (anchor.targetIndex !== targetIndex) continue;
      if (worldMatrix) {
        anchor.group.matrix.fromArray(worldMatrix).multiply(this.postMatrices[targetIndex]!);
        anchor.group.matrixWorldNeedsUpdate = true;
      }
      anchor.group.visible = worldMatrix !== null;
      if (anchor.visible && !worldMatrix) {
        anchor.visible = false;
        anchor.onLost?.();
      } else if (!anchor.visible && worldMatrix) {
        anchor.visible = true;
        anchor.onFound?.();
      }
    }
    const anyVisible = this.anchors.some((a) => a.visible);
    if (anyVisible !== this.anyVisible) {
      this.anyVisible = anyVisible;
      this.options.onTrackingChange?.(anyVisible);
    }
  }

  private frame(time: number) {
    this.timer.update(time);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    for (const tick of this.tickers) tick(delta);
    this.renderer.render(this.scene, this.camera);
  }

  /** Match the camera to MindAR's projection and cover-fit the video, exactly like MindAR's wrapper. */
  resize() {
    const { container, video, controller, camera } = this;
    if (!video || !controller) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    video.setAttribute("width", String(video.videoWidth));
    video.setAttribute("height", String(video.videoHeight));

    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = cw / ch;
    let vw: number;
    let vh: number;
    if (videoRatio > containerRatio) {
      vh = ch;
      vw = vh * videoRatio;
    } else {
      vw = cw;
      vh = vw / videoRatio;
    }

    const proj = controller.getProjectionMatrix();
    const inputRatio = controller.inputWidth / controller.inputHeight;
    // Handles a rotated phone, where the video's width and height swap but the controller's don't.
    const inputAdjust =
      inputRatio > containerRatio ? video.videoWidth / controller.inputWidth : video.videoHeight / controller.inputHeight;
    const videoDisplayHeight =
      inputRatio > containerRatio
        ? ch * inputAdjust
        : (cw / controller.inputWidth) * controller.inputHeight * inputAdjust;
    const fovAdjust = ch / videoDisplayHeight;

    camera.fov = (2 * Math.atan((1 / proj[5]!) * fovAdjust) * 180) / Math.PI;
    camera.near = proj[14]! / (proj[10]! - 1);
    camera.far = proj[14]! / (proj[10]! + 1);
    camera.aspect = cw / ch;
    camera.updateProjectionMatrix();

    Object.assign(video.style, {
      top: `${-(vh - ch) / 2}px`,
      left: `${-(vw - cw) / 2}px`,
      width: `${vw}px`,
      height: `${vh}px`,
    });
    this.renderer.setSize(cw, ch);
  }

  /** Camera frame + 3D overlay as a JPEG data URL. */
  snapshot(): string | null {
    const { video, renderer, container } = this;
    if (!video) return null;
    const dpr = renderer.getPixelRatio();
    const canvas = document.createElement("canvas");
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(
      video,
      parseFloat(video.style.left) * dpr,
      parseFloat(video.style.top) * dpr,
      parseFloat(video.style.width) * dpr,
      parseFloat(video.style.height) * dpr,
    );
    renderer.render(this.scene, this.camera);
    ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener("resize", this.onResize);
    this.renderer.setAnimationLoop(null);
    try {
      this.controller?.dispose();
    } catch {
      // the controller may not have finished starting
    }
    const stream = this.video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    this.video?.remove();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.tickers.clear();
  }
}
