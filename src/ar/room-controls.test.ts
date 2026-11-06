import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { automaticRoomEntry } from "./room-controls";

test("automatic entry waits for tracking, a floor estimate, and loaded artwork", () => {
  const room = new THREE.Group();
  room.visible = false;
  const camera = new THREE.PerspectiveCamera();
  const enter = automaticRoomEntry(room, true);
  assert.equal(enter(null, 0), false);
  assert.equal(enter(camera, null), false);
  assert.equal(enter(camera, 0, false), false);
  assert.equal(room.visible, false);
  assert.equal(enter(camera, 0, true), true);
  assert.equal(room.visible, true);
});

test("entry stands the room around the reader at life size and follows their heading", () => {
  const room = new THREE.Group();
  room.scale.setScalar(0.4);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(2, 1.8, -3);
  camera.rotation.y = Math.PI / 2;
  camera.updateMatrixWorld();
  assert.equal(automaticRoomEntry(room, true)(camera, 0.2), true);
  assert.deepEqual(room.position.toArray(), [2, 0.2, -3]);
  assert.deepEqual(room.scale.toArray(), [1, 1, 1]);
  assert.ok(Math.abs(room.rotation.y - Math.PI / 2) < 1e-6);
});

test("walking after entry leaves the room anchored in its original place", () => {
  const room = new THREE.Group();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(1, 1.6, 2);
  camera.updateMatrixWorld();
  const enter = automaticRoomEntry(room, true);
  assert.equal(enter(camera, 0), true);
  camera.position.set(4, 1.6, 5);
  camera.updateMatrixWorld();
  assert.equal(enter(camera, 0), false);
  assert.deepEqual(room.position.toArray(), [1, 0, 2]);
});

test("explicit manual box placement never enters automatically", () => {
  const room = new THREE.Group();
  room.visible = false;
  assert.equal(automaticRoomEntry(room, false)(new THREE.PerspectiveCamera(), 0), false);
  assert.equal(room.visible, false);
});
