// Builds three.js objects for AR content. Shared by the student AR viewer and the admin scene
// editor so that what an admin places is exactly what students see.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { ContentData } from "@/lib/content";

export type ContentHandle = {
  /** Normalised content: 1 unit wide for flat media, largest side = 1 for models. */
  object: THREE.Group;
  /** Starts downloading (idempotent). Resolves when ready to show. */
  load(): Promise<void>;
  /** Target found / target lost. */
  play(): void;
  pause(): void;
  /** Restart animation or media from the beginning. */
  restart(): void;
  /** Must be called during a user gesture so media can later play with sound (iOS/Android policy). */
  unlock(): void;
  setMuted(muted: boolean): void;
  update(delta: number): void;
  /** Animation clip names (models only, after load). */
  clips: string[];
  dispose(): void;
};

let gltfLoader: GLTFLoader | null = null;
function getGLTFLoader() {
  if (!gltfLoader) {
    const draco = new DRACOLoader().setDecoderPath("/vendor/draco/");
    gltfLoader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  }
  return gltfLoader;
}

let shadowTexture: THREE.Texture | null = null;
function getShadowTexture() {
  if (!shadowTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.5, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    shadowTexture = new THREE.CanvasTexture(canvas);
  }
  return shadowTexture;
}

const DEG = Math.PI / 180;

/** Apply an authored transform (degrees, uniform scale) to a wrapper object. */
export function applyTransform(object: THREE.Object3D, c: Pick<ContentData, "posX" | "posY" | "posZ" | "rotX" | "rotY" | "rotZ" | "scale">) {
  object.position.set(c.posX, c.posY, c.posZ);
  object.rotation.set(c.rotX * DEG, c.rotY * DEG, c.rotZ * DEG);
  object.scale.setScalar(c.scale);
}

export function disposeObject(root: THREE.Object3D) {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture && value !== shadowTexture) value.dispose();
      }
      material.dispose();
    }
  });
}

function flatPlane(texture: THREE.Texture | null, aspect = 1, transparent = false) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent,
    toneMapped: false,
    side: THREE.DoubleSide,
    color: texture ? 0xffffff : 0xe5e5ef,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.scale.set(1, aspect, 1);
  return mesh;
}

type Mode = "ar" | "editor";

export function createContent(data: ContentData, mode: Mode): ContentHandle {
  switch (data.type) {
    case "MODEL":
      return modelContent(data, mode);
    case "VIDEO":
      return videoContent(data, mode);
    case "IMAGE":
      return imageContent(data);
    case "AUDIO":
      return audioContent(data, mode);
    case "TEXT":
      return textContent(data);
  }
}

function baseHandle(object: THREE.Group): ContentHandle {
  return {
    object,
    clips: [],
    load: () => Promise.resolve(),
    play() {},
    pause() {},
    restart() {},
    unlock() {},
    setMuted() {},
    update() {},
    dispose: () => disposeObject(object),
  };
}

function modelContent(data: ContentData, mode: Mode): ContentHandle {
  const root = new THREE.Group();
  const handle = baseHandle(root);
  let mixer: THREE.AnimationMixer | null = null;
  let actions: THREE.AnimationAction[] = [];
  let playing = mode === "editor";
  let loading: Promise<void> | null = null;

  // Placeholder while the GLB downloads: a softly pulsing ring on the page.
  const placeholder = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.22, 48),
    new THREE.MeshBasicMaterial({ color: 0x8278fd, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  placeholder.rotation.x = -Math.PI / 2;
  root.add(placeholder);

  const startActions = () => {
    for (const action of actions) {
      action.reset();
      action.setLoop(data.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      action.clampWhenFinished = true;
      action.play();
    }
  };

  handle.load = () => {
    if (!data.url) return Promise.resolve();
    loading ??= getGLTFLoader()
      .loadAsync(data.url)
      .then((gltf) => {
        const model = gltf.scene;
        // Normalise: largest dimension = 1, centred on X/Z, resting on y = 0.
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const s = 1 / Math.max(size.x, size.y, size.z, 1e-6);
        model.scale.setScalar(s);
        model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
        model.traverse((node) => {
          if ((node as THREE.Mesh).isMesh) node.frustumCulled = false; // skinned meshes can cull wrongly
        });

        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false, toneMapped: false }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.002;
        shadow.scale.set(Math.max(size.x * s, 0.2) * 1.5, Math.max(size.z * s, 0.2) * 1.5, 1);
        shadow.renderOrder = -1;

        root.remove(placeholder);
        disposeObject(placeholder);
        root.add(shadow, model);

        handle.clips = gltf.animations.map((clip) => clip.name);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          const chosen = data.animation ? gltf.animations.filter((c) => c.name === data.animation) : gltf.animations;
          actions = (chosen.length ? chosen : gltf.animations).map((clip) => mixer!.clipAction(clip));
          if (playing && data.autoplay) startActions();
        }
      });
    return loading;
  };

  handle.play = () => {
    if (!playing) {
      playing = true;
      if (data.autoplay && actions.length && !actions.some((a) => a.isRunning())) startActions();
    }
  };
  handle.pause = () => {
    playing = false;
  };
  handle.restart = () => startActions();
  handle.update = (delta) => {
    if (playing) mixer?.update(delta);
    if (placeholder.parent) placeholder.material.opacity = 0.45 + 0.35 * Math.sin(performance.now() / 250);
  };
  handle.dispose = () => {
    mixer?.stopAllAction();
    disposeObject(root);
  };
  return handle;
}

function videoContent(data: ContentData, mode: Mode): ContentHandle {
  const root = new THREE.Group();
  const handle = baseHandle(root);
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = mode === "editor" ? "auto" : "metadata";
  video.loop = data.loop;
  video.muted = mode === "editor";
  if (data.url) video.src = data.url;

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = flatPlane(texture, 9 / 16);
  root.add(mesh);
  video.addEventListener("loadedmetadata", () => {
    if (video.videoWidth) mesh.scale.y = video.videoHeight / video.videoWidth;
  });

  let shouldPlay = false;
  const tryPlay = () => {
    video.play().catch(() => {
      // Autoplay with sound refused: fall back to muted rather than showing a frozen frame.
      if (!video.muted) {
        video.muted = true;
        if (shouldPlay) video.play().catch(() => {});
      }
    });
  };

  handle.load = () => {
    if (mode === "editor") tryPlay();
    return Promise.resolve();
  };
  handle.unlock = () => {
    video.play().then(() => {
      if (!shouldPlay) video.pause();
    }).catch(() => {});
  };
  handle.play = () => {
    shouldPlay = true;
    if (data.autoplay) tryPlay();
  };
  handle.pause = () => {
    shouldPlay = false;
    video.pause();
  };
  handle.restart = () => {
    video.currentTime = 0;
    tryPlay();
  };
  handle.setMuted = (muted) => {
    video.muted = mode === "editor" || muted;
  };
  handle.dispose = () => {
    video.pause();
    video.removeAttribute("src");
    video.load();
    disposeObject(root);
  };
  return handle;
}

function imageContent(data: ContentData): ContentHandle {
  const root = new THREE.Group();
  const handle = baseHandle(root);
  const mesh = flatPlane(null, 1, true);
  root.add(mesh);
  let loading: Promise<void> | null = null;
  handle.load = () => {
    if (!data.url) return Promise.resolve();
    loading ??= new THREE.TextureLoader().loadAsync(data.url).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      const image = texture.image as { width: number; height: number };
      mesh.material.map = texture;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;
      mesh.scale.y = image.height / image.width;
    });
    return loading;
  };
  return handle;
}

function audioContent(data: ContentData, mode: Mode): ContentHandle {
  const root = new THREE.Group();
  const handle = baseHandle(root);
  if (mode === "editor") {
    // A small marker so admins can see audio is attached; invisible to students.
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.4 }),
    );
    marker.position.z = 0.04;
    root.add(marker);
    return handle;
  }
  const audio = new Audio();
  audio.preload = "metadata";
  audio.loop = data.loop;
  if (data.url) audio.src = data.url;
  let shouldPlay = false;
  handle.unlock = () => {
    audio.play().then(() => {
      if (!shouldPlay) audio.pause();
    }).catch(() => {});
  };
  handle.play = () => {
    shouldPlay = true;
    if (data.autoplay) audio.play().catch(() => {});
  };
  handle.pause = () => {
    shouldPlay = false;
    audio.pause();
  };
  handle.restart = () => {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };
  handle.setMuted = (muted) => {
    audio.muted = muted;
  };
  handle.dispose = () => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  };
  return handle;
}

function textContent(data: ContentData): ContentHandle {
  const root = new THREE.Group();
  const handle = baseHandle(root);
  const canvas = drawLabel(data.text || data.name, data.color || "#ffffff");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  root.add(flatPlane(texture, canvas.height / canvas.width, true));
  return handle;
}

function drawLabel(text: string, background: string) {
  const width = 1024;
  const padding = 64;
  const fontSize = 64;
  const lineHeight = fontSize * 1.3;
  const font = `700 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (measure.measureText(next).width > width - padding * 2 && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.ceil(lines.length * lineHeight + padding * 2 - (lineHeight - fontSize));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 48);
  ctx.fill();
  ctx.fillStyle = isDark(background) ? "#ffffff" : "#161624";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => ctx.fillText(line, width / 2, padding + i * lineHeight));
  return canvas;
}

function isDark(hex: string) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.5;
}
