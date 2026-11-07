import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { checkbox, parseForm } from "./forms";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

test("an unticked checkbox is not sent, and reads as false", () => {
  const parsed = parseForm(z.object({ title: z.string(), featured: checkbox }), form({ title: "A book" }));
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.featured, false);
});

test("a ticked checkbox reads as true", () => {
  const parsed = parseForm(z.object({ featured: checkbox }), form({ featured: "on" }));
  assert.equal(parsed.data?.featured, true);
});
