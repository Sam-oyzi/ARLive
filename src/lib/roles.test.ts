import assert from "node:assert/strict";
import { test } from "node:test";
import { afterLoginPath, homeFor, isPublicPath, needsSchool, rolesForPath } from "./roles";

test("follows ?next= into pages the role can open", () => {
  assert.equal(afterLoginPath("STUDENT", "/read/abc"), "/read/abc");
  assert.equal(afterLoginPath("STUDENT", "/scan/abc?x=1"), "/scan/abc?x=1");
  assert.equal(afterLoginPath("STUDENT", "/learn/chemistry"), "/learn/chemistry");
  assert.equal(afterLoginPath("SCHOOL_ADMIN", "/read/abc"), "/read/abc");
  assert.equal(afterLoginPath("SUPER_ADMIN", "/print/abc"), "/print/abc");
  assert.equal(afterLoginPath("SUPER_ADMIN", "/admin/books"), "/admin/books");
  assert.equal(afterLoginPath("PARENT", "/account"), "/account");
});

test("follows ?next= back to public library pages for every role", () => {
  assert.equal(afterLoginPath("PARENT", "/library/abc"), "/library/abc");
  assert.equal(afterLoginPath("PARENT", "/stories?child=1"), "/stories?child=1");
  assert.equal(afterLoginPath("STUDENT", "/library"), "/library");
  assert.equal(afterLoginPath("PARENT", "/basket"), "/basket");
  assert.equal(isPublicPath("/"), true);
  assert.equal(isPublicPath("/libraryx"), false);
});

test("goes home instead of into another role's area", () => {
  assert.equal(afterLoginPath("STUDENT", "/admin"), "/learn");
  assert.equal(afterLoginPath("SCHOOL_ADMIN", "/learn"), "/school");
  assert.equal(afterLoginPath("PARENT", "/admin/stories"), "/account");
  assert.equal(afterLoginPath("STUDENT", "/account"), "/learn");
});

test("never redirects off the site", () => {
  for (const next of ["//evil.example", "/\\evil.example", "https://evil.example", "/scan\\..\\evil", "evil", "", null, undefined, 42]) {
    assert.equal(afterLoginPath("STUDENT", next), "/learn", String(next));
  }
});

test("matches whole path segments and ignores unknown paths", () => {
  assert.equal(afterLoginPath("STUDENT", "/learned"), "/learn");
  assert.equal(afterLoginPath("STUDENT", "/nowhere"), "/learn");
  assert.equal(rolesForPath("/administrator"), undefined);
  assert.deepEqual(rolesForPath("/admin/books"), ["SUPER_ADMIN"]);
});

test("only school roles belong to a school", () => {
  assert.equal(needsSchool("STUDENT"), true);
  assert.equal(needsSchool("SCHOOL_ADMIN"), true);
  assert.equal(needsSchool("PARENT"), false);
  assert.equal(needsSchool("SUPER_ADMIN"), false);
});

test("an unknown role falls back to the student home", () => {
  assert.equal(homeFor("NOPE"), "/learn");
  assert.equal(afterLoginPath("NOPE", "/learn"), "/learn");
});

test("only admins open print files; readers order printed copies from the basket", () => {
  assert.deepEqual(rolesForPath("/print/abc"), ["SUPER_ADMIN"]);
  assert.equal(isPublicPath("/print/abc"), false);
  assert.equal(afterLoginPath("PARENT", "/print/abc"), "/account");
  assert.equal(isPublicPath("/basket"), true);
});
