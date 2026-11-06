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

test("browser cancellations never finish a turn", () => {
  assert.equal(completesPageTurn(false, 40), false);
  assert.equal(completesPageTurn(false, 300), false);
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
