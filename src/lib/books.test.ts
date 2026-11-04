import assert from "node:assert/strict";
import { test } from "node:test";
import { accessState, arTargets, canPublish, compileState, readableWhere, targetsSignature } from "./books";

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

const parent = { id: "p1", role: "PARENT", schoolId: null, username: "sara@example.com" };

test("visitors only see public library books", () => {
  assert.deepEqual(readableWhere(null), { published: true, OR: [{ ownerId: null, visibility: "PUBLIC" }] });
});

test("signed-in readers also see members' books, books they're approved for and their school's books", () => {
  assert.deepEqual(readableWhere(parent), {
    published: true,
    OR: [
      { ownerId: null, visibility: "PUBLIC" },
      { ownerId: null, visibility: "MEMBERS" },
      { readers: { some: { email: "sara@example.com", status: "APPROVED" } } },
    ],
  });
  const student = { id: "s1", role: "STUDENT", schoolId: "sc1", username: "sami" };
  assert.deepEqual(readableWhere(student).OR?.at(-1), { access: { some: { schoolId: "sc1" } } });
});

test("platform admins see every book, drafts included", () => {
  assert.deepEqual(readableWhere({ id: "a1", role: "SUPER_ADMIN", schoolId: null, username: "admin@example.com" }), {});
});

test("access to one book follows its visibility and the reader's approval", () => {
  const open = { visibility: "PUBLIC", ownerId: null };
  const members = { visibility: "MEMBERS", ownerId: null };
  const approved = { visibility: "APPROVED", ownerId: null };
  assert.equal(accessState(open, null, null), "open");
  assert.equal(accessState(members, null, null), "sign-in");
  assert.equal(accessState(members, parent, null), "open");
  assert.equal(accessState(approved, parent, null), "request");
  assert.equal(accessState(approved, parent, { status: "PENDING" }), "pending");
  assert.equal(accessState(approved, parent, { status: "DECLINED" }), "declined");
  assert.equal(accessState(approved, parent, { status: "APPROVED" }), "open");
});

test("a custom story only opens for approved emails, even when marked public", () => {
  const story = { visibility: "PUBLIC", ownerId: "p1" };
  assert.equal(accessState(story, null, null), "sign-in");
  assert.equal(accessState(story, parent, null), "request");
  assert.equal(accessState(story, parent, { status: "APPROVED" }), "open");
});

test("a book can be published once it has pages, unless its AR pages were never compiled", () => {
  assert.equal(canPublish("empty", 0), false);
  assert.equal(canPublish("empty", 4), true);
  assert.equal(canPublish("ready", 4), true);
  assert.equal(canPublish("stale", 4), true);
  assert.equal(canPublish("missing", 4), false);
});
