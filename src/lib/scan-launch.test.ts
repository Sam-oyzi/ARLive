import assert from "node:assert/strict";
import { test } from "node:test";
import { ScanLaunchGate } from "./scan-launch";

test("recognition immediately launches one selected viewer, including with simultaneous targets", () => {
  const gate = new ScanLaunchGate();
  assert.equal(gate.found("lion", true), "launch");
  assert.equal(gate.found("owl", true), "ignore");
  assert.equal(gate.found("bird", false), "ignore");
});

test("returning to the same printed page avoids a loop; moving away and rescanning launches directly again", () => {
  const gate = new ScanLaunchGate();
  gate.found("lion", true);
  gate.lost("lion"); // stale loss while the camera is handed over must not re-arm the target
  gate.resumeScanning();
  assert.equal(gate.found("lion", true), "resume");
  gate.lost("lion");
  assert.equal(gate.found("lion", true), "launch");
});

test("a different page also re-arms the previous model", () => {
  const gate = new ScanLaunchGate();
  gate.found("lion", true);
  gate.resumeScanning();
  assert.equal(gate.found("bird", false), "content");
  assert.equal(gate.found("lion", true), "launch");
});
