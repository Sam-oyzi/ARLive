import assert from "node:assert/strict";
import { test } from "node:test";
import { arTargets, canPublish, compileState, readableWhere, targetsSignature } from "./books";

const a = { id: "a", imageUrl: "/files/targets/a.jpg", ar: true };
const b = { id: "b", imageUrl: "/files/targets/b.jpg", ar: true };
const story = { id: "s", imageUrl: "/files/targets/s.jpg", ar: false };

test("the signature ignores page order but not page images", () => {
  assert.equal(targetsSignature([a, b]), targetsSignature([b, a]));
  assert.notEqual(targetsSignature([a, b]), targetsSignature([a, { ...b, imageUrl: "/files/targets/new.jpg" }]));
});

test("only AR pages are compiled", () => {
  assert.deepEqual(arTargets([a, story, b]), [a, b]);
});

test("compile state follows the pages", () => {
  const mindHash = targetsSignature([a, b]);
  const book = { mindUrl: "/files/mind/x.mind", mindHash };
  assert.equal(compileState({ mindUrl: null, mindHash: null }, [story]), "empty");
  assert.equal(compileState({ mindUrl: null, mindHash: null }, [a]), "missing");
  assert.equal(compileState(book, [a, b]), "ready");
  // Story pages can change freely without a recompile.
  assert.equal(compileState(book, [a, b, story]), "ready");
  assert.equal(compileState(book, [a]), "stale");
  assert.equal(compileState(book, [a, { ...b, imageUrl: "/files/targets/new.jpg" }]), "stale");
});

test("visitors only see published library books", () => {
  assert.deepEqual(readableWhere(null), { published: true, OR: [{ ownerId: null }] });
});

test("signed-in readers also see their own custom stories and their school's books", () => {
  assert.deepEqual(readableWhere({ id: "p1", role: "PARENT", schoolId: null }), {
    published: true,
    OR: [{ ownerId: null }, { ownerId: "p1" }],
  });
  assert.deepEqual(readableWhere({ id: "s1", role: "STUDENT", schoolId: "sc1" }), {
    published: true,
    OR: [{ ownerId: null }, { ownerId: "s1" }, { access: { some: { schoolId: "sc1" } } }],
  });
});

test("platform admins see every book, drafts included", () => {
  assert.deepEqual(readableWhere({ id: "a1", role: "SUPER_ADMIN", schoolId: null }), {});
});

test("a book can be published once it has pages, unless its AR pages were never compiled", () => {
  assert.equal(canPublish("empty", 0), false);
  assert.equal(canPublish("empty", 4), true);
  assert.equal(canPublish("ready", 4), true);
  assert.equal(canPublish("stale", 4), true);
  assert.equal(canPublish("missing", 4), false);
});
