// A WebXR story room: enter around the first tracked camera pose, or place its front on the floor
// manually when explicitly requested.
// The phone's tracking then follows the reader around in real space, in and out of the room.
import * as THREE from "three";
import type { WorldEffect } from "@/lib/world-effects";
import { automaticRoomEntry, pinchToResize, standAround, type RoomOptions, type RoomSession } from "./room-controls";
import { disposeRoom, loadStoryRoom, ROOM, updateStoryRoom } from "./story-room";

export type RoomState = "starting" | "finding" | "ready" | "placed" | "ended";

/** True when this browser can run an immersive AR session (it can still fail to start). */
export async function canPlaceRoom(): Promise<boolean> {
  try {
    return !!(await navigator.xr?.isSessionSupported("immersive-ar"));
  } catch {
    return false;
  }
}

/** Starts the session. `overlay` is shown over the camera, and a pinch on it resizes the placed box. */
export async function startRoomSession(worldUrl: string, effect: WorldEffect, overlay: HTMLElement, onState: (state: RoomState) => void, { enterAutomatically = false }: RoomOptions = {}): Promise<RoomSession> {
  if (!navigator.xr) throw new Error("WebXR isn't available in this browser.");
  onState("starting");
  const session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: enterAutomatically ? [] : ["hit-test"],
    optionalFeatures: enterAutomatically ? ["dom-overlay", "hit-test"] : ["dom-overlay"],
    domOverlay: { root: overlay },
  });

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  renderer.domElement.style.display = "none";
  document.body.appendChild(renderer.domElement);
  await renderer.xr.setSession(session);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const { room, clip } = await loadStoryRoom(worldUrl, { effect });
  room.visible = false;
  scene.add(room);
  // The rain (or snow) plays round and round, from the moment the room stands in the space.
  const mixer = clip ? new THREE.AnimationMixer(room) : null;
  mixer?.clipAction(clip!).play();
  let last = 0;

  // Where the box's front will stand: a ring on the floor.
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.22, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.9 }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const viewer = await session.requestReferenceSpace("viewer");
  const hits = await session.requestHitTestSource?.({ space: viewer })?.catch(() => undefined);
  if (!hits && !enterAutomatically) throw new Error("This phone can't find the floor.");

  const enter = automaticRoomEntry(room, enterAutomatically);
  let placed = false;
  let floorY: number | null = null;
  const pinch = pinchToResize(overlay, room);
  const at = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const placeAtMarker = () => {
    if (placed || !reticle.visible) return;
    at.setFromMatrixPosition(reticle.matrix);
    renderer.xr.getCamera().getWorldPosition(eye);
    const toReader = new THREE.Vector3(eye.x - at.x, 0, eye.z - at.z).normalize();
    // The box's front goes where the reader tapped, square to them; the box stands behind it.
    room.rotation.y = Math.atan2(toReader.x, toReader.z);
    room.position.copy(at).addScaledVector(toReader, -ROOM.size / 2);
    room.position.y = at.y;
    room.visible = true;
    reticle.visible = false;
    placed = true;
    hits?.cancel();
    onState("placed");
  };
  session.addEventListener("select", placeAtMarker);

  onState("finding");
  let seen = false;
  renderer.setAnimationLoop((time, frame) => {
    if (placed) {
      mixer?.update(Math.min((time - last) / 1000, 0.1));
      updateStoryRoom(room, renderer.xr.getCamera());
    }
    last = time;
    if (frame && !placed) {
      const reference = renderer.xr.getReferenceSpace()!;
      const pose = hits ? frame.getHitTestResults(hits)
        .map((result) => result.getPose(reference))
        .find((candidate) => candidate && (enterAutomatically || candidate.transform.matrix[5]! > 0.9)) : undefined;
      // A valid tracked view is enough to enter. Use the measured floor when available; otherwise
      // stand the room at normal eye height instead of making the child aim at the floor first.
      if (enterAutomatically && frame.getViewerPose(reference)) {
        const trackedCamera = renderer.xr.getCamera();
        trackedCamera.getWorldPosition(eye);
        floorY = pose?.transform.position.y ?? eye.y - ROOM.eye;
        enter(trackedCamera, floorY);
        placed = true;
        reticle.visible = false;
        hits?.cancel();
        onState("placed");
      } else if (!enterAutomatically) {
        reticle.visible = !!pose;
        if (pose) {
          reticle.matrix.fromArray(pose.transform.matrix);
          floorY = pose.transform.position.y;
        }
        if (!!pose !== seen) onState(pose ? "ready" : "finding");
        seen = !!pose;
      }
    }
    renderer.render(scene, camera);
  });

  session.addEventListener("end", () => {
    renderer.setAnimationLoop(null);
    pinch.stop();
    mixer?.stopAllAction();
    disposeRoom(room);
    reticle.geometry.dispose();
    (reticle.material as THREE.Material).dispose();
    renderer.dispose();
    renderer.domElement.remove();
    onState("ended");
  });

  return {
    end: () => void session.end().catch(() => {}),
    placeAtMarker,
    // Straight into the box, wherever the reader stands, once the floor has been found.
    stepInside: () => {
      if (floorY === null) return;
      standAround(room, renderer.xr.getCamera(), floorY);
      if (placed) return;
      placed = true;
      reticle.visible = false;
      hits?.cancel();
      onState("placed");
    },
  };
}
