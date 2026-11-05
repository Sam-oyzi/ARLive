import * as THREE from "three";

/** The same physical model size in Quick Look and 8th Wall, using the Studio scale. */
export function modelSizeMetres(scale: number): number {
  return THREE.MathUtils.clamp((Number.isFinite(scale) ? scale : 1) * 0.4, 0.05, 2);
}

/** Keep the original nodes intact so animation tracks still address the loaded model. */
export function normalisePlacementModel(model: THREE.Object3D, metres: number): THREE.Group {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longest) || longest <= 0) throw new Error("This 3D model is empty.");
  const centre = bounds.getCenter(new THREE.Vector3());
  const offset = new THREE.Group();
  offset.position.set(-centre.x, -bounds.min.y, -centre.z);
  offset.add(model);
  const placed = new THREE.Group();
  placed.scale.setScalar(metres / longest);
  placed.add(offset);
  return placed;
}

/** Anchor once after the engine reports tracking and the asset is ready. Later walking preserves it. */
export function automaticModelPlacement(holder: THREE.Object3D) {
  let placed = false;
  return (camera: THREE.Camera | null, tracking: boolean, ready: boolean): boolean => {
    if (placed || !camera || !tracking || !ready) return false;
    const eye = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldPosition(eye);
    camera.getWorldDirection(forward);
    const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const ray = new THREE.Ray(eye, forward);
    // Prefer the floor under the screen centre; otherwise put the model a metre ahead on the floor.
    if (!ray.intersectPlane(floor, hit) || hit.distanceTo(eye) > 3) {
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
      forward.normalize();
      hit.copy(eye).add(forward);
      hit.y = 0;
    }
    holder.position.copy(hit);
    holder.rotation.y = Math.atan2(eye.x - hit.x, eye.z - hit.z);
    holder.visible = true;
    placed = true;
    return true;
  };
}
