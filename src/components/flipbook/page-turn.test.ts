import assert from "node:assert/strict";
import { test } from "node:test";
import { completesPageTurn, pageTurnSpring } from "./page-turn";

test("a short deliberate pull completes a turn, without reaching halfway", () => {
  assert.equal(completesPageTurn(true, 4), true);
  assert.equal(completesPageTurn(true, 6), true);
  assert.equal(completesPageTurn(true, 195), true);
});

test("a tiny movement or a drag returned to its starting point does not turn", () => {
  for (const distance of [-40, 0, 1, 3]) assert.equal(completesPageTurn(true, distance), false);
});

test("a finger slipping back a little as it lifts still turns the page", () => {
  assert.equal(completesPageTurn(true, 22, 30), true);
  assert.equal(completesPageTurn(true, 70, 120), true);
});

test("bringing the page most of the way back puts it back", () => {
  assert.equal(completesPageTurn(true, 20, 120), false);
  assert.equal(completesPageTurn(true, 3, 30), false);
});

test("a browser cancellation finishes a clear pull, never a tiny one", () => {
  assert.equal(completesPageTurn(false, 40), true);
  assert.equal(completesPageTurn(false, 300), true);
  assert.equal(completesPageTurn(false, 10), false);
  assert.equal(completesPageTurn(false, 10, 200), false);
});

test("dropped frames do not stretch a page turn or leave its controls locked", () => {
  for (const from of [0, 0.15, 0.5, 0.9]) {
    const delayed = pageTurnSpring(from, 1, 800);
    assert.equal(delayed.finished, true);
    assert.ok(delayed.position > 0.998);
  }
  assert.equal(pageTurnSpring(0.6, 0, 800).finished, true);
});

test("the spring starts at the held position and advances by elapsed time", () => {
  assert.ok(Math.abs(pageTurnSpring(0.2, 1, 0).position - 0.2) < 1e-12);
  assert.equal(pageTurnSpring(0.2, 1, 300).finished, false);
  assert.ok(pageTurnSpring(0.2, 1, 600).position > pageTurnSpring(0.2, 1, 300).position);
  assert.equal(pageTurnSpring(0.8, 0, 0).position, 0.8);
});
