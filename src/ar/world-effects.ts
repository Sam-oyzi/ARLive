// What moves inside a story room: rain (the whole water cycle, with Lou the drop) or snow.
// Everything is animated with one looping clip of position, rotation and scale keyframes, the only
// kind of animation a USDZ file carries. So AR Quick Look on iPhone, WebXR on Android and the
// 360° view all play exactly the same motion. Units are metres; the room's floor is y = 0, its front
// faces +Z, and the child walks in looking towards -Z.
import * as THREE from "three";
import type { WorldEffect } from "@/lib/world-effects";

/** How long the loop lasts, in seconds: every motion below repeats a whole number of times in it. */
const LOOP = 8;
/** A jump (a drop back at the top of its fall) is two keyframes this close together. */
const JUMP = 0.01;

type Paint = (color: number) => THREE.Material;
type Vec = [number, number, number];

/** Same numbers every time, so the room looks the same on every phone and in the USDZ file. */
function random(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const frac = (x: number) => x - Math.floor(x);

/**
 * Keyframes for a looping value: at the start and end of the loop, either side of every jump or bend
 * in `marks`, and every `step` seconds for smooth curves. `value` must repeat with the loop.
 */
function keys(value: (t: number) => number[], marks: number[], step = 0) {
  const times = new Set([0, LOOP]);
  for (const mark of marks) {
    const t = ((mark % LOOP) + LOOP) % LOOP;
    times.add(round(t));
    times.add(round(t - JUMP > 0 ? t - JUMP : LOOP - JUMP));
  }
  if (step) for (let t = step; t < LOOP; t += step) times.add(round(t));
  const sorted = [...times].sort((a, b) => a - b);
  return { times: sorted, values: sorted.flatMap((t) => value(t >= LOOP ? 0 : t)) };
}
const round = (t: number) => Math.round(t * 10_000) / 10_000;

function track(kind: "position" | "scale", object: THREE.Object3D, value: (t: number) => Vec, marks: number[], step = 0) {
  const { times, values } = keys(value, marks, step);
  return new THREE.VectorKeyframeTrack(`${object.name}.${kind}`, times, values);
}

function spinTrack(object: THREE.Object3D, angle: (t: number) => Vec, step: number) {
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const { times, values } = keys((t) => q.setFromEuler(e.set(...angle(t))).toArray(), [], step);
  return new THREE.QuaternionKeyframeTrack(`${object.name}.quaternion`, times, values);
}

function mesh(name: string, geometry: THREE.BufferGeometry, material: THREE.Material, at: Vec = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.position.set(...at);
  return m;
}

/** Adds the effect to the room; returns its looping animation, or null when nothing moves. */
export function addWorldEffect(room: THREE.Group, effect: WorldEffect, paint: Paint): THREE.AnimationClip | null {
  if (effect === "rain") return rain(room, paint);
  if (effect === "snow") return snow(room, paint);
  return null;
}

// ---------- rain: cloud, raindrops and splashes, vapour rising, and Lou going round ----------

// Ahead and a little to the left (so the world's own sun still shows), just above a child's head:
// seen as soon as you step in, or look ahead.
const CLOUD: Vec = [-0.45, 2.05, -0.95];

function cloud(paint: Paint) {
  const group = new THREE.Group();
  group.name = "Cloud";
  group.position.set(...CLOUD);
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 0.3], [-0.3, -0.05, 0.04, 0.23], [0.32, -0.04, 0, 0.25], [-0.12, 0.15, -0.04, 0.21],
    [0.16, 0.14, 0.05, 0.2], [0.52, -0.1, -0.04, 0.15], [-0.52, -0.1, 0, 0.16], [0, -0.06, 0.18, 0.2],
  ];
  const light = paint(0xf5f8fc);
  const shade = paint(0xdde5ee);
  for (const [i, [x, y, z, r]] of puffs.entries()) {
    const geometry = new THREE.SphereGeometry(r * 0.85, 20, 14);
    geometry.scale(1, 0.82, 1);
    group.add(mesh(`CloudPuff${i}`, geometry, y < -0.02 ? shade : light, [x * 0.85, y * 0.85, z * 0.85]));
  }
  return group;
}

/** Lou, the book's water drop: round at the bottom, pointed on top, facing whoever walks in. */
function lou(paint: Paint) {
  const H = 0.28;
  const R = 0.12;
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = (i / 28) * Math.PI;
    profile.push(new THREE.Vector2(R * Math.sin(t) * ((1 + Math.cos(t)) / 2) ** 0.6, ((1 - Math.cos(t)) / 2) * H));
  }
  const group = new THREE.Group();
  group.name = "Lou";
  group.add(mesh("LouBody", new THREE.LatheGeometry(profile, 32), paint(0x86c5f0)));
  const ink = paint(0x1d2433);
  const eye = new THREE.SphereGeometry(0.014, 12, 10);
  group.add(mesh("LouEyeLeft", eye, ink, [-0.03, 0.088, 0.082]), mesh("LouEyeRight", eye, ink, [0.03, 0.088, 0.082]));
  const cheek = new THREE.SphereGeometry(0.014, 12, 10);
  cheek.scale(1.3, 0.8, 0.4);
  const pink = paint(0xf4a5b4);
  group.add(mesh("LouCheekLeft", cheek, pink, [-0.056, 0.062, 0.066]), mesh("LouCheekRight", cheek, pink, [0.056, 0.062, 0.066]));
  const smile = new THREE.TorusGeometry(0.016, 0.0035, 6, 14, Math.PI);
  smile.rotateZ(Math.PI);
  group.add(mesh("LouSmile", smile, ink, [0, 0.07, 0.085]));
  const shine = new THREE.SphereGeometry(0.012, 10, 8);
  shine.scale(1, 1.7, 0.5);
  group.add(mesh("LouShine", shine, paint(0xffffff), [-0.04, 0.13, 0.068]));
  return group;
}

function rain(room: THREE.Group, paint: Paint) {
  const tracks: THREE.KeyframeTrack[] = [];
  const next = random(7);
  const effect = new THREE.Group();
  effect.name = "Rain";
  room.add(effect);

  const sky = cloud(paint);
  effect.add(sky);
  // The cloud breathes gently up and down.
  tracks.push(track("position", sky, (t) => [CLOUD[0], CLOUD[1] + 0.035 * Math.sin((t / LOOP) * 4 * Math.PI), CLOUD[2]], [], 0.5));

  // Raindrops fall from the cloud to the sea, steady like real rain, and splash where they land.
  const FALL = 1.6; // seconds from the cloud to the floor: 5 falls in a loop
  const top = CLOUD[1] - 0.18;
  const bottom = 0.03;
  const drop = new THREE.CapsuleGeometry(0.007, 0.055, 2, 6);
  const ring = new THREE.RingGeometry(0.03, 0.042, 24).rotateX(-Math.PI / 2);
  const water = paint(0x7cc4f5);
  const foam = paint(0xe6f5ff);
  for (let i = 0; i < 36; i++) {
    const angle = next() * Math.PI * 2;
    const radius = 0.55 * Math.sqrt(next());
    const x = CLOUD[0] + Math.cos(angle) * radius;
    const z = CLOUD[2] + Math.sin(angle) * radius * 0.7;
    const phase = 0.02 + next() * (FALL - 0.04);
    const landings = Array.from({ length: LOOP / FALL }, (_, k) => (k + 1) * FALL - phase);
    // How long since this drop last left the cloud (and so since it last landed).
    const since = (t: number) => frac((t + phase) / FALL) * FALL;

    const raindrop = mesh(`Raindrop${i}`, drop, water);
    effect.add(raindrop);
    tracks.push(track("position", raindrop, (t) => [x, top - (since(t) / FALL) * (top - bottom), z], landings));

    const splash = mesh(`Splash${i}`, ring, foam, [x, 0.012, z]);
    effect.add(splash);
    // A ring that opens out where the drop landed, then is gone before the next one.
    const grow = 0.45;
    tracks.push(track("scale", splash, (t) => {
      const s = since(t) < grow ? 0.01 + (since(t) / grow) * 1.8 : 0.01;
      return [s, 1, s];
    }, [...landings, ...landings.map((l) => l + grow)]));
  }

  // Vapour: little puffs rising from the sea back up into the cloud.
  const RISE = 4;
  const puff = new THREE.SphereGeometry(0.016, 10, 8);
  const vapour = paint(0xeef8ff);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 + next() * 0.3;
    // From the sea round the rain, staying inside the room's walls.
    const from: Vec = [CLOUD[0] + Math.cos(angle) * (0.55 + next() * 0.35), 0.06, CLOUD[2] + Math.sin(angle) * (0.4 + next() * 0.12)];
    const to: Vec = [CLOUD[0] + Math.cos(angle) * 0.3, CLOUD[1] - 0.1, CLOUD[2] + Math.sin(angle) * 0.18];
    const phase = next() * RISE;
    const starts = Array.from({ length: LOOP / RISE }, (_, k) => k * RISE - phase + RISE);
    const progress = (t: number) => frac((t + phase) / RISE);
    const wisp = mesh(`Vapour${i}`, puff, vapour);
    effect.add(wisp);
    tracks.push(track("position", wisp, (t) => {
      const p = progress(t);
      return [from[0] + (to[0] - from[0]) * p, from[1] + (to[1] - from[1]) * p, from[2] + (to[2] - from[2]) * p];
    }, starts));
    tracks.push(track("scale", wisp, (t) => {
      const p = progress(t);
      const s = p < 0.85 ? 0.4 + (p / 0.85) * 0.6 : 0.01 + ((1 - p) / 0.15) * 0.99;
      return [s, s, s];
    }, [...starts, ...starts.map((s) => s + RISE * 0.85)]));
  }

  // Lou goes round the water cycle once per loop: out of the cloud, down with the rain, a splash in
  // the sea, a little rest, then up again as vapour.
  const hero = lou(paint);
  effect.add(hero);
  const LX = CLOUD[0] + 0.28;
  const LZ = -0.8;
  const cloudY = CLOUD[1] - 0.12;
  const height = (t: number) => {
    if (t < 0.3) return cloudY + 0.12 * (1 - t / 0.3); // peeping out of the cloud
    if (t < 1.5) return cloudY * (1 - ((t - 0.3) / 1.2) ** 2); // falling faster and faster
    if (t < 3.2) return 0.02 * Math.abs(Math.sin((t - 1.5) * 4)); // bobbing on the sea
    if (t < 7.6) return cloudY * (1 - Math.cos(((t - 3.2) / 4.4) * Math.PI)) / 2; // rising as vapour
    return cloudY + 0.12 * ((t - 7.6) / 0.4); // back into the cloud
  };
  // A gentle sway while rising, back to still by the time Lou reaches the cloud.
  const sway = (t: number) => (t > 3.2 && t < 7.6 ? Math.sin(((t - 3.2) / 4.4) * 3 * Math.PI) : 0);
  tracks.push(track("position", hero, (t) => [LX + 0.08 * sway(t), height(t), LZ], [0.3, 1.5, 3.2, 7.6], 0.05));
  tracks.push(track("scale", hero, (t) => {
    // Squashed flat for a moment as Lou lands.
    const squash = t >= 1.5 && t < 1.9 ? Math.sin(((t - 1.5) / 0.4) * Math.PI) * 0.3 : 0;
    return [1 + squash, 1 - squash, 1 + squash];
  }, [1.5, 1.9], 0.05));
  tracks.push(spinTrack(hero, (t) => [0, 0.25 * Math.sin((t / LOOP) * 2 * Math.PI), 0.18 * sway(t)], 0.1));

  return new THREE.AnimationClip("Rain", LOOP, tracks);
}

// ---------- snow: flakes drifting down all round the room ----------

function snow(room: THREE.Group, paint: Paint) {
  const tracks: THREE.KeyframeTrack[] = [];
  const next = random(11);
  const effect = new THREE.Group();
  effect.name = "Snow";
  room.add(effect);
  const FALL = 4; // slower than rain: 2 falls in a loop
  const flake = new THREE.OctahedronGeometry(0.018, 0);
  flake.scale(1, 1, 0.35);
  const white = paint(0xffffff);
  for (let i = 0; i < 60; i++) {
    const x = (next() - 0.5) * 2.6;
    const z = (next() - 0.5) * 2.6;
    const phase = 0.02 + next() * (FALL - 0.04);
    const sway = 0.08 + next() * 0.1;
    const turns = 1 + Math.floor(next() * 2);
    const landings = Array.from({ length: LOOP / FALL }, (_, k) => (k + 1) * FALL - phase);
    const since = (t: number) => frac((t + phase) / FALL);
    const m = mesh(`Snowflake${i}`, flake, white);
    effect.add(m);
    tracks.push(track("position", m, (t) => {
      const p = since(t);
      return [x + sway * Math.sin(p * Math.PI * 2 * turns), 2.85 - p * 2.82, z + sway * 0.6 * Math.cos(p * Math.PI * 2 * turns)];
    }, landings, 0.25));
    tracks.push(spinTrack(m, (t) => [since(t) * Math.PI * 2, since(t) * Math.PI * 4, 0], 0.5));
  }
  return new THREE.AnimationClip("Snow", LOOP, tracks);
}
