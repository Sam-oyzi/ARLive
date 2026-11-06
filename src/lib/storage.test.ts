import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { extensionOf, isUploadKind, resolveUploadPath, UPLOAD_ROOT } from "./storage";

test("resolves a normal upload inside the upload folder", () => {
  assert.equal(resolveUploadPath(["targets", "abc123.jpg"]), path.join(UPLOAD_ROOT, "targets", "abc123.jpg"));
});

test("refuses anything that could leave the upload folder", () => {
  const attempts = [
    ["targets", "../../.env"],
    ["..", "secret.jpg"],
    ["targets", ".."],
    ["targets", "a/b.jpg"],
    ["targets", "a\\b.jpg"],
    ["targets", "abc.jpg", "extra"],
    ["targets"],
    ["unknown", "abc.jpg"],
    // Half-written uploads are never served.
    ["targets", "abc.jpg.part"],
  ];
  for (const segments of attempts) assert.equal(resolveUploadPath(segments), null, segments.join("/"));
});

test("inherited object keys aren't upload kinds", () => {
  assert.equal(isUploadKind("constructor"), false);
  assert.equal(isUploadKind("__proto__"), false);
  assert.equal(isUploadKind("models"), true);
});

test("extensions are lower-cased", () => {
  assert.equal(extensionOf("Heart.GLB"), "glb");
  assert.equal(extensionOf("noextension"), "");
});
