import assert from "node:assert/strict";
import { test } from "node:test";
import { SCAN_ACTIONS, scanActionOf, worldExperienceOf, opensModel, placementModel, rendersOnTarget } from "./scan-actions";

test("existing world targets open a tracked box; only an explicit panorama choice opens 360", () => {
  assert.equal(worldExperienceOf("world", "/world.jpg"), "box");
  assert.equal(worldExperienceOf("panorama", "/world.jpg"), "panorama");
  assert.equal(worldExperienceOf("ar", "/world.jpg"), null);
  assert.equal(worldExperienceOf(undefined, "/world.jpg"), null);
});

test("the saved model engine controls launch even if a story texture is also saved", () => {
  for (const engine of ["quicklook", "eighthwall"]) {
    assert.equal(scanActionOf(engine), engine);
    assert.equal(opensModel(engine), true);
    assert.equal(rendersOnTarget(engine), false);
    assert.equal(worldExperienceOf(engine, "/world.jpg"), null);
  }
  assert.equal(rendersOnTarget("ar"), true);
  assert.equal(opensModel("ar"), false);
  assert.equal(opensModel("panorama"), false);
  assert.equal(rendersOnTarget("world"), false);
});

test("native placement opens the first usable 3D layer, skipping media and empty placeholders", () => {
  const lion = { type: "MODEL", url: "/lion.glb" };
  assert.equal(placementModel([{ type: "AUDIO", url: "/voice.mp3" }, { type: "MODEL", url: null }, lion, { type: "MODEL", url: "/owl.glb" }]), lion);
  assert.equal(placementModel([{ type: "TEXT3D", text: "  " }]), undefined);
});

test("missing art and invalid settings cannot enable a different experience", () => {
  for (const action of SCAN_ACTIONS) assert.equal(worldExperienceOf(action, null), null);
  assert.equal(scanActionOf("unrecognised"), "ar");
  assert.equal(scanActionOf("panorama"), "panorama");
});
