import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyCells, emptyRects, parseStory, plainStory, shrinkMask, textPositionOf } from "./story-text";

test("each line of the story is a line on the page", () => {
  assert.deepEqual(parseStory("He can go\nlike a bee."), [[{ text: "He can go", sound: false }], [{ text: "like a bee.", sound: false }]]);
});

test("*stars* mark sound words, and a lone star stays", () => {
  assert.deepEqual(parseStory("Lou goes *Splish splash!* in the sea"), [
    [
      { text: "Lou goes ", sound: false },
      { text: "Splish splash!", sound: true },
      { text: " in the sea", sound: false },
    ],
  ]);
  assert.deepEqual(parseStory("5 * 3"), [[{ text: "5 * 3", sound: false }]]);
});

test("blank lines become one gap, never at the start or end", () => {
  assert.deepEqual(parseStory("\n\nOne\n\n\n\nTwo\n\n"), [[{ text: "One", sound: false }], [], [{ text: "Two", sound: false }]]);
});

test("plain text drops the markup", () => {
  assert.equal(plainStory("Mr. Brown can *BUZZ*"), "Mr. Brown can BUZZ");
});

test("unknown positions fall back to automatic", () => {
  assert.equal(textPositionOf("bottom"), "bottom");
  assert.equal(textPositionOf("toString"), "auto");
  assert.equal(textPositionOf(null), "auto");
});

test("only light cells without ink can carry words", () => {
  const light = [[0.9, 0.9, 0.4], [0.9, 0.9, 0.9]];
  const contrast = [[0.02, 0.3, 0.02], [0.05, 0.05, 0.05]];
  assert.deepEqual(emptyCells(light, contrast), [[true, false, false], [true, true, true]]);
});

test("a margin is kept round the drawing, but not round the page edge", () => {
  const T = true;
  const F = false;
  const mask = [
    [T, T, T, T],
    [T, T, T, T],
    [T, T, T, F],
    [T, T, T, T],
  ];
  assert.deepEqual(shrinkMask(mask), [
    [T, T, T, T],
    [T, T, F, F],
    [T, T, F, F],
    [T, T, F, F],
  ]);
});

test("the largest empty rectangle comes first", () => {
  const T = true;
  const F = false;
  // An empty band across the top, the drawing below, and a small empty corner.
  const mask = [
    [T, T, T, T, T, T],
    [T, T, T, T, T, T],
    [F, F, F, F, F, F],
    [F, F, F, F, T, T],
  ];
  assert.deepEqual(emptyRects(mask)[0], { top: 0, left: 0, bottom: 2, right: 6 });
  assert.ok(emptyRects(mask).some((r) => r.top === 3 && r.left === 4 && r.right === 6));
});

test("a page full of drawing has no empty rectangle", () => {
  assert.deepEqual(emptyRects([[false, false], [false, false]]), []);
});
