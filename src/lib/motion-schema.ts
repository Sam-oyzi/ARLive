// Transform animations for placed content, stored as JSON in Content.motion.
// Kept free of three.js so server actions can validate it.
import { z } from "zod";

export const PRESETS = ["spin", "float", "pulse", "bounce", "swing", "pop"] as const;
export type Preset = (typeof PRESETS)[number];

export const PRESET_LABEL: Record<Preset, string> = {
  spin: "Spin",
  float: "Float",
  pulse: "Pulse",
  bounce: "Bounce",
  swing: "Swing",
  pop: "Pop in",
};

const finite = z.number().finite();

/** A pose at time `t` (seconds), in the same units as Content: page space, degrees, uniform scale. */
export const keyframeSchema = z.object({
  t: z.number().min(0).max(600),
  posX: finite,
  posY: finite,
  posZ: finite,
  rotX: finite,
  rotY: finite,
  rotZ: finite,
  scale: z.number().positive().max(100),
});

export const motionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preset"), preset: z.enum(PRESETS), speed: z.number().min(0.1).max(5) }),
  z.object({
    kind: z.literal("keyframes"),
    duration: z.number().min(0.1).max(600),
    loop: z.boolean(),
    easing: z.enum(["linear", "smooth"]),
    frames: z.array(keyframeSchema).max(300),
  }),
]);

export type Keyframe = z.infer<typeof keyframeSchema>;
export type Pose = Omit<Keyframe, "t">;
export type Motion = z.infer<typeof motionSchema>;
export type KeyframeMotion = Extract<Motion, { kind: "keyframes" }>;

export function parseMotion(json: string | null | undefined): Motion | null {
  if (!json) return null;
  try {
    const result = motionSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export const serializeMotion = (motion: Motion | null) => (motion ? JSON.stringify(motion) : null);

export function poseOf(source: Pose): Pose {
  const { posX, posY, posZ, rotX, rotY, rotZ, scale } = source;
  return { posX, posY, posZ, rotX, rotY, rotZ, scale };
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/**
 * The pose at `time`. Rotations interpolate in degrees (not quaternions) so a key at 0° and one at
 * 360° make a full turn, like Euler keys in Blender.
 */
export function sampleKeyframes(motion: KeyframeMotion, time: number): Pose | null {
  const frames = motion.frames;
  if (frames.length === 0) return null;
  const d = motion.duration;
  const t = motion.loop ? ((time % d) + d) % d : Math.min(Math.max(time, 0), d);
  const first = frames[0]!;
  const last = frames[frames.length - 1]!;
  if (frames.length === 1 || t <= first.t) return poseOf(first);
  if (t >= last.t) return poseOf(last);
  let i = 0;
  while (frames[i + 1]!.t < t) i++;
  const a = frames[i]!;
  const b = frames[i + 1]!;
  let u = (t - a.t) / Math.max(1e-6, b.t - a.t);
  if (motion.easing === "smooth") u = u * u * (3 - 2 * u);
  return {
    posX: lerp(a.posX, b.posX, u),
    posY: lerp(a.posY, b.posY, u),
    posZ: lerp(a.posZ, b.posZ, u),
    rotX: lerp(a.rotX, b.rotX, u),
    rotY: lerp(a.rotY, b.rotY, u),
    rotZ: lerp(a.rotZ, b.rotZ, u),
    scale: lerp(a.scale, b.scale, u),
  };
}

/** Insert (or overwrite, within 10 ms) a keyframe and keep frames sorted by time. */
export function upsertKeyframe(frames: Keyframe[], t: number, pose: Pose): Keyframe[] {
  const rounded = Math.round(t * 100) / 100;
  return [...frames.filter((f) => Math.abs(f.t - rounded) > 0.01), { t: rounded, ...poseOf(pose) }].sort((a, b) => a.t - b.t);
}

/** Animations that should start over every time the page is found (rather than resume). */
export function isOneShot(motion: Motion | null) {
  return motion?.kind === "preset" ? motion.preset === "pop" : motion?.kind === "keyframes" ? !motion.loop : false;
}
