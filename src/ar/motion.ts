// Runs content animations (presets and keyframes) — in the AR viewer, and as a preview in the editor.
import * as THREE from "three";
import type { ContentType } from "@/lib/content";
import { isOneShot, sampleKeyframes, type Motion, type Pose, type Preset } from "@/lib/motion-schema";
import { applyTransform } from "./content-objects";

/** The axis pointing "up" out of the content in its own space: Y for models and 3D text, Z for flat cards. */
export function upAxis(type: ContentType): "y" | "z" {
  return type === "MODEL" || type === "TEXT3D" ? "y" : "z";
}

const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};

/**
 * Offsets for a preset at time `t` (seconds), applied to a group between the authored transform and
 * the content, so presets move relative to wherever the item was placed and scale with it.
 */
export function applyPreset(group: THREE.Object3D, preset: Preset, t: number, axis: "y" | "z") {
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);
  switch (preset) {
    case "spin":
      group.rotation[axis] = t * ((Math.PI * 2) / 6); // one turn every 6 s
      break;
    case "float":
      group.position[axis] = Math.sin(t * 2) * 0.06;
      break;
    case "pulse":
      group.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
      break;
    case "bounce":
      group.position[axis] = Math.abs(Math.sin(t * 3)) * 0.18;
      break;
    case "swing":
      group.rotation[axis] = Math.sin(t * 1.6) * 0.5;
      break;
    case "pop":
      group.scale.setScalar(Math.max(1e-4, easeOutBack(Math.min(1, t / 0.6))));
      break;
  }
}

export function resetGroup(group: THREE.Object3D) {
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.setScalar(1);
}

/** Plays one item's animation in the AR viewer: starts when the page is found, pauses when lost. */
export class MotionPlayer {
  private time = 0;
  private playing = false;

  constructor(
    private motion: Motion | null,
    private type: ContentType,
    /** Carries the authored transform; keyframes drive it directly. */
    private wrapper: THREE.Object3D,
    /** Between wrapper and content; presets drive it. */
    private group: THREE.Object3D,
  ) {
    this.apply();
  }

  found() {
    if (!this.motion) return;
    if (isOneShot(this.motion)) this.time = 0;
    this.playing = true;
    this.apply();
  }

  lost() {
    this.playing = false;
  }

  restart() {
    this.time = 0;
    this.playing = !!this.motion;
    this.apply();
  }

  update(delta: number) {
    if (!this.playing) return;
    this.time += delta;
    this.apply();
  }

  private apply() {
    const motion = this.motion;
    if (!motion) return;
    if (motion.kind === "preset") {
      applyPreset(this.group, motion.preset, this.time * motion.speed, upAxis(this.type));
    } else {
      const pose: Pose | null = sampleKeyframes(motion, this.time);
      if (pose) applyTransform(this.wrapper, pose);
    }
  }
}
