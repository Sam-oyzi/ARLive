import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { automaticModelPlacement, modelSizeMetres, normalisePlacementModel } from "./model-placement";

test("native and 8th Wall models share Studio scale, centred with feet on the floor", () => {
  const model = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2));
  model.position.set(3, 5, -2);
  const result = normalisePlacementModel(model, modelSizeMetres(0.625));
  const bounds = new THREE.Box3().setFromObject(result);
  assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).y - 0.25) < 1e-6);
  assert.ok(Math.abs(bounds.min.y) < 1e-6);
  assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x) < 1e-6);
  assert.deepEqual(model.position.toArray(), [3, 5, -2]); // animation nodes retain their own transforms
});

test("invalid model bounds fail clearly; physical sizes stay within usable limits", () => {
  assert.throws(() => normalisePlacementModel(new THREE.Group(), 0.3), /empty/);
  assert.equal(modelSizeMetres(Number.NaN), 0.4);
  assert.equal(modelSizeMetres(0), 0.05);
  assert.equal(modelSizeMetres(1000), 2);
});

test("automatic placement waits for tracking and an asset, then stays anchored while the reader walks", () => {
  const holder = new THREE.Group();
  holder.visible = false;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(1, 1.5, 2);
  camera.updateMatrixWorld();
  const place = automaticModelPlacement(holder);
  assert.equal(place(null, true, true), false);
  assert.equal(place(camera, false, true), false);
  assert.equal(place(camera, true, false), false);
  assert.equal(holder.visible, false);
  assert.equal(place(camera, true, true), true);
  assert.deepEqual(holder.position.toArray(), [1, 0, 1]);
  camera.position.set(8, 1.5, -3);
  camera.updateMatrixWorld();
  assert.equal(place(camera, true, true), false);
  assert.deepEqual(holder.position.toArray(), [1, 0, 1]);
});
