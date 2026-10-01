// Local disk storage under ./storage/uploads, served by src/app/files/[...path]/route.ts.
// Every upload gets a fresh id, so URLs are immutable and safe to cache forever.
// To move to S3/R2, keep these signatures and swap the implementation.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";

export const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

export const UPLOAD_KINDS = {
  targets: { exts: ["jpg", "jpeg", "png", "webp"], maxMB: 15 },
  covers: { exts: ["jpg", "jpeg", "png", "webp"], maxMB: 10 },
  logos: { exts: ["jpg", "jpeg", "png", "webp", "svg"], maxMB: 5 },
  models: { exts: ["glb"], maxMB: 100 },
  videos: { exts: ["mp4", "webm", "mov"], maxMB: 200 },
  images: { exts: ["jpg", "jpeg", "png", "webp", "gif"], maxMB: 15 },
  audio: { exts: ["mp3", "m4a", "ogg", "wav"], maxMB: 50 },
  mind: { exts: ["mind"], maxMB: 100 },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export function isUploadKind(kind: string): kind is UploadKind {
  return Object.prototype.hasOwnProperty.call(UPLOAD_KINDS, kind);
}

export class UploadError extends Error {}

export function extensionOf(filename: string): string {
  return path.extname(filename).slice(1).toLowerCase();
}

/** Stream a request body to disk, enforcing the kind's extension and size rules. */
export async function saveUpload(
  kind: UploadKind,
  filename: string,
  body: ReadableStream<Uint8Array>,
): Promise<{ url: string; size: number }> {
  const rule = UPLOAD_KINDS[kind];
  const ext = extensionOf(filename);
  if (!(rule.exts as readonly string[]).includes(ext)) {
    throw new UploadError(`.${ext || "?"} files are not allowed here. Use ${rule.exts.join(", ")}.`);
  }
  const maxBytes = rule.maxMB * 1024 * 1024;
  const dir = path.join(UPLOAD_ROOT, kind);
  await fsp.mkdir(dir, { recursive: true });

  const name = `${randomUUID().replaceAll("-", "")}.${ext}`;
  const finalPath = path.join(dir, name);
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
    await fsp.rename(tempPath, finalPath);
  } catch (error) {
    await fsp.rm(tempPath, { force: true });
    throw error;
  }
  return { url: `/files/${kind}/${name}`, size };
}

/** Map a /files/... URL (or its path segments) to an absolute path, refusing traversal. */
export function resolveUploadPath(segments: string[]): string | null {
  if (segments.length !== 2) return null;
  const [kind, name] = segments;
  if (!isUploadKind(kind!) || !/^[a-z0-9]+\.[a-z0-9]+$/i.test(name!)) return null;
  return path.join(UPLOAD_ROOT, kind!, name!);
}

export async function deleteUpload(url: string | null | undefined) {
  if (!url?.startsWith("/files/")) return;
  const file = resolveUploadPath(url.slice("/files/".length).split("/"));
  if (file) await fsp.rm(file, { force: true }).catch(() => {});
}

export const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  glb: "model/gltf-binary",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mind: "application/octet-stream",
};
