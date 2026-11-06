import assert from "node:assert/strict";
import { test } from "node:test";
import { nearbyReaderPages, visibleReaderPages } from "./reader-pages";

test("both visible pages take priority over the previous spread on refresh", () => {
  assert.deepEqual(visibleReaderPages(8, 21), [7, 8]);
  assert.deepEqual(nearbyReaderPages([7, 8], 21), [7, 8, 6, 9, 5, 10]);
});

test("opening a book does not download the entire book or reload the front at the back", () => {
  assert.deepEqual(nearbyReaderPages(visibleReaderPages(0, 21), 21), [0, 1, 2]);
  assert.deepEqual(visibleReaderPages(8, 21, true), [8]);
  assert.deepEqual(visibleReaderPages(21, 21), []);
  assert.deepEqual(nearbyReaderPages([], 21), []);
});
