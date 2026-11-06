import assert from "node:assert/strict";
import { test } from "node:test";
import { crossfadeFor, DUCKED, soundLevel } from "./page-sound";

test("long sounds crossfade for 2.5 s, short ones for a quarter of their length", () => {
  assert.equal(crossfadeFor(60), 2.5);
  assert.equal(crossfadeFor(4), 1);
});

test("muting wins over ducking, and ducking keeps the background under a voice", () => {
  assert.equal(soundLevel(0.7, { muted: false, ducked: false }), 0.7);
  assert.equal(soundLevel(0.7, { muted: false, ducked: true }), 0.7 * DUCKED);
  assert.equal(soundLevel(0.7, { muted: true, ducked: true }), 0);
});
