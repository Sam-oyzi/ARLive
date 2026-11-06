import { env } from "cloudflare:workers";
import { UPLOAD_KINDS, type UploadKind, extensionOf, UploadError, uploadKey, MIME_TYPES } from "../src/lib/upload-rules";
export * from "../src/lib/upload-rules";

const PART_BYTES = 8 * 1024 * 1024;

/** Keep upload memory bounded, even for video and model files. R2 stays private. */
export async function saveUpload<T extends object = Record<string, never>>(
  kind: UploadKind, filename: string, body: ReadableStream<Uint8Array>,
  _prepare?: (file: string) => Promise<T>,
) {
  const rule = UPLOAD_KINDS[kind];
  const ext = extensionOf(filename);
  if (!(rule.exts as readonly string[]).includes(ext)) {
    throw new UploadError(`.${ext || "?"} files are not allowed here. Use ${rule.exts.join(", ")}.`);
  }
  const key = `${kind}/${crypto.randomUUID().replaceAll("-", "")}.${ext}`;
  const upload = await env.MEDIA.createMultipartUpload(key, {
    httpMetadata: { contentType: MIME_TYPES[ext] ?? "application/octet-stream" },
  });
  const reader = body.getReader();
  const parts: { partNumber: number; etag: string }[] = [];
  let buffer = new Uint8Array(PART_BYTES);
  let offset = 0;
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > rule.maxMB * 1024 * 1024) throw new UploadError(`File is larger than ${rule.maxMB} MB.`);
      let cursor = 0;
      while (cursor < value.byteLength) {
        const length = Math.min(buffer.byteLength - offset, value.byteLength - cursor);
        buffer.set(value.subarray(cursor, cursor + length), offset);
        offset += length;
        cursor += length;
        if (offset === PART_BYTES) {
          parts.push(await upload.uploadPart(parts.length + 1, buffer));
          buffer = new Uint8Array(PART_BYTES);
          offset = 0;
        }
      }
    }
    if (!size) throw new UploadError("The file is empty.");
    if (offset) parts.push(await upload.uploadPart(parts.length + 1, buffer.subarray(0, offset)));
    await upload.complete(parts);
    return { metadata: undefined as T | undefined, url: `/files/${key}`, size };
  } catch (error) {
    await reader.cancel().catch(() => {});
    await upload.abort().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function openUpload(segments: string[]) {
  const key = uploadKey(segments);
  if (!key) return null;
  const head = await env.MEDIA.head(key);
  if (!head) return null;
  return {
    size: head.size,
    async read(range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array>> {
      const object = await env.MEDIA.get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
      if (!object) throw new Error("The uploaded file is no longer available.");
      return object.body;
    },
  };
}

export async function deleteUpload(url: string | null | undefined) {
  if (!url?.startsWith("/files/")) return;
  const key = uploadKey(url.slice(7).split("/"));
  if (key) await env.MEDIA.delete(key);
}
