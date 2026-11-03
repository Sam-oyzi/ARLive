import assert from "node:assert/strict";
import { test } from "node:test";
import { clearFailures, isBlocked, recordFailure } from "./rate-limit";

const MINUTE = 60_000;

test("blocks at the limit, not before", () => {
  const key = "limit";
  for (let i = 0; i < 2; i++) recordFailure(key, MINUTE, 0);
  assert.equal(isBlocked(key, 3, 0), false);
  recordFailure(key, MINUTE, 0);
  assert.equal(isBlocked(key, 3, 0), true);
});

test("the block ends when the window does, and the count restarts", () => {
  const key = "window";
  for (let i = 0; i < 3; i++) recordFailure(key, MINUTE, 0);
  assert.equal(isBlocked(key, 3, MINUTE - 1), true);
  assert.equal(isBlocked(key, 3, MINUTE), false);
  recordFailure(key, MINUTE, MINUTE);
  assert.equal(isBlocked(key, 2, MINUTE), false);
});

test("a success clears the count", () => {
  const key = "clear";
  for (let i = 0; i < 3; i++) recordFailure(key, MINUTE, 0);
  clearFailures(key);
  assert.equal(isBlocked(key, 3, 0), false);
});

test("keys don't affect each other", () => {
  for (let i = 0; i < 3; i++) recordFailure("a", MINUTE, 0);
  assert.equal(isBlocked("b", 3, 0), false);
});
