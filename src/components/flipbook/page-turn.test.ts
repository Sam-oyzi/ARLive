import assert from "node:assert/strict";
import { test } from "node:test";
import { completesPageTurn } from "./page-turn";

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
