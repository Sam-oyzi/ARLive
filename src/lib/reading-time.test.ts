import assert from "node:assert/strict";
import { test } from "node:test";
import { countWords, isReadingSpeed, readingSeconds } from "./reading-time";

test("counts words in any language, with contractions and hyphens as one", () => {
  assert.equal(countWords("“Perhaps your roar isn’t lost,” Owl said."), 7);
  assert.equal(countWords("Plip. Plop. “Help?”"), 3);
  assert.equal(countWords("Le petit lion s’est réveillé."), 5);
  assert.equal(countWords("well-known"), 1);
  assert.equal(countWords(""), 0);
});

test("a page takes its picture time plus its words at the child's pace", () => {
  // 14 words at 70 a minute = 12 s, 2 sentences = 0.8 s, picture = 4 s.
  const story = "One little tortoise waited by the river. The stepping stones were gone, all gone.";
  assert.equal(readingSeconds([story], "normal"), 16.8);
  assert.ok(readingSeconds([story], "slow") > readingSeconds([story], "normal"));
  assert.ok(readingSeconds([story], "fast") < readingSeconds([story], "normal"));
});

test("a spread adds both pages, and picture-only pages still get a moment", () => {
  assert.equal(readingSeconds([null], "normal"), 5);
  assert.equal(readingSeconds([null, ""], "normal"), 8);
  const one = readingSeconds(["The sun rose."], "normal");
  assert.ok(readingSeconds(["The sun rose.", "The sun rose."], "normal") > one);
});

test("very long pages are capped at two minutes", () => {
  assert.equal(readingSeconds(["word ".repeat(1000)], "slow"), 120);
});

test("only known speeds are accepted from storage", () => {
  assert.equal(isReadingSpeed("fast"), true);
  assert.equal(isReadingSpeed("toString"), false);
  assert.equal(isReadingSpeed(3), false);
});
