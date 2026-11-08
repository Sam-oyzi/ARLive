import assert from "node:assert/strict";
import { test } from "node:test";
import { bottomBadgeLift } from "./story-page";

test("an experience badge sits in the bottom corner when the words are elsewhere", () => {
  assert.equal(bottomBadgeLift(undefined, "right"), 0);
  // Words across the top of the page.
  assert.equal(bottomBadgeLift([{ left: 0.05, right: 0.95, top: 0.05, bottom: 0.3 }], "right"), 0);
  // Words in the bottom left corner leave the bottom right one free.
  assert.equal(bottomBadgeLift([{ left: 0.05, right: 0.4, top: 0.75, bottom: 0.95 }], "right"), 0);
});

test("it rises just above words that reach its corner, or moves up when they fill the lower half", () => {
  assert.equal(bottomBadgeLift([{ left: 0.05, right: 0.95, top: 0.75, bottom: 0.95 }], "right"), 0.25);
  assert.ok(Math.abs(bottomBadgeLift([{ left: 0.05, right: 0.95, top: 0.8, bottom: 0.95 }], "left")! - 0.2) < 1e-9);
  assert.equal(bottomBadgeLift([{ left: 0.05, right: 0.95, top: 0.3, bottom: 0.95 }], "right"), null);
});
