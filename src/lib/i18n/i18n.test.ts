import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOCALE, localeDir, localeFrom } from "./config";
import { categoryName, localizeMessage, messages } from "./messages";

test("the site speaks French until a visitor picks another language", () => {
  assert.equal(DEFAULT_LOCALE, "fr");
  assert.equal(localeFrom(undefined), "fr");
  assert.equal(localeFrom("de"), "fr");
  assert.equal(localeFrom("ar"), "ar");
  assert.equal(localeDir("ar"), "rtl");
  assert.equal(localeDir("fr"), "ltr");
});

test("Arabic counts follow Arabic grammar: dual, 3–10 plural, 11–99 accusative singular", () => {
  const count = messages.ar.library.count;
  assert.equal(count(0), "لا توجد قصص");
  assert.equal(count(1), "قصة واحدة");
  assert.equal(count(2), "قصتان");
  assert.equal(count(3), "3 قصص");
  assert.equal(count(10), "10 قصص");
  assert.equal(count(11), "11 قصةً");
  assert.equal(count(100), "100 قصة");
  // Western digits, even in Arabic.
  assert.equal(messages.ar.basket.summary(12, 2), "12 نسخةً · كتابان");
});

test("French counts 0 and 1 as singular", () => {
  assert.equal(messages.fr.library.count(0), "Aucune histoire");
  assert.equal(messages.fr.library.count(1), "1 histoire");
  assert.equal(messages.fr.library.count(2), "2 histoires");
  assert.equal(messages.fr.account.years(1), "1 an");
});

/** Every key path in a dictionary, so a missing translation shows up by name. */
function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, inner]) => keys(inner, prefix ? `${prefix}.${key}` : key));
}

test("French and Arabic have every word English has", () => {
  // Categories are the exception: English keeps the names saved in the studio.
  const reference = keys({ ...messages.en, categories: {} }).filter((key) => key !== "categories");
  for (const locale of ["fr", "ar"] as const) {
    const have = new Set(keys(messages[locale]));
    assert.deepEqual(reference.filter((key) => !have.has(key)), [], `${locale} is missing words`);
  }
});

test("built-in categories are translated, others keep their studio name", () => {
  assert.equal(categoryName(messages.fr, "animals", "Animal friends"), "Amis les animaux");
  assert.equal(categoryName(messages.ar, "bedtime", "Bedtime stories"), "قصص قبل النوم");
  assert.equal(categoryName(messages.ar, "robots", "Robots"), "Robots");
  assert.equal(categoryName(messages.en, "animals", "Animal friends"), "Animal friends");
});

test("the server's generic English messages reach the screen translated", () => {
  assert.equal(localizeMessage("Something went wrong. Please try again.", messages.ar), messages.ar.common.somethingWrong);
  assert.equal(localizeMessage("Profil enregistré", messages.fr), "Profil enregistré");
});
