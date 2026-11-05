// The story world as a box to walk into: a closed cube standing on the floor, painted inside and out
// with the page's 360° panorama. From across the room it's a box of the story; step through a wall
// (in AR, walls are only pictures) and the walls give way to the world itself: the sky far away and
// the ground of the panorama under your feet, with no corners or joins wherever you stand.
// Used by WebXR on Android (placed where the reader taps on the floor), exported as USDZ for AR Quick
// Look on iPhone, and looked round from the inside by the 360° view.
// Units are metres; the group's origin is the floor under the centre, and the side facing the reader
// is +Z.
import * as THREE from "three";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";
import { addWorldEffect } from "./world-effects";
import type { WorldEffect } from "@/lib/world-effects";

export const ROOM = {
  /** A cube: as wide, deep and high as this. */
  size: 3,
  /** The panorama's horizon sits at eye height; the room is drawn as seen from here. */
  eye: 1.5,
};

/** A wall, floor or ceiling as seen from inside: its corners top-left, top-right, bottom-left. */
type Face = { name: string; tl: THREE.Vector3; tr: THREE.Vector3; bl: THREE.Vector3 };

function faces(): Face[] {
  const h = ROOM.size / 2;
  const S = ROOM.size;
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return [
    { name: "Ahead", tl: v(-h, S, -h), tr: v(h, S, -h), bl: v(-h, 0, -h) },
    { name: "Behind", tl: v(h, S, h), tr: v(-h, S, h), bl: v(h, 0, h) },
    { name: "Left", tl: v(-h, S, h), tr: v(-h, S, -h), bl: v(-h, 0, h) },
    { name: "Right", tl: v(h, S, -h), tr: v(h, S, h), bl: v(h, 0, -h) },
    { name: "Ceiling", tl: v(-h, S, h), tr: v(h, S, h), bl: v(-h, S, -h) },
    { name: "Floor", tl: v(-h, 0, -h), tr: v(h, 0, -h), bl: v(-h, 0, h) },
  ];
}

/** The panorama's pixels, at most `maxWidth` wide, and the picture itself. */
async function loadPanorama(url: string, maxWidth: number): Promise<{ pixels: ImageData; image: HTMLImageElement }> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the story world"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(image.naturalWidth, maxWidth);
  canvas.height = Math.round((canvas.width * image.naturalHeight) / image.naturalWidth);
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  // Phones keep canvas memory until it is shrunk.
  canvas.width = canvas.height = 0;
  return { pixels, image };
}

/** How far away the sky is drawn from inside: far enough that walking round the box shows no parallax. */
const WORLD_RADIUS = 40;

/**
 * The world seen from inside the box: the panorama on a far sphere whose lower half is flattened into
 * ground at the floor, so the child stands on the story's ground with its sky all round.
 */
function insideWorld(image: HTMLImageElement): THREE.Mesh {
  let source: HTMLImageElement | HTMLCanvasElement = image;
  // Phones cap texture sizes; 4096 wide is plenty for a sky.
  if (image.naturalWidth > 4096) {
    source = document.createElement("canvas");
    source.width = 4096;
    source.height = Math.round((4096 * image.naturalHeight) / image.naturalWidth);
    source.getContext("2d")!.drawImage(image, 0, 0, source.width, source.height);
  }
  const texture = source instanceof HTMLCanvasElement ? new THREE.CanvasTexture(source) : new THREE.Texture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const world = new GroundedSkybox(texture, ROOM.eye, WORLD_RADIUS);
  world.name = "StoryWorld";
  // The ground sits at the floor; the middle of the panorama straight ahead (-Z), as on the walls.
  world.position.y = ROOM.eye;
  world.rotation.y = Math.PI / 2;
  world.renderOrder = -1;
  world.visible = false;
  return world;
}

const viewer = new THREE.Vector3();

/**
 * Call each frame: inside the box, the walls give way to the world; outside, it's a closed box again.
 * Rain, snow and Lou stay where they are either way.
 */
export function updateStoryRoom(room: THREE.Object3D, camera: THREE.Camera) {
  const world = room.getObjectByName("StoryWorld");
  if (!world) return;
  const at = room.worldToLocal(camera.getWorldPosition(viewer));
  // A little inside the walls, so the view doesn't flicker while stepping through one.
  const half = ROOM.size / 2 - 0.05;
  const inside = Math.abs(at.x) < half && Math.abs(at.z) < half && at.y > -0.5 && at.y < ROOM.size;
  if (inside === world.visible) return;
  world.visible = inside;
  for (const wall of room.children) if (wall.name.endsWith("Inside")) wall.visible = !inside;
}

/**
 * One face's picture: for every pixel, the panorama in the direction from the eye to that point of
 * the wall. The mapping is the one a sphere around the eye would use, with the middle of the
 * panorama straight ahead (-Z).
 */
function bake(panorama: ImageData, face: Face, size: number): HTMLCanvasElement {
  const { width: W, height: H, data } = panorama;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const out = context.createImageData(size, size);
  const across = face.tr.clone().sub(face.tl);
  const down = face.bl.clone().sub(face.tl);
  const origin = face.tl.clone().sub(new THREE.Vector3(0, ROOM.eye, 0));
  let o = 0;
  for (let j = 0; j < size; j++) {
    const v = (j + 0.5) / size;
    for (let i = 0; i < size; i++) {
      const u = (i + 0.5) / size;
      const dx = origin.x + across.x * u + down.x * v;
      const dy = origin.y + across.y * u + down.y * v;
      const dz = origin.z + across.z * u + down.z * v;
      const theta = Math.acos(dy / Math.hypot(dx, dy, dz));
      let lon = Math.atan2(-dx, dz) / (2 * Math.PI);
      if (lon < 0) lon += 1;
      // Bilinear, wrapping round the panorama's left and right edges.
      const x = lon * W - 0.5;
      const y = Math.min(H - 1, Math.max(0, (theta / Math.PI) * H - 0.5));
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const xa = (x0 + W) % W;
      const xb = (xa + 1) % W;
      const ya = y0 * W;
      const yb = Math.min(H - 1, y0 + 1) * W;
      const a = (ya + xa) * 4;
      const b = (ya + xb) * 4;
      const c = (yb + xa) * 4;
      const d = (yb + xb) * 4;
      for (let k = 0; k < 3; k++) {
        const top = data[a + k]! + (data[b + k]! - data[a + k]!) * fx;
        const bottom = data[c + k]! + (data[d + k]! - data[c + k]!) * fx;
        out.data[o + k] = top + (bottom - top) * fy;
      }
      out.data[o + 3] = 255;
      o += 4;
    }
  }
  context.putImageData(out, 0, 0);
  return canvas;
}

/**
 * A face as a flat mesh. Inside faces the centre; the outside copy faces out, a little further out,
 * so the room reads as a closed box of the story from across the room.
 */
function side(face: Face, outside: boolean): THREE.BufferGeometry {
  const across = face.tr.clone().sub(face.tl);
  const down = face.bl.clone().sub(face.tl);
  const normal = new THREE.Vector3().crossVectors(down, across).normalize();
  // The outside sits 2 cm out and reaches 2 cm further each way, so the box's corners stay sealed.
  const grow = outside ? 0.02 / ROOM.size : 0;
  const at = (u: number, v: number) => {
    const p = face.tl
      .clone()
      .addScaledVector(across, -grow + u * (1 + 2 * grow))
      .addScaledVector(down, -grow + v * (1 + 2 * grow));
    if (outside) p.addScaledVector(normal, -0.02);
    return [p.x, p.y, p.z];
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([...at(0, 0), ...at(0, 1), ...at(1, 0), ...at(1, 1)], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 1, 1, 0], 2));
  geometry.setIndex(outside ? [0, 2, 1, 2, 3, 1] : [0, 1, 2, 2, 1, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

export type StoryRoom = { room: THREE.Group; clip: THREE.AnimationClip | null };

/**
 * The room for a panorama, with its effect (rain, snow) and the effect's looping animation.
 * `lit` uses standard materials that glow with their own colours (what USDZ needs); otherwise unlit
 * basic materials (cheaper, for WebXR and the 360° view). `faceSize` is each face's picture in pixels.
 */
export async function loadStoryRoom(worldUrl: string, { effect = "none", lit = false, faceSize = 1024 }: { effect?: WorldEffect; lit?: boolean; faceSize?: number } = {}): Promise<StoryRoom> {
  const { pixels: panorama, image } = await loadPanorama(worldUrl, faceSize * 4);
  const paint = (color: number, map: THREE.Texture | null = null): THREE.Material =>
    lit
      ? new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: color, color: 0x000000, roughness: 1, metalness: 0 })
      : new THREE.MeshBasicMaterial({ map, color });

  const room = new THREE.Group();
  room.name = "StoryRoom";
  for (const face of faces()) {
    const texture = new THREE.CanvasTexture(bake(panorama, face, faceSize));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.userData.mimeType = "image/jpeg"; // keeps the USDZ file small
    const material = paint(0xffffff, texture);
    // Every side twice, so the box is closed whichever way it's seen from.
    for (const outside of [false, true]) {
      const mesh = new THREE.Mesh(side(face, outside), material);
      mesh.name = `${face.name}${outside ? "Outside" : "Inside"}`;
      room.add(mesh);
    }
  }

  // The world inside, for the viewers that draw it themselves (a USDZ file can't swap walls for it).
  if (!lit) room.add(insideWorld(image));

  const clip = addWorldEffect(room, effect, (color) => paint(color));
  return { room, clip };
}

/** The room as a USDZ file for AR Quick Look: tap, find the floor, walk into the box. */
export async function exportStoryRoomUsdz(worldUrl: string, effect: WorldEffect = "none"): Promise<Blob> {
  const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");
  const { room, clip } = await loadStoryRoom(worldUrl, { effect, lit: true });
  try {
    const data = await new USDZExporter().parseAsync(room, {
      quickLookCompatible: true,
      maxTextureSize: 1024,
      // Quick Look plays the room's animation on its own, round and round.
      animations: clip ? [clip] : [],
      animationFrameRate: 30,
    });
    return new Blob([data], { type: "model/vnd.usdz+zip" });
  } finally {
    disposeRoom(room);
  }
}

export function disposeRoom(room: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  room.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry);
      materials.add(object.material as THREE.Material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) {
    const { map } = material as THREE.MeshBasicMaterial;
    if (map) {
      // A baked face: let the phone have its canvas memory back too.
      const canvas = map.image as HTMLCanvasElement | undefined;
      if (canvas instanceof HTMLCanvasElement) canvas.width = canvas.height = 0;
      map.dispose();
    }
    material.dispose();
  }
}
