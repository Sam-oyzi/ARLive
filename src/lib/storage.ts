// Local uploads. The Cloudflare build selects cloudflare/storage.ts for private R2.
// Every upload gets a fresh id, so URLs are immutable and safe to cache forever.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

export const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

import { UPLOAD_KINDS, type UploadKind, extensionOf, UploadError, uploadKey, MIME_TYPES } from "./upload-rules";
export * from "./upload-rules";

/** Validate and prepare the file before giving its immutable URL to the caller. */
export async function saveUpload<T extends object = Record<string, never>>(
  kind: UploadKind,
  filename: string,
  body: ReadableStream<Uint8Array>,
  prepare?: (file: string) => Promise<T>,
) {
  const rule = UPLOAD_KINDS[kind];
  const ext = extensionOf(filename);
  if (!(rule.exts as readonly string[]).includes(ext)) {
    throw new UploadError(`.${ext || "?"} files are not allowed here. Use ${rule.exts.join(", ")}.`);
  }
  const maxBytes = rule.maxMB * 1024 * 1024;
  const dir = path.join(UPLOAD_ROOT, kind);
  await fsp.mkdir(dir, { recursive: true });

  const name = `${randomUUID().replaceAll("-", "")}.${ext}`;
  const finalPath = path.join(/* turbopackIgnore: true */ dir, name);
  const tempPath = `${finalPath}.part`;
  let size = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length;
      if (size > maxBytes) done(new UploadError(`File is larger than ${rule.maxMB} MB.`));
      else done(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(body as import("node:stream/web").ReadableStream), limiter, fs.createWriteStream(tempPath));
    if (size === 0) throw new UploadError("The file is empty.");
    const metadata = await prepare?.(tempPath);
    const preparedSize = (await fsp.stat(tempPath)).size;
    await fsp.rename(tempPath, finalPath);
    return { metadata, url: `/files/${kind}/${name}`, size: preparedSize };
  } finally {
    await fsp.rm(tempPath, { force: true });
  }
}

/** Map a /files/... URL (or its path segments) to an absolute path, refusing traversal. */
export function resolveUploadPath(segments: string[]): string | null {
  const key = uploadKey(segments);
  return key && path.join(UPLOAD_ROOT, key);
}

export async function openUpload(segments: string[]) {
  const key = uploadKey(segments);
  if (!key) return null;
  const file = path.join(UPLOAD_ROOT, key);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat?.isFile()) return null;
  return {
    size: stat.size,
    async read(range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array>> {
      return Readable.toWeb(fs.createReadStream(file, range)) as ReadableStream<Uint8Array>;
    },
  };
}

export async function deleteUpload(url: string | null | undefined) {
  if (!url?.startsWith("/files/")) return;
  const key = uploadKey(url.slice("/files/".length).split("/"));
  if (!key) return;
  await fsp.rm(path.join(UPLOAD_ROOT, key), { force: true }).catch(() => {});
}
