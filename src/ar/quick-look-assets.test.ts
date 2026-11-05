import assert from "node:assert/strict";
import { resolveObjectURL } from "node:buffer";
import { test } from "node:test";
import { QuickLookAssets } from "./quick-look-assets";
import type { ContentData } from "@/lib/content";

const model = { id: "lion", type: "MODEL", url: "/lion.glb", scale: 0.6, autoplay: true } as ContentData;

test("Quick Look reuses prewarmed USDZ and revokes it when the scanner closes", async () => {
  let built = 0;
  const assets = new QuickLookAssets(async () => { built++; return new Blob(["usdz"]); });
  const first = assets.prepare(model);
  assert.equal(assets.prepare(model), first);
  const url = await first;
  assert.equal(built, 1);
  assert.ok(resolveObjectURL(url));
  assets.dispose();
  assert.equal(resolveObjectURL(url), undefined);
  await assert.rejects(assets.prepare(model), /closed/);
});

test("failed preparation can be retried; changing the model or scale rebuilds its USDZ", async () => {
  let attempts = 0;
  const assets = new QuickLookAssets(async () => {
    if (++attempts === 1) throw new Error("network");
    return new Blob(["usdz"]);
  });
  await assert.rejects(assets.prepare(model), /network/);
  const url = await assets.prepare(model);
  assert.notEqual(await assets.prepare({ ...model, scale: 1.2 }), url);
  assert.equal(attempts, 3);
  assets.dispose();
});

test("closing during export never creates an orphaned native asset", async () => {
  let finish!: (blob: Blob) => void;
  const assets = new QuickLookAssets(() => new Promise((resolve) => { finish = resolve; }));
  const pending = assets.prepare(model);
  assets.dispose();
  finish(new Blob(["usdz"]));
  await assert.rejects(pending, /closed/);
});
