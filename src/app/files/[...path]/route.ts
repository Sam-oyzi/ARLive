import type { NextRequest } from "next/server";
import { extensionOf, MIME_TYPES, openUpload, uploadKey } from "@/lib/storage";
import { canReadUpload } from "@/lib/upload-access";

// Serves uploaded files with HTTP range support (required for video playback on iOS Safari).
// Filenames are random and never reused, so responses are cached as immutable.
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const key = uploadKey(segments);
  const protectedStorage = !!process.env.R2_BUCKET;
  if (!key || (protectedStorage && !(await canReadUpload(`/files/${key}`, segments[0]!)))) {
    return new Response("Not found", { status: 404 });
  }
  const upload = await openUpload(segments);
  if (!upload) return new Response("Not found", { status: 404 });
  const { size } = upload;

  const headers = new Headers({
    "Content-Type": MIME_TYPES[extensionOf(key)] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": protectedStorage ? "private, no-store" : "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    // Uploaded SVGs must never run script if someone opens the file URL directly.
    "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:",
  });

  const range = request.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    let start: number;
    let end: number;
    if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    } else {
      start = Math.max(0, size - Number(match[2])); // suffix range: last N bytes
      end = size - 1;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(await upload.read({ start, end }), { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(await upload.read(), { status: 200, headers });
}
