import assert from "node:assert/strict";
import { test } from "node:test";
import { bookReturnHref, readerHref, readerPageIndex, withReturnTo } from "./reader-navigation";

test("the scanner and phone handoff retain the exact reader page and language", () => {
  for (const lang of ["", "fr", "ar"]) {
    const origin = readerHref("sarra", "page-eight", lang);
    const scanner = withReturnTo("/scan/sarra", origin);
    const phone = new URL(scanner, "https://pagewakes.com");
    const returned = bookReturnHref("sarra", phone.searchParams.get("returnTo"), "/library/sarra");
    assert.equal(returned, origin);
    const query = new URL(returned, phone.origin).searchParams;
    assert.equal(readerPageIndex(["page-one", "page-eight"], query.get("page")), 1);
    assert.equal(query.get("lang") ?? "", lang);
  }
});

test("scanning returns to the originating school card, subject or Studio page", () => {
  for (const origin of ["/school#book-sarra", "/school/catalog#book-sarra", "/learn/animals#book-sarra", "/learn#scan-recent", "/admin/books/sarra/targets/page-eight"]) {
    assert.equal(bookReturnHref("sarra", origin, "/library/sarra"), origin);
  }
});

test("return URLs cannot leave the site, switch books or open unrelated admin pages", () => {
  for (const origin of ["https://evil.test/read/sarra", "//evil.test", "/\\evil.test", "/read/another-book?page=page-eight", "/admin/users", "/school/students", "/read/sarra/../other"]) {
    assert.equal(bookReturnHref("sarra", origin, "/library/sarra"), "/library/sarra");
  }
  assert.equal(readerPageIndex(["one", "two"], "back-cover"), 2);
  assert.equal(readerPageIndex(["one", "two"], "missing"), 0);
});
