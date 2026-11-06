// Run from the repository root. The SQL includes private records and stays in ignored output/.
// node scripts/export-cloudflare.mjs prisma/dev.db output/cloudflare-import
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";

const [source, destination] = process.argv.slice(2);
const outputRoot = path.resolve("output");
const destinationPath = destination && path.resolve(destination);
if (!source || !destinationPath?.startsWith(outputRoot + path.sep)) {
  throw new Error("Usage: node scripts/export-cloudflare.mjs <source.db> output/<new-directory>");
}
const uploadRoot = await realpath("storage/uploads");
const publicRoot = await realpath("public");
const d1Schema = await readFile("cloudflare/migrations/0001_initial.sql", "utf8");
const expectedTables = [...d1Schema.matchAll(/CREATE TABLE "([^"]+)"/g)].map((match) => match[1]);
const db = new DatabaseSync(path.resolve(source), { readOnly: true });
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const iso = (value) => new Date(value).toISOString().replace("Z", "+00:00");
const signature = (targets) => createHash("sha1").update(targets.map((target) => `${target.id}:${target.imageUrl}`).sort().join("|")).digest("hex");
const media = new Map();
const external = new Set();

function sqlValue(value) {
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (typeof value === "string") {
    if (value.includes("\0")) return `CAST(X'${Buffer.from(value).toString("hex")}' AS TEXT)`;
    return "'" + value.replaceAll("'", "''") + "'";
  }
  if (ArrayBuffer.isView(value)) return `X'${Buffer.from(value).toString("hex")}'`;
  throw new Error("Unsupported SQLite value in export.");
}

async function recordAsset(key, root, relative) {
  if (media.has(key)) {
    const existing = media.get(key);
    if (existing.root !== root || existing.source !== relative) throw new Error("Two assets have the same R2 key.");
    return;
  }
  const base = root === "public" ? publicRoot : uploadRoot;
  const file = await realpath(path.join(base, relative)).catch(() => null);
  if (!file || !file.startsWith(base + path.sep)) throw new Error(`A referenced ${root} asset is missing or outside the asset directory: ${relative}`);
  const details = await stat(file);
  if (!details.isFile()) throw new Error("Expected an asset file.");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  media.set(key, { key, root, source: relative, bytes: details.size, sha256: hash.digest("hex") });
}

async function rewriteAsset(url, kind) {
  if (typeof url !== "string" || !url) return url;
  if (!url.startsWith("/")) {
    external.add(url);
    return url;
  }
  if (url.startsWith("/files/")) {
    const key = url.slice("/files/".length);
    if (!/^[a-z]+\/[a-z0-9_-]+\.[a-z0-9]+$/i.test(key)) throw new Error("An upload URL has an invalid path.");
    await recordAsset(key, "uploads", key);
    return url;
  }
  const parsed = new URL(url, "https://pagewakes.com");
  if (parsed.origin !== "https://pagewakes.com") throw new Error("Unexpected external asset reference.");
  const relative = decodeURIComponent(parsed.pathname).slice(1);
  const extension = path.extname(relative).toLowerCase();
  const id = createHash("sha256").update(relative).digest("hex").slice(0, 32);
  const key = `${kind}/${id}${extension}`;
  await recordAsset(key, "public", relative);
  return `/files/${key}`;
}

const demoPasswords = {
  "admin@arlive.app": "admin1234",
  "parent@sketchling.app": "parent1234",
  "school@arlive.app": "school1234",
  student: "student123",
};
const report = { tables: {}, assets: 0, bytes: 0, externalAssetCount: 0, disabledDemoAccounts: 0, rotatedDemoSchoolCodes: 0, activeAdmins: 0 };
let rows;
let tableOrder;
try {
  db.exec("BEGIN");
  if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Fix existing foreign-key errors before exporting.");
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'").all().map(({ name }) => name);
  if (tables.length !== expectedTables.length || expectedTables.some((name) => !tables.includes(name))) {
    throw new Error("The source database does not match the app schema.");
  }
  tableOrder = [];
  while (tableOrder.length < tables.length) {
    const available = tables.filter((name) => !tableOrder.includes(name) &&
      db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all().every(({ table }) => table === name || tableOrder.includes(table)));
    if (!available.length) throw new Error("The source has a foreign-key cycle that needs a separate import.");
    tableOrder.push(...available);
  }
  rows = new Map(tableOrder.map((name) => {
    const columns = db.prepare(`PRAGMA table_info(${quote(name)})`).all();
    const select = columns.map(({ name, type }) => type.includes("JSON") ? `json(${quote(name)}) AS ${quote(name)}` : quote(name));
    const statement = db.prepare(`SELECT ${select.join(", ")} FROM ${quote(name)}`);
    statement.setReadBigInts(true);
    const data = statement.all();
    for (const row of data) for (const { name, type } of columns) {
      if (type === "DATETIME" && row[name] !== null) row[name] = iso(typeof row[name] === "bigint" ? Number(row[name]) : row[name]);
    }
    report.tables[name] = data.length;
    return [name, data];
  }));
  db.exec("COMMIT");
} finally {
  db.close();
}

for (const user of rows.get("User")) {
  if (Object.hasOwn(demoPasswords, user.username) && await bcrypt.compare(demoPasswords[user.username], user.passwordHash)) {
    user.active = 0;
    user.passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    user.passwordChangedAt = iso(Date.now());
    report.disabledDemoAccounts++;
  }
  if (user.active && user.role === "SUPER_ADMIN") report.activeAdmins++;
}
for (const school of rows.get("School")) {
  if (school.joinCode === "DEMO2026") {
    school.joinCode = randomBytes(8).toString("hex").toUpperCase();
    report.rotatedDemoSchoolCodes++;
  }
  school.logoUrl = await rewriteAsset(school.logoUrl, "logos");
}

const targets = rows.get("Target");
const originalSignatures = new Map(rows.get("Book").map(({ id }) => [id, signature(targets.filter((target) => target.bookId === id && target.ar))]));
for (const target of targets) {
  target.imageUrl = await rewriteAsset(target.imageUrl, "targets");
  target.narrationUrl = await rewriteAsset(target.narrationUrl, "audio");
  target.worldUrl = await rewriteAsset(target.worldUrl, "worlds");
  if (target.translations) {
    const translations = JSON.parse(target.translations);
    for (const translation of Object.values(translations ?? {})) {
      if (translation?.imageUrl) translation.imageUrl = await rewriteAsset(translation.imageUrl, "targets");
    }
    target.translations = JSON.stringify(translations);
  }
}
for (const book of rows.get("Book")) {
  book.coverUrl = await rewriteAsset(book.coverUrl, "covers");
  book.mindUrl = await rewriteAsset(book.mindUrl, "mind");
  if (book.mindHash === originalSignatures.get(book.id)) {
    book.mindHash = signature(targets.filter((target) => target.bookId === book.id && target.ar));
  }
}
const kindByType = { MODEL: "models", VIDEO: "videos", AUDIO: "audio", IMAGE: "images" };
for (const content of rows.get("Content")) content.url = await rewriteAsset(content.url, kindByType[content.type] ?? "images");
for (const sound of rows.get("PageSound")) sound.url = await rewriteAsset(sound.url, "audio");
for (const directory of await readdir(uploadRoot, { withFileTypes: true })) {
  if (!directory.isDirectory()) continue;
  for (const file of await readdir(path.join(uploadRoot, directory.name), { withFileTypes: true })) {
    if (file.isFile() && /^[a-z0-9_-]+\.[a-z0-9]+$/i.test(file.name)) {
      const key = `${directory.name}/${file.name}`;
      await recordAsset(key, "uploads", key);
    }
  }
}
const files = [...media.values()].sort((a, b) => a.key.localeCompare(b.key));
report.assets = files.length;
report.bytes = files.reduce((sum, entry) => sum + entry.bytes, 0);
report.externalAssetCount = external.size;
const inserts = tableOrder.flatMap((name) => rows.get(name).map((row) => `INSERT INTO ${quote(name)} (${Object.keys(row).map(quote).join(", ")}) VALUES (${Object.values(row).map(sqlValue).join(", ")});`));
await mkdir(outputRoot, { recursive: true });
await mkdir(destinationPath);
await writeFile(path.join(destinationPath, "data.sql"), inserts.join("\n") + "\n", { flag: "wx", mode: 0o600 });
await writeFile(path.join(destinationPath, "media.json"), JSON.stringify(files, null, 2) + "\n", { flag: "wx" });
await writeFile(path.join(destinationPath, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(report, null, 2));
