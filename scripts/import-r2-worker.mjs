// Authenticates using the existing Wrangler login. No separate R2 keys are needed.
import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { accountId, cloudflareApi } from "./cloudflare-api.mjs";

const [manifestPath, flag] = process.argv.slice(2);
if (!manifestPath || (flag && flag !== "--apply")) throw new Error("Usage: node scripts/import-r2-worker.mjs <media.json> [--apply]");
const entries = JSON.parse(await readFile(manifestPath, "utf8"));
const roots = { public: await realpath("public"), uploads: await realpath("storage/uploads") };
const sha = (data) => createHash("sha256").update(data).digest("hex");
const seen = new Set();
const validated = [];
for (const entry of entries) {
  if (!/^(targets|covers|logos|models|videos|images|audio|worlds|mind)\/[a-z0-9_-]+\.[a-z0-9]+$/i.test(entry.key) || seen.has(entry.key)) throw new Error("Invalid or duplicate media key.");
  seen.add(entry.key);
  const root = roots[entry.root];
  if (!root) throw new Error("Invalid media root.");
  const absolute = await realpath(path.join(root, entry.source));
  if (!absolute.startsWith(root + path.sep)) throw new Error("Media path is outside the source directory.");
  if ((await stat(absolute)).size !== entry.bytes || sha(await readFile(absolute)) !== entry.sha256) throw new Error("Media changed since export.");
  validated.push({ ...entry, absolute });
}
if (flag !== "--apply") { console.log(`Verified ${validated.length} source files.`); process.exit(0); }
const types = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", glb: "model/gltf-binary", mp3: "audio/mpeg", wav: "audio/wav", svg: "image/svg+xml", mp4: "video/mp4" };
let cursor = 0, verified = 0, uploaded = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  for (;;) {
    const entry = validated[cursor++];
    if (!entry) return;
    const endpoint = `/accounts/${accountId}/r2/buckets/pagewakes-media/objects/${entry.key}`;
    let response = await cloudflareApi(endpoint);
    if (response.status === 404) {
      response = await cloudflareApi(endpoint, { method: "PUT", body: await readFile(entry.absolute), headers: {
        "Content-Type": types[entry.key.split(".").pop()] ?? "application/octet-stream",
      } });
      await response.arrayBuffer();
      uploaded++;
      response = await cloudflareApi(endpoint);
    }
    if (!response.ok || sha(Buffer.from(await response.arrayBuffer())) !== entry.sha256) throw new Error("R2 verification failed or destination has different contents.");
    verified++;
    if (verified % 20 === 0) console.log(`Verified ${verified}/${validated.length} R2 objects.`);
  }
}));
console.log(`Verified all ${verified} R2 objects by SHA-256, including ${uploaded} new uploads.`);
