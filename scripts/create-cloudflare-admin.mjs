// One-time owner setup. Generated credentials stay in the ignored output directory.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { accountId, cloudflareApi } from "./cloudflare-api.mjs";
const username = process.argv[2];
if (!username || !username.includes("@")) throw new Error("Provide the owner's email address.");
const endpoint = `/accounts/${accountId}/d1/database/a7199e97-e0f4-4c1b-894d-074bb7650290/query`;
async function query(sql, params) {
  const response = await cloudflareApi(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql, params }) });
  const payload = await response.json();
  if (!payload.success || !payload.result?.[0]?.success) throw new Error("Admin setup could not be confirmed.");
  return payload.result[0];
}
const existing = await query('SELECT id FROM "User" WHERE username = ?', [username.toLowerCase()]);
if (existing.results.length) throw new Error("This username already exists. Manage its permissions through the app.");
const password = randomBytes(24).toString("base64url");
const now = new Date().toISOString().replace("Z", "+00:00");
await query('INSERT INTO "User" (id, name, username, passwordHash, role, active, createdAt, updatedAt, passwordChangedAt) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)', [
  randomUUID(), "PageWakes Admin", username.toLowerCase(), await bcrypt.hash(password, 12), "SUPER_ADMIN", now, now, now,
]);
await mkdir("output/cloudflare-live", { recursive: true });
await writeFile("output/cloudflare-live/admin-access.txt", `PageWakes admin\nhttps://pagewakes.com/login\nEmail: ${username.toLowerCase()}\nPassword: ${password}\nKeep this file private.\n`, { flag: "wx" });
console.log("Production admin created. Credentials saved privately in output/cloudflare-live/admin-access.txt.");
