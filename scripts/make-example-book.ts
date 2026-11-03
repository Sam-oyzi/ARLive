// Draws the "Journey of a Water Drop" example book in the sketchbook-spread format (cover + 6
// two-page spreads), as watercolour-style SVG rendered to PNG pages for prisma/seed.ts.
// The art is generated here (no external images): ink lines wobble through a displacement filter and
// colour washes get soft, bleeding edges. Each spread is drawn once and cut into its two pages.
// Run: npx tsx scripts/make-example-book.ts
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";

const OUT = path.join(process.cwd(), "prisma", "sample", "example-book");
const W = 1536;
const H = 1024;
const HALF = W / 2;

// Deterministic randomness so the pages (and their compiled AR data) never change between runs.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a: number, b: number) => a + rand() * (b - a);

const C = {
  paper: "#f3ead8",
  ink: "#2b2320",
  sepia: "#8a5a3b",
  sienna: "#c98a48",
  gold: "#e3a944",
  indigo: "#34497a",
  blue: "#5d8fc2",
  sky: "#a9cbe8",
  red: "#c8433a",
  green: "#6f8f58",
  grey: "#9aa3ad",
  pale: "#dfe7ee",
};

const defs = (_w: number, _h: number) => `
<defs>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="11"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0.32 -0.1"/>
  </filter>
  <filter id="wash" x="-25%" y="-25%" width="150%" height="150%">
    <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="5" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="26" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="1.4"/>
  </filter>
  <filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="3" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="3.2" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
    <stop offset="60%" stop-color="#7a5a32" stop-opacity="0"/>
    <stop offset="100%" stop-color="#7a5a32" stop-opacity="0.22"/>
  </radialGradient>
  <linearGradient id="gutter" x1="0" x2="1" y1="0" y2="0">
    <stop offset="0" stop-color="#3c2a16" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#3c2a16" stop-opacity="0.26"/>
    <stop offset="1" stop-color="#3c2a16" stop-opacity="0"/>
  </linearGradient>
</defs>`;

// ---------- drawing primitives ----------

const wash = (d: string, color: string, opacity = 0.55) =>
  `<path d="${d}" fill="${color}" fill-opacity="${opacity}" stroke="${color}" stroke-opacity="${Math.min(0.6, opacity * 0.7)}" stroke-width="3" filter="url(#wash)"/>`;
const SINGLE_SEGMENT = /^M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+$/;
// A single straight stroke skips the wobble filter: a perfectly vertical/horizontal line has a
// zero-width box, and the box-relative filter area would clip it away entirely.
const ink = (d: string, width = 3, color = C.ink) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${SINGLE_SEGMENT.test(d) ? "" : ' filter="url(#ink)"'}/>`;
const circlePath = (cx: number, cy: number, r: number) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
const line = (x1: number, y1: number, x2: number, y2: number) => `M ${x1} ${y1} L ${x2} ${y2}`;

function waveTop(x0: number, x1: number, y: number, amp: number, len: number, phase = 0) {
  let d = `M ${x0} ${y + amp * Math.sin(phase)}`;
  for (let x = x0 + 8; x <= x1; x += 8) d += ` L ${x} ${(y + amp * Math.sin((x / len) * Math.PI * 2 + phase)).toFixed(1)}`;
  return d;
}

function sea(x0: number, x1: number, top: number, bottom = H) {
  const bands = [
    { y: top, color: C.sky, op: 0.55, amp: 10 },
    { y: top + 70, color: C.blue, op: 0.45, amp: 14 },
    { y: top + 160, color: C.indigo, op: 0.38, amp: 16 },
    { y: top + 270, color: C.blue, op: 0.5, amp: 18 },
  ];
  let svg = "";
  bands.forEach((b, i) => {
    if (b.y >= bottom) return;
    const crest = waveTop(x0, x1, b.y, b.amp, 140 + i * 30, i * 1.7);
    svg += wash(`${crest} L ${x1} ${bottom} L ${x0} ${bottom} Z`, b.color, b.op);
    svg += ink(crest, 2.4);
    // little foam curls on each crest
    for (let k = 0; k < 7; k++) {
      const x = between(x0 + 30, x1 - 30);
      const y = b.y + b.amp * Math.sin((x / (140 + i * 30)) * Math.PI * 2 + i * 1.7) + 4;
      svg += ink(`M ${x} ${y} q 10 -14 22 -2 q -8 0 -10 8`, 1.8);
    }
  });
  return svg;
}

function sun(cx: number, cy: number, r: number) {
  let svg = wash(circlePath(cx, cy, r), C.gold, 0.6) + wash(circlePath(cx + r * 0.15, cy + r * 0.15, r * 0.7), C.sienna, 0.35);
  svg += ink(circlePath(cx, cy, r), 3);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r1 = r * 1.18;
    const r2 = r * (i % 2 ? 1.45 : 1.6);
    svg += ink(line(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2), 2.6);
  }
  return svg;
}

/** A cloud: ink the circles, paint over their insides so only the outer outline stays, then wash. */
function cloud(cx: number, cy: number, s: number, dark = false) {
  const puffs: [number, number, number][] = [
    [0, 0, 70], [-80, 20, 52], [80, 18, 56], [-140, 45, 38], [140, 45, 40], [-40, -45, 50], [45, -40, 54], [0, 40, 60],
  ];
  const at = puffs.map(([x, y, r]) => [cx + x * s, cy + y * s, r * s] as const);
  let svg = at.map(([x, y, r]) => ink(circlePath(x, y, r), 3.2)).join("");
  svg += at.map(([x, y, r]) => `<path d="${circlePath(x, y, r - 1.6)}" fill="${C.paper}"/>`).join("");
  svg += at.map(([x, y, r]) => wash(circlePath(x + 6 * s, y + 10 * s, r * 0.9), dark ? C.indigo : C.sky, dark ? 0.32 : 0.28)).join("");
  // flat bottom shading
  svg += wash(`M ${cx - 170 * s} ${cy + 60 * s} Q ${cx} ${cy + 110 * s} ${cx + 170 * s} ${cy + 60 * s} L ${cx + 150 * s} ${cy + 85 * s} Q ${cx} ${cy + 125 * s} ${cx - 150 * s} ${cy + 85 * s} Z`, C.indigo, dark ? 0.35 : 0.18);
  return svg;
}

/** Lou, the water-drop hero. */
function lou(cx: number, cy: number, s: number, mood: "smile" | "sleep" = "smile", tint = C.sky) {
  const d = `M ${cx} ${cy - 60 * s} C ${cx + 22 * s} ${cy - 25 * s}, ${cx + 45 * s} ${cy}, ${cx + 45 * s} ${cy + 20 * s} A ${45 * s} ${45 * s} 0 1 1 ${cx - 45 * s} ${cy + 20 * s} C ${cx - 45 * s} ${cy}, ${cx - 22 * s} ${cy - 25 * s}, ${cx} ${cy - 60 * s} Z`;
  let svg = wash(d, tint, 0.85) + wash(circlePath(cx + 14 * s, cy + 34 * s, 26 * s), C.blue, 0.35) + ink(d, 3);
  svg += `<ellipse cx="${cx - 18 * s}" cy="${cy + 4 * s}" rx="${7 * s}" ry="${14 * s}" transform="rotate(-20 ${cx - 18 * s} ${cy + 4 * s})" fill="#ffffff" fill-opacity="0.85"/>`;
  if (mood === "sleep") {
    svg += ink(`M ${cx - 20 * s} ${cy + 20 * s} q 6 5 12 0 M ${cx + 8 * s} ${cy + 20 * s} q 6 5 12 0`, 2.4);
    svg += `<text x="${cx + 40 * s}" y="${cy - 30 * s}" font-family="Georgia" font-style="italic" font-size="${26 * s}" fill="${C.sepia}">z z</text>`;
  } else {
    svg += `<circle cx="${cx - 14 * s}" cy="${cy + 18 * s}" r="${4.5 * s}" fill="${C.ink}"/><circle cx="${cx + 14 * s}" cy="${cy + 18 * s}" r="${4.5 * s}" fill="${C.ink}"/>`;
  }
  svg += ink(`M ${cx - 12 * s} ${cy + 34 * s} Q ${cx} ${cy + 44 * s} ${cx + 12 * s} ${cy + 34 * s}`, 2.4);
  svg += `<circle cx="${cx - 24 * s}" cy="${cy + 32 * s}" r="${5 * s}" fill="${C.red}" fill-opacity="0.35"/><circle cx="${cx + 24 * s}" cy="${cy + 32 * s}" r="${5 * s}" fill="${C.red}" fill-opacity="0.35"/>`;
  return svg;
}

function mountain(points: [number, number][], base = H, snow = false, tint = C.sepia) {
  const d = `M ${points[0]![0]} ${base} ${points.map(([x, y]) => `L ${x} ${y}`).join(" ")} L ${points[points.length - 1]![0]} ${base} Z`;
  let svg = wash(d, tint, 0.42);
  svg += ink(`M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")}`, 3);
  // hatching on the shadow side of each peak
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]!;
    if (points[i - 1]![1] < py || points[i + 1]![1] < py) continue; // only true peaks
    for (let k = 0; k < 9; k++) {
      const y = py + 30 + k * 18;
      svg += ink(line(px + 8 + k * 7, y, px + 30 + k * 9, y + 26), 1.6, C.sepia);
    }
    if (snow) {
      const cap = `M ${px - 60} ${py + 70} L ${px} ${py} L ${px + 60} ${py + 70} l -18 -12 l -14 16 l -14 -14 l -14 12 l -14 -16 l -14 14 Z`;
      svg += `<path d="${cap}" fill="#ffffff" fill-opacity="0.9" filter="url(#wash)"/>` + ink(`M ${px - 60} ${py + 70} l 18 -12 l 14 16 l 14 -14 l 14 12 l 14 -16 l 14 14`, 2);
    }
  }
  return svg;
}

function pine(x: number, y: number, s: number) {
  const d = `M ${x} ${y - 90 * s} L ${x + 26 * s} ${y - 40 * s} L ${x + 14 * s} ${y - 40 * s} L ${x + 36 * s} ${y} L ${x - 36 * s} ${y} L ${x - 14 * s} ${y - 40 * s} L ${x - 26 * s} ${y - 40 * s} Z`;
  return wash(d, C.green, 0.6) + ink(d, 2.2) + ink(line(x, y, x, y + 16 * s), 2.4);
}

function snowflake(cx: number, cy: number, r: number) {
  let hex = "";
  for (let k = 0; k < 6; k++) hex += `${k ? "L" : "M"} ${cx + Math.cos((k * Math.PI) / 3) * r * 0.42} ${cy + Math.sin((k * Math.PI) / 3) * r * 0.42} `;
  let svg = wash(hex + "Z", C.sky, 0.55) + wash(circlePath(cx, cy, r * 1.05), C.pale, 0.35);
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3 + Math.PI / 6;
    const ex = cx + Math.cos(a) * r;
    const ey = cy + Math.sin(a) * r;
    svg += `<path d="${line(cx, cy, ex, ey)}" stroke="${C.blue}" stroke-opacity="0.45" stroke-width="${r > 60 ? 26 : 5}" stroke-linecap="round"/>`;
    svg += ink(line(cx, cy, ex, ey), r > 60 ? 6 : 2, C.indigo);
    for (const [t, len] of [[0.35, 0.26], [0.6, 0.22], [0.82, 0.13]] as const) {
      const bx = cx + Math.cos(a) * r * t;
      const by = cy + Math.sin(a) * r * t;
      for (const side of [-1, 1]) {
        const b = a + side * (Math.PI / 4);
        svg += ink(line(bx, by, bx + Math.cos(b) * r * len, by + Math.sin(b) * r * len), r > 60 ? 4 : 1.4, C.indigo);
      }
    }
    svg += ink(circlePath(ex, ey, Math.max(2, r * 0.035)), r > 60 ? 3 : 1.6, C.indigo);
  }
  svg += ink(hex + "Z", 3, C.indigo);
  return svg;
}

function molecule(cx: number, cy: number, s: number) {
  const angle = (104.5 / 2) * (Math.PI / 180);
  const bond = 200 * s;
  const hs = [-1, 1].map((side) => [cx + Math.sin(angle) * bond * side, cy + Math.cos(angle) * bond] as const);
  let svg = "";
  for (const [hx, hy] of hs) {
    // stick: a slim rectangle between the atoms
    const dx = hx - cx;
    const dy = hy - cy;
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * 14 * s;
    const ny = (dx / len) * 14 * s;
    const rect = `M ${cx + nx} ${cy + ny} L ${hx + nx} ${hy + ny} L ${hx - nx} ${hy - ny} L ${cx - nx} ${cy - ny} Z`;
    svg += wash(rect, C.grey, 0.75) + ink(rect, 2.6);
  }
  for (const [hx, hy] of hs) {
    svg += `<path d="${circlePath(hx, hy, 76 * s)}" fill="${C.paper}"/>`;
    svg += wash(circlePath(hx, hy, 78 * s), C.pale, 0.9) + wash(circlePath(hx + 18 * s, hy + 20 * s, 50 * s), C.indigo, 0.22) + ink(circlePath(hx, hy, 78 * s), 3.4);
    svg += `<ellipse cx="${hx - 26 * s}" cy="${hy - 28 * s}" rx="${16 * s}" ry="${10 * s}" transform="rotate(-35 ${hx - 26 * s} ${hy - 28 * s})" fill="#fff" fill-opacity="0.9"/>`;
  }
  svg += `<path d="${circlePath(cx, cy, 123 * s)}" fill="${C.paper}"/>`;
  svg += wash(circlePath(cx, cy, 125 * s), C.red, 0.78) + wash(circlePath(cx + 30 * s, cy + 34 * s, 80 * s), "#7c1f1a", 0.3) + ink(circlePath(cx, cy, 125 * s), 3.8);
  svg += `<ellipse cx="${cx - 44 * s}" cy="${cy - 46 * s}" rx="${26 * s}" ry="${16 * s}" transform="rotate(-35 ${cx - 44 * s} ${cy - 46 * s})" fill="#fff" fill-opacity="0.75"/>`;
  // orbit-ish sketch lines and sparkles around it, for detail
  svg += ink(`M ${cx - 260 * s} ${cy - 20 * s} C ${cx - 200 * s} ${cy - 250 * s}, ${cx + 200 * s} ${cy - 250 * s}, ${cx + 260 * s} ${cy - 20 * s}`, 1.8, C.sepia);
  return svg;
}

function sparkle(x: number, y: number, r: number) {
  return ink(`M ${x} ${y - r} L ${x} ${y + r} M ${x - r} ${y} L ${x + r} ${y} M ${x - r * 0.5} ${y - r * 0.5} L ${x + r * 0.5} ${y + r * 0.5} M ${x + r * 0.5} ${y - r * 0.5} L ${x - r * 0.5} ${y + r * 0.5}`, 1.8, C.sienna);
}

function bubbles(x0: number, x1: number, y0: number, y1: number, n: number) {
  let svg = "";
  for (let i = 0; i < n; i++) svg += ink(circlePath(between(x0, x1), between(y0, y1), between(4, 13)), 1.8, C.indigo);
  return svg;
}

function birds(x0: number, y0: number, n: number) {
  let svg = "";
  for (let i = 0; i < n; i++) {
    const x = x0 + i * between(40, 70);
    const y = y0 + between(-30, 30);
    const s = between(0.7, 1.2);
    svg += ink(`M ${x} ${y} q ${10 * s} ${-12 * s} ${20 * s} 0 q ${10 * s} ${-12 * s} ${20 * s} 0`, 2.2);
  }
  return svg;
}

function fish(x: number, y: number, s: number, color = C.sienna) {
  const body = `M ${x} ${y} q ${30 * s} ${-26 * s} ${60 * s} 0 q ${-30 * s} ${26 * s} ${-60 * s} 0 Z`;
  const tail = `M ${x + 58 * s} ${y} l ${18 * s} ${-14 * s} l 0 ${28 * s} Z`;
  return wash(body, color, 0.55) + wash(tail, color, 0.55) + ink(body, 2) + ink(tail, 2) + `<circle cx="${x + 14 * s}" cy="${y - 3 * s}" r="${2.6 * s}" fill="${C.ink}"/>`;
}

function rain(x0: number, x1: number, y0: number, y1: number, n: number) {
  let svg = "";
  for (let i = 0; i < n; i++) {
    const x = between(x0, x1);
    const y = between(y0, y1);
    svg += ink(line(x, y, x - 10, y + 34), 2, C.indigo);
  }
  return svg;
}

function steam(x: number, y: number, h: number) {
  return ink(`M ${x} ${y} c -30 -${h * 0.2} 30 -${h * 0.35} 0 -${h * 0.55} c -30 -${h * 0.2} 30 -${h * 0.3} 0 -${h * 0.45}`, 2.4, C.sepia);
}

function river(points: [number, number][], width: number) {
  const left = points.map(([x, y], i) => [x - width / 2 - i * 4, y] as const);
  const right = points.map(([x, y], i) => [x + width / 2 + i * 4, y] as const).reverse();
  const d = `M ${left.map(([x, y]) => `${x} ${y}`).join(" L ")} L ${right.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
  return wash(d, C.blue, 0.5) + ink(`M ${left.map(([x, y]) => `${x} ${y}`).join(" L ")}`, 2.6) + ink(`M ${right.map(([x, y]) => `${x} ${y}`).join(" L ")}`, 2.6);
}

let dateLabel = "Oct · 2026";
const date = (x: number, y: number) => `<text x="${x}" y="${y}" font-family="Georgia, Segoe UI, Arial" font-style="italic" font-size="20" fill="${C.sepia}" fill-opacity="0.8">${dateLabel}</text>`;

// ---------- pages ----------

function paper(width: number, height: number, spread: boolean) {
  return `<rect width="${width}" height="${height}" fill="${C.paper}"/>
  <rect width="${width}" height="${height}" filter="url(#grain)"/>
  <rect width="${width}" height="${height}" fill="url(#vignette)"/>
  ${spread ? `<rect x="${HALF - 70}" y="0" width="140" height="${height}" fill="url(#gutter)"/>` : ""}`;
}

const svgDoc = (width: number, height: number, body: string, viewBox = `0 0 ${width} ${height}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${defs(width, height)}${body}</svg>`;

function cover(lines = ["The Journey of", "a Water Drop"], subtitle = "A WATER-CYCLE SKETCHBOOK", arabic = false) {
  const w = HALF;
  let body = paper(w, H, false);
  body += wash(circlePath(384, 560, 260), C.sky, 0.25);
  body += sun(560, 390, 60) + cloud(250, 410, 0.55);
  body += sea(60, 708, 690, 900);
  body += lou(384, 600, 2.3);
  body += birds(470, 300, 3);
  const font = arabic ? "Segoe UI, Arial" : "Georgia";
  const style = arabic ? "normal" : "italic";
  body += `<text x="384" y="150" text-anchor="middle" font-family="${font}" font-style="${style}" font-size="64" fill="${C.ink}">${lines[0]}</text>`;
  body += `<text x="384" y="230" text-anchor="middle" font-family="${font}" font-style="${style}" font-size="72" fill="${C.ink}">${lines[1]}</text>`;
  body += ink("M 214 262 Q 384 286 554 262", 2, C.sepia);
  body += `<text x="384" y="960" text-anchor="middle" font-family="${font}" font-size="${arabic ? 30 : 22}" letter-spacing="${arabic ? 0 : subtitle.startsWith("UN ") ? 3 : 6}" fill="${C.sepia}">${subtitle}</text>`;
  return svgDoc(w, H, body);
}

const spreads: (() => string)[] = [
  // 01 — Lou in the sea / The warm sun
  () => {
    seed = 101;
    let b = paper(W, H, true);
    b += wash(`M 0 0 L ${W} 0 L ${W} 520 Q 760 470 0 540 Z`, C.sky, 0.18);
    b += sun(1180, 260, 105) + birds(980, 200, 4) + cloud(420, 230, 0.75);
    b += sea(0, W, 560);
    b += lou(360, 610, 1.35);
    b += fish(170, 860, 1.1) + fish(560, 940, 0.9, C.gold) + fish(1050, 900, 1.2) + bubbles(120, 700, 760, 1000, 14);
    b += ink("M 1300 548 l 60 0 l -12 18 l -36 0 Z M 1330 548 l 0 -60 l 30 52", 2.4) + date(1372, 58);
    return b;
  },
  // 02 — Rising waves / Meet H₂O (AR right)
  () => {
    seed = 202;
    let b = paper(W, H, true);
    b += sea(0, HALF - 12, 380);
    b += lou(300, 330, 1.2) + bubbles(60, 700, 480, 1000, 22) + fish(470, 820, 1.2) + fish(120, 700, 0.9, C.gold);
    b += wash(circlePath(1150, 470, 300), C.sky, 0.22);
    b += molecule(1150, 400, 1.05);
    for (let i = 0; i < 9; i++) b += sparkle(between(830, 1490), between(80, 960), between(10, 20));
    b += bubbles(830, 1490, 780, 990, 18);
    for (let i = 0; i < 18; i++) b += ink(line(870 + i * 34, 900, 890 + i * 34, 940), 1.6, C.sepia);
    b += date(1372, 58);
    return b;
  },
  // 03 — Ice crystal (AR left) / Snowy peaks
  () => {
    seed = 303;
    let b = paper(W, H, true);
    b += wash(circlePath(384, 470, 330), C.pale, 0.35);
    b += snowflake(384, 470, 250);
    for (let i = 0; i < 14; i++) b += snowflake(between(60, 700), between(60, 980), between(12, 26));
    b += mountain([[790, 820], [900, 520], [1000, 640], [1130, 330], [1260, 600], [1360, 470], [1536, 760]], H, true);
    b += pine(880, 980, 1.2) + pine(960, 1000, 0.9) + pine(1420, 990, 1.3) + pine(1490, 1010, 1);
    b += lou(1130, 280, 0.7, "sleep", C.pale);
    b += date(1372, 58);
    return b;
  },
  // 04 — Warming up / Up, up and away
  () => {
    seed = 404;
    let b = paper(W, H, true);
    b += sun(260, 260, 130);
    b += sea(0, W, 760);
    for (let i = 0; i < 8; i++) b += steam(500 + i * 120, 740, between(260, 420));
    b += lou(1120, 380, 1.1) + ink("M 1080 470 q -20 40 0 80 M 1160 470 q 20 40 0 80", 2, C.sepia);
    b += cloud(1310, 160, 0.6) + cloud(920, 130, 0.45);
    b += birds(700, 200, 3) + date(1372, 58);
    return b;
  },
  // 05 — Gathering clouds / Rain over the mountain (AR right)
  () => {
    seed = 505;
    let b = paper(W, H, true);
    b += cloud(230, 260, 0.6) + cloud(560, 330, 0.5);
    b += lou(250, 640, 0.9) + lou(380, 700, 0.75, "smile", C.pale) + lou(510, 650, 0.85);
    b += ink("M 290 690 q 30 20 60 10 M 420 730 q 30 10 55 -20", 2, C.sepia);
    b += mountain([[800, 900], [960, 700], [1080, 780], [1220, 560], [1380, 760], [1536, 680]], H, false, C.green);
    b += rain(950, 1450, 420, 760, 70);
    b += cloud(1180, 330, 1.25, true);
    b += pine(900, 1000, 1.1) + pine(1480, 990, 1.2) + pine(1400, 1010, 0.8);
    return b;
  },
  // 06 — The river / Home again
  () => {
    seed = 606;
    let b = paper(W, H, true);
    b += mountain([[0, 420], [140, 230], [280, 380], [420, 200], [560, 360], [700, 300]], 520, true);
    b += river([[300, 380], [360, 520], [300, 660], [460, 780], [700, 840], [900, 900], [1100, 860]], 70);
    b += pine(120, 640, 1.1) + pine(200, 760, 0.9) + pine(600, 620, 1) + pine(560, 980, 1.2);
    b += lou(660, 820, 0.8);
    b += sea(980, W, 760);
    b += sun(1300, 300, 120) + birds(1020, 220, 4) + cloud(1050, 450, 0.45);
    b += date(1372, 58);
    return b;
  },
];

/** Render to raw RGBA pixels (resvg crashes when a viewBox crops through these filters, so spreads
 * are rendered whole and cut in half here). */
function renderPixels(svg: string) {
  const image = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "Georgia" } }).render();
  return { width: image.width, height: image.height, pixels: image.pixels };
}

function crop(src: { width: number; height: number; pixels: Buffer }, x0: number, width: number) {
  const out = Buffer.alloc(width * src.height * 4);
  for (let y = 0; y < src.height; y++) src.pixels.copy(out, y * width * 4, (y * src.width + x0) * 4, (y * src.width + x0 + width) * 4);
  return { width, height: src.height, pixels: out };
}

const toJpeg = (img: { width: number; height: number; pixels: Buffer }) => jpeg.encode({ data: img.pixels, width: img.width, height: img.height }, 88).data;

if (process.argv.includes("--localized")) {
  const output = path.join(process.cwd(), "public", "book-art", "water-drop");
  fs.mkdirSync(output, { recursive: true });
  const languages = [
    { tag: "fr", lines: ["Le voyage d’une", "goutte d’eau"], subtitle: "UN CARNET SUR LE CYCLE DE L’EAU", date: "oct. · 2026" },
    { tag: "ar", lines: ["رحلة", "قطرة ماء"], subtitle: "دفتر مصوّر عن دورة الماء", date: "أكتوبر ٢٠٢٦" },
  ];
  for (const language of languages) {
    dateLabel = language.date;
    seed = 7;
    fs.writeFileSync(path.join(output, `${language.tag}-page-01.jpg`), toJpeg(renderPixels(cover(language.lines, language.subtitle, language.tag === "ar"))));
    for (const index of [0, 1, 2, 3, 5]) {
      const spread = renderPixels(svgDoc(W, H, spreads[index]!()));
      const page = String(3 + index * 2).padStart(2, "0");
      fs.writeFileSync(path.join(output, `${language.tag}-page-${page}.jpg`), toJpeg(crop(spread, HALF, HALF)));
    }
  }
  process.exit(0);
}

fs.mkdirSync(OUT, { recursive: true });
for (const old of fs.readdirSync(OUT).filter((f) => /^page-\d+\.(png|jpg)$/.test(f))) fs.rmSync(path.join(OUT, old));
fs.writeFileSync(path.join(OUT, "page-01.jpg"), toJpeg(renderPixels(cover())));
spreads.forEach((draw, i) => {
  const spread = renderPixels(svgDoc(W, H, draw()));
  const n = 2 + i * 2;
  fs.writeFileSync(path.join(OUT, `page-${String(n).padStart(2, "0")}.jpg`), toJpeg(crop(spread, 0, HALF)));
  fs.writeFileSync(path.join(OUT, `page-${String(n + 1).padStart(2, "0")}.jpg`), toJpeg(crop(spread, HALF, HALF)));
});
const total = fs.readdirSync(OUT).filter((f) => f.endsWith(".jpg")).reduce((sum, f) => sum + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`Wrote ${1 + spreads.length * 2} pages to prisma/sample/example-book (${(total / 1024 / 1024).toFixed(1)} MB)`);
