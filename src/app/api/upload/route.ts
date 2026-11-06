import { NextResponse, type NextRequest } from "next/server";
import { assertRole, AuthError } from "@/lib/auth";
import { optimizeModel } from "@/lib/upload-model";
import { isUploadKind, saveUpload, UploadError } from "@/lib/storage";
import { multipartUpload } from "@/lib/upload-multipart";

// Raw-body streaming upload: PUT /api/upload?kind=models&filename=heart.glb
// Kept out of proxy.ts's matcher so bodies stream straight to storage.
export async function PUT(request: NextRequest) {
  try {
    const user = await assertRole(["SUPER_ADMIN"]);
    if (request.nextUrl.searchParams.has("multipart")) return await multipartUpload(request, user.id);
    const kind = request.nextUrl.searchParams.get("kind") ?? "";
    const filename = request.nextUrl.searchParams.get("filename") ?? "";
    if (!isUploadKind(kind)) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });
    if (!request.body) return NextResponse.json({ error: "No file received." }, { status: 400 });
    const saved = await saveUpload(kind, filename, request.body, kind === "models" ? optimizeModel : undefined);
    return NextResponse.json({ ...saved.metadata, url: saved.url, size: saved.size });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

async function multipart(request: NextRequest) {
  try {
    const user = await assertRole(["SUPER_ADMIN"]);
    return await multipartUpload(request, user.id);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

export const POST = multipart;
export const PATCH = multipart;
export const DELETE = multipart;
