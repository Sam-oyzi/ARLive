import assert from "node:assert/strict";
import { test } from "node:test";
import { soundKindOf, soundtrackFor } from "./sound-layers";

const pages = [{ soundtrack: ["music"] }, { soundtrack: [] }, { soundtrack: ["music", "brook"] }, { soundtrack: [] }, { soundtrack: [] }];

test("a soundtrack plays from its page until a later page sets its own", () => {
  assert.deepEqual(soundtrackFor(pages, [0]), ["music"]);
  assert.deepEqual(soundtrackFor(pages, [1]), ["music"]);
  assert.deepEqual(soundtrackFor(pages, [2]), ["music", "brook"]);
  assert.deepEqual(soundtrackFor(pages, [4]), ["music", "brook"]);
});

test("a spread follows its later page, and the back cover keeps the last one", () => {
  assert.deepEqual(soundtrackFor(pages, [1, 2]), ["music", "brook"]);
  assert.deepEqual(soundtrackFor(pages, []), []);
  assert.deepEqual(soundtrackFor(pages, [9]), ["music", "brook"]);
});

test("pages before any soundtrack stay quiet", () => {
  assert.deepEqual(soundtrackFor([{ soundtrack: [] }, { soundtrack: ["music"] }], [0]), []);
});

test("unknown kinds are scene sounds", () => {
  assert.equal(soundKindOf("reading"), "reading");
  assert.equal(soundKindOf("anything"), "scene");
});
