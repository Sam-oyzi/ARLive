import { env } from "cloudflare:workers";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { UPLOAD_KINDS, isUploadKind, extensionOf, MIME_TYPES, UploadError, uploadKey } from "../src/lib/upload-rules";

const PART_BYTES = 8 * 1024 * 1024;
const key = () => new TextEncoder().encode(env.SESSION_SECRET);
const partSchema = z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1).max(128) })).max(32);

/** Signed upload capabilities bind an R2 session to its admin, key and exact file size. */
export async function multipartUpload(request: Request, ownerId: string): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "POST") {
    const input = await request.json() as { kind?: string; filename?: string; size?: number };
    if (!input.kind || !isUploadKind(input.kind)) throw new UploadError("Unknown upload type.");
    const rule = UPLOAD_KINDS[input.kind];
    const ext = extensionOf(input.filename ?? "");
    if (!(rule.exts as readonly string[]).includes(ext)) throw new UploadError("That file type is not allowed here.");
    if (!Number.isSafeInteger(input.size) || input.size! <= 0 || input.size! > rule.maxMB * 1024 * 1024) throw new UploadError(`Choose a file up to ${rule.maxMB} MB.`);
    const objectKey = `${input.kind}/${crypto.randomUUID().replaceAll("-", "")}.${ext}`;
    const upload = await env.MEDIA.createMultipartUpload(objectKey, { httpMetadata: { contentType: MIME_TYPES[ext] ?? "application/octet-stream" } });
    const token = await new SignJWT({ purpose: "upload", ownerId, objectKey, uploadId: upload.uploadId, size: input.size })
      .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1h").sign(key());
    return Response.json({ token, partSize: PART_BYTES });
  }
  let claims;
  try {
    claims = (await jwtVerify(request.headers.get("x-pagewakes-upload") ?? "", key(), { algorithms: ["HS256"] })).payload;
  } catch { throw new UploadError("This upload expired. Please choose the file again."); }
  if (claims.purpose !== "upload" || claims.ownerId !== ownerId || typeof claims.objectKey !== "string" ||
      !uploadKey(claims.objectKey.split("/")) || typeof claims.uploadId !== "string" || typeof claims.size !== "number") {
    throw new UploadError("Invalid upload session.");
  }
  const upload = env.MEDIA.resumeMultipartUpload(claims.objectKey, claims.uploadId);
  const count = Math.ceil(claims.size / PART_BYTES);
  if (request.method === "PUT") {
    const number = Number(url.searchParams.get("part"));
    if (!Number.isInteger(number) || number < 1 || number > count || !request.body) throw new UploadError("Invalid upload part.");
    const expected = Math.min(PART_BYTES, claims.size - (number - 1) * PART_BYTES);
    const reader = request.body.getReader();
    const bytes = new Uint8Array(expected);
    let offset = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (offset + value.byteLength > expected) { await reader.cancel(); throw new UploadError("Upload part is too large."); }
        bytes.set(value, offset); offset += value.byteLength;
      }
    } finally { reader.releaseLock(); }
    if (offset !== expected) throw new UploadError("Upload part is incomplete. Please retry.");
    return Response.json(await upload.uploadPart(number, bytes));
  }
  if (request.method === "DELETE") {
    await upload.abort();
    return new Response(null, { status: 204 });
  }
  if (request.method !== "PATCH") throw new UploadError("Invalid upload operation.");
  const parsed = partSchema.safeParse(await request.json());
  if (!parsed.success || parsed.data.length !== count || parsed.data.some((part, index) => part.partNumber !== index + 1)) throw new UploadError("Upload parts are missing.");
  const object = await upload.complete(parsed.data);
  if (object.size !== claims.size) { await env.MEDIA.delete(claims.objectKey); throw new UploadError("The uploaded file is incomplete."); }
  return Response.json({ url: `/files/${claims.objectKey}`, size: object.size });
}
