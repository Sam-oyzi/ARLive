// Generates the demo content used by prisma/seed.ts:
//   prisma/sample/water-page.png  a feature-rich "textbook page" that tracks well
//   prisma/sample/water.glb       an animated H2O molecule
// Run: npx tsx scripts/make-sample-assets.ts
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const OUT = path.join(process.cwd(), "prisma", "sample");
fs.mkdirSync(OUT, { recursive: true });

// ---------- PNG ----------

// Deterministic PRNG so the page (and its compiled .mind) never changes between runs.
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

const W = 800;
const H = 1100;
const px = new Uint8Array(W * H * 3);
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function set(x: number, y: number, c: RGB) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB) {
  for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) set(i, j, c);
}
function circle(cx: number, cy: number, r: number, c: RGB) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) set(cx + i, cy + j, c);
}
function ring(cx: number, cy: number, r: number, t: number, c: RGB) {
  for (let j = -r; j <= r; j++)
    for (let i = -r; i <= r; i++) {
      const d = i * i + j * j;
      if (d <= r * r && d >= (r - t) * (r - t)) set(cx + i, cy + j, c);
    }
}
function triangle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, c: RGB) {
  const minX = Math.floor(Math.min(ax, bx, cx));
  const maxX = Math.ceil(Math.max(ax, bx, cx));
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const w0 = ((bx - x) * (cy - y) - (by - y) * (cx - x)) / area;
      const w1 = ((cx - x) * (ay - y) - (cy - y) * (ax - x)) / area;
      if (w0 >= 0 && w1 >= 0 && w0 + w1 <= 1) set(x, y, c);
    }
}
function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let s = 0; s <= steps; s++) circle(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), t, c);
}

const paper = hex("#fbf8f1");
const ink = hex("#1d1b2e");
const palette = ["#8b5cf6", "#ec4899", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#1d1b2e"].map(hex);
rect(0, 0, W, H, paper);

// header band + chapter tag
rect(0, 0, W, 120, hex("#4b3fea"));
for (let i = 0; i < 40; i++) circle(Math.floor(rand() * W), Math.floor(rand() * 120), 2 + Math.floor(rand() * 6), hex("#8278fd"));
rect(40, 36, 260, 22, hex("#ffffff"));
rect(40, 70, 170, 14, hex("#cbcbff"));
rect(W - 140, 34, 100, 52, hex("#f59e0b"));
rect(W - 128, 46, 76, 10, ink);
rect(W - 128, 64, 50, 8, ink);

// illustration panel: a busy, high-contrast "lab" scene full of corners
rect(40, 150, W - 80, 470, hex("#ece9ff"));
for (let i = 0; i < 140; i++) {
  const c = palette[Math.floor(rand() * palette.length)]!;
  const x = 50 + Math.floor(rand() * (W - 100));
  const y = 160 + Math.floor(rand() * 450);
  const s = 6 + Math.floor(rand() * 34);
  const kind = rand();
  if (kind < 0.35) circle(x, y, s / 2, c);
  else if (kind < 0.6) rect(x, y, s, Math.floor(s * (0.4 + rand())), c);
  else if (kind < 0.85) triangle(x, y, x + s, y + rand() * s, x + rand() * s, y - s, c);
  else ring(x, y, s, 4, c);
}
// the molecule drawing in the middle (big, distinctive)
const O: [number, number] = [400, 385];
const H1: [number, number] = [292, 470];
const H2: [number, number] = [508, 470];
line(O[0], O[1], H1[0], H1[1], 9, ink);
line(O[0], O[1], H2[0], H2[1], 9, ink);
circle(O[0], O[1], 78, hex("#ef4444"));
ring(O[0], O[1], 78, 6, ink);
circle(O[0] - 24, O[1] - 26, 18, hex("#fca5a5"));
for (const h of [H1, H2]) {
  circle(h[0], h[1], 50, hex("#ffffff"));
  ring(h[0], h[1], 50, 6, ink);
}
rect(40, 150, W - 80, 6, ink);
rect(40, 614, W - 80, 6, ink);
rect(40, 150, 6, 470, ink);
rect(W - 46, 150, 6, 470, ink);

// "text": paragraphs of word blocks (lots of corners, like real print)
let y = 660;
for (let p = 0; p < 4; p++) {
  for (let l = 0; l < (p === 0 ? 2 : 4) && y < H - 80; l++) {
    let x = 48;
    const lineWidth = l === 3 ? 380 + rand() * 200 : W - 96;
    while (x < 48 + lineWidth) {
      const w = 14 + Math.floor(rand() * 70);
      rect(x, y, Math.min(w, 48 + lineWidth - x), p === 0 ? 18 : 11, p === 0 ? hex("#4b3fea") : ink);
      x += w + 9;
    }
    y += p === 0 ? 34 : 24;
  }
  y += 22;
}
// footer with page number badge
rect(0, H - 56, W, 56, hex("#1d1b2e"));
circle(W / 2, H - 28, 18, hex("#f59e0b"));
rect(W / 2 - 6, H - 36, 12, 16, ink);
for (let i = 0; i < 16; i++) rect(40 + i * 18, H - 34, 10, 10, palette[i % palette.length]!);

function crc32(buf: Buffer) {
  let c: number;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]!) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let r = 0; r < H; r++) {
  raw[r * (W * 3 + 1)] = 0;
  Buffer.from(px.buffer, r * W * 3, W * 3).copy(raw, r * (W * 3 + 1) + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(OUT, "water-page.png"), png);

// ---------- GLB ----------

// GLTFExporter's binary path uses FileReader, which Node lacks.
class NodeFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  onload: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onload?.();
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type};base64,${Buffer.from(buf).toString("base64")}`;
      this.onload?.();
      this.onloadend?.();
    });
  }
}
(globalThis as unknown as { FileReader: typeof NodeFileReader }).FileReader = NodeFileReader;

const scene = new THREE.Scene();
const molecule = new THREE.Group();
molecule.name = "H2O";
scene.add(molecule);

const oxygen = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.25, metalness: 0.05, name: "Oxygen" });
const hydrogen = new THREE.MeshStandardMaterial({ color: 0xf4f4f8, roughness: 0.3, metalness: 0.05, name: "Hydrogen" });
const bond = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.4, metalness: 0.2, name: "Bond" });

const o = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), oxygen);
o.name = "O";
molecule.add(o);
const angle = (104.5 / 2) * (Math.PI / 180);
for (const side of [-1, 1]) {
  const dir = new THREE.Vector3(Math.sin(angle) * side, -Math.cos(angle), 0);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.32, 40, 28), hydrogen);
  h.name = side < 0 ? "H1" : "H2";
  h.position.copy(dir.clone().multiplyScalar(0.95));
  molecule.add(h);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.95, 24), bond);
  b.name = side < 0 ? "Bond1" : "Bond2";
  b.position.copy(dir.clone().multiplyScalar(0.475));
  b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  molecule.add(b);
}
// Lift so the molecule hovers above the page with the O atom on top.
molecule.rotation.z = Math.PI;
molecule.position.y = 1.0;

// "Spin" clip: one turn around the vertical axis in 6 seconds, plus a gentle bob.
const times = [0, 1.5, 3, 4.5, 6];
const quats = times.flatMap((t) => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (t / 6) * Math.PI * 2, Math.PI));
  return [q.x, q.y, q.z, q.w];
});
const spin = new THREE.AnimationClip("Spin", 6, [
  new THREE.QuaternionKeyframeTrack("H2O.quaternion", times, quats),
  new THREE.VectorKeyframeTrack("H2O.position", [0, 1.5, 3, 4.5, 6], [0, 1, 0, 0, 1.12, 0, 0, 1, 0, 0, 1.12, 0, 0, 1, 0]),
]);

new GLTFExporter().parse(
  scene,
  (result) => {
    fs.writeFileSync(path.join(OUT, "water.glb"), Buffer.from(result as ArrayBuffer));
    console.log("Wrote prisma/sample/water-page.png and prisma/sample/water.glb");
  },
  (error) => {
    console.error(error);
    process.exit(1);
  },
  { binary: true, animations: [spin] },
);
