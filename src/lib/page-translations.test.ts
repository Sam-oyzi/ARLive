import assert from "node:assert/strict";
import { test } from "node:test";
import { pageTranslationsSchema } from "./page-translations";
import { textScaleOf } from "./story-text";

test("a language can keep its own text position and size", () => {
  const parsed = pageTranslationsSchema.parse({ ar: { title: "صغيرٌ مثلي", story: "قالَ الأَسَدُ…", textPosition: "bottom", textScale: 1.2 } });
  assert.equal(parsed.ar?.textPosition, "bottom");
  assert.equal(parsed.ar?.textScale, 1.2);
});

test("without them, a language follows the original page", () => {
  const parsed = pageTranslationsSchema.parse({ fr: { title: "Le petit lion" } });
  assert.equal(parsed.fr?.textPosition, undefined);
  assert.equal(parsed.fr?.textScale, undefined);
});

test("sizes outside Studio's range and unknown positions are refused", () => {
  assert.equal(pageTranslationsSchema.safeParse({ ar: { title: "x", textScale: 3 } }).success, false);
  assert.equal(pageTranslationsSchema.safeParse({ ar: { title: "x", textPosition: "left" } }).success, false);
});

test("stored sizes are clamped to the range, and junk means 100%", () => {
  assert.equal(textScaleOf(1.25), 1.25);
  assert.equal(textScaleOf(9), 1.6);
  assert.equal(textScaleOf(0.1), 0.6);
  assert.equal(textScaleOf(undefined), 1);
  assert.equal(textScaleOf(Number.NaN), 1);
});
