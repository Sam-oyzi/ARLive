import fsp from "node:fs/promises";
import { NextResponse, type NextRequest } from "next/server";
import { assertRole, AuthError } from "@/lib/auth";
import { describeOptimization, optimizeGlb } from "@/lib/glb-optimize";
import { isUploadKind, resolveUploadPath, saveUpload, UploadError } from "@/lib/storage";

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
    if (kind !== "models") return NextResponse.json(saved);
    return NextResponse.json({ ...saved, ...(await optimizeModel(saved.url)) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}

/** Shrink a just-uploaded GLB in place. Keeps the original if optimising fails or doesn't help. */
async function optimizeModel(url: string) {
  const file = resolveUploadPath(url.slice("/files/".length).split("/"));
  if (!file) return {};
  try {
    const result = await optimizeGlb(await fsp.readFile(file));
    if (result.after.bytes >= result.before.bytes) return { optimized: null };
    await fsp.writeFile(file, result.glb);
    return { size: result.after.bytes, optimized: { before: result.before, after: result.after, summary: describeOptimization(result) } };
  } catch (error) {
    console.error("GLB optimisation failed, keeping the original:", error);
    return { optimized: null, optimizeError: "This model couldn't be optimised, so the original file is used." };
  }
}
