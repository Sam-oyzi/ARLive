// What a child can do with the story box once it stands in the room, in either AR session: pinch it
// bigger or smaller, or jump straight inside it.
import * as THREE from "three";

/** A running AR session: end it, or put the box round the reader. */
export type RoomSession = { end: () => void; stepInside: () => void; placeAtMarker: () => void };

/** Page actions put the reader inside immediately; explicit box placement can still be manual. */
export type RoomOptions = { enterAutomatically?: boolean };

/** How much bigger or smaller than life size the box can be pinched. */
const SCALE = { min: 0.3, max: 4 };

/**
 * Two fingers on `target` make the box bigger or smaller round its middle, the floor staying on the
 * floor. `pinchedRecently` tells a tap apart from the end of a pinch. Call `stop` to remove it.
 */
export function pinchToResize(target: HTMLElement, room: THREE.Object3D) {
  const fingers = new Map<number, { x: number; y: number }>();
  let start = 0;
  let from = 1;
  let lastPinch = 0;
  const spread = () => {
    const [a, b] = [...fingers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const down = (event: PointerEvent) => {
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size === 2) {
      start = spread();
      from = room.scale.x;
      lastPinch = performance.now();
    }
  };
  const move = (event: PointerEvent) => {
    if (!fingers.has(event.pointerId)) return;
    fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (fingers.size !== 2 || !start) return;
    room.scale.setScalar(THREE.MathUtils.clamp((from * spread()) / start, SCALE.min, SCALE.max));
    lastPinch = performance.now();
  };
  const up = (event: PointerEvent) => {
    fingers.delete(event.pointerId);
    if (fingers.size < 2) start = 0;
  };
  target.addEventListener("pointerdown", down);
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
  target.addEventListener("pointercancel", up);
  return {
    pinchedRecently: () => performance.now() - lastPinch < 350,
    stop: () => {
      target.removeEventListener("pointerdown", down);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    },
  };
}

/**
 * Stands the box round the reader at life size: its middle where they are, on the floor at `floorY`,
 * the middle of the story world straight ahead of where the phone points.
 */
export function standAround(room: THREE.Object3D, camera: THREE.Camera, floorY: number) {
  const eye = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  camera.getWorldPosition(eye);
  camera.getWorldDirection(ahead);
  room.scale.setScalar(1);
  room.position.set(eye.x, floorY, eye.z);
  // The box's "ahead" is -Z: turn it to the phone's heading.
  room.rotation.set(0, Math.atan2(-ahead.x, -ahead.z), 0);
  room.visible = true;
}

/** Place once after both tracking and the story are ready, preserving the anchor on later frames. */
export function automaticRoomEntry(room: THREE.Object3D, enabled: boolean) {
  let entered = false;
  return (camera: THREE.Camera | null, floorY: number | null, contentReady = true): boolean => {
    if (!enabled || entered || !camera || floorY === null || !contentReady) return false;
    standAround(room, camera, floorY);
    entered = true;
    return true;
  };
}
