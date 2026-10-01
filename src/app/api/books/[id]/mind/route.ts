import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { assertRole, AuthError } from "@/lib/auth";
import { targetsSignature } from "@/lib/books";
import { db } from "@/lib/db";
import { deleteUpload, saveUpload, UploadError } from "@/lib/storage";

// Stores a .mind file compiled in the admin's browser.
// PUT /api/books/:id/mind?targets=<id,id,...>  (ids in the order they were compiled)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const { id } = await params;
    const order = (request.nextUrl.searchParams.get("targets") ?? "").split(",").filter(Boolean);

    const book = await db.book.findUnique({ where: { id }, include: { targets: true } });
    if (!book) return NextResponse.json({ error: "Book not found." }, { status: 404 });

    const known = new Set(book.targets.map((t) => t.id));
    if (order.length !== known.size || !order.every((tid) => known.has(tid))) {
      return NextResponse.json(
        { error: "Pages changed while compiling. Refresh the page and compile again." },
        { status: 409 },
      );
    }
    if (!request.body) return NextResponse.json({ error: "No data received." }, { status: 400 });

    const { url } = await saveUpload("mind", "targets.mind", request.body);
    await db.$transaction([
      db.book.update({
        where: { id },
        data: { mindUrl: url, mindHash: targetsSignature(book.targets), compiledAt: new Date() },
      }),
      ...order.map((targetId, index) => db.target.update({ where: { id: targetId }, data: { targetIndex: index } })),
    ]);
    await deleteUpload(book.mindUrl);
    revalidatePath("/", "layout");
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Saving the compiled targets failed." }, { status: 500 });
  }
}
