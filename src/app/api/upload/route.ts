import { NextResponse, type NextRequest } from "next/server";
import { assertRole, AuthError } from "@/lib/auth";
import { isUploadKind, saveUpload, UploadError } from "@/lib/storage";

// Raw-body streaming upload: PUT /api/upload?kind=models&filename=heart.glb
// Kept out of proxy.ts's matcher so large bodies stream straight to disk.
export async function PUT(request: NextRequest) {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const kind = request.nextUrl.searchParams.get("kind") ?? "";
    const filename = request.nextUrl.searchParams.get("filename") ?? "";
    if (!isUploadKind(kind)) return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });
    if (!request.body) return NextResponse.json({ error: "No file received." }, { status: 400 });
    const saved = await saveUpload(kind, filename, request.body);
    return NextResponse.json(saved);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
