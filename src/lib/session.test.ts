import assert from "node:assert/strict";
import { test } from "node:test";
import { isRevoked, signHandoff, signSession, verifyHandoff, verifySession } from "./session";

process.env.SESSION_SECRET = "test-secret-at-least-sixteen-characters";

const payload = { uid: "u1", role: "STUDENT" as const, schoolId: "s1" };

test("a session round-trips and says when it was issued", async () => {
  const before = Math.floor(Date.now() / 1000);
  const session = await verifySession(await signSession(payload));
  assert.equal(session?.uid, "u1");
  assert.equal(session?.role, "STUDENT");
  assert.ok(session!.issuedAt >= before);
});

test("a handoff token can't be used as a session, nor the reverse", async () => {
  const handoff = await signHandoff("u1", "/scan/b1");
  assert.equal(await verifySession(handoff), null);
  assert.equal(await verifyHandoff(await signSession(payload)), null);
  assert.deepEqual((await verifyHandoff(handoff))?.path, "/scan/b1");
});

test("tampered and missing tokens are rejected", async () => {
  const token = await signSession(payload);
  assert.equal(await verifySession(`${token.slice(0, -2)}xx`), null);
  assert.equal(await verifySession(undefined), null);
  assert.equal(await verifyHandoff(null), null);
});

test("only tokens from before the password change are revoked", () => {
  const changedAt = new Date(1_000_000_500); // 1,000,000.5 s
  assert.equal(isRevoked(999_999, changedAt), true);
  // Re-issued in the same second as the change: the device that made the change stays signed in.
  assert.equal(isRevoked(1_000_000, changedAt), false);
  assert.equal(isRevoked(1_000_001, changedAt), false);
  assert.equal(isRevoked(0, null), false);
});
