import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { assertRole, AuthError } from "@/lib/auth";
import { arTargets, targetsSignature } from "@/lib/books";
import { db, writeBatch } from "@/lib/db";
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

    const compiled = arTargets(book.targets);
    const known = new Set(compiled.map((t) => t.id));
    const conflict = () => NextResponse.json(
      { error: "Pages changed while compiling. Refresh the page and compile again." }, { status: 409 },
    );
    if (order.length !== known.size || new Set(order).size !== known.size || !order.every((tid) => known.has(tid))) {
      return conflict();
    }
    if (!request.body) return NextResponse.json({ error: "No data received." }, { status: 400 });

    const { url } = await saveUpload("mind", "targets.mind", request.body);
    const expected = JSON.stringify(compiled.map(({ id: targetId, imageUrl }) => ({ targetId, imageUrl })));
    const now = new Date();
    const published = Prisma.sql`EXISTS (SELECT 1 FROM "Book" WHERE "Book"."id" = ${id} AND "Book"."mindUrl" = ${url})`;
    // json_each() has its own "id" column, so every Target column next to it is named in full, and
    // its alias must not be "target": SQLite names are case-insensitive, so that is "Target" again.
    const [changed] = await writeBatch([
      Prisma.sql`UPDATE "Book" SET "mindUrl" = ${url}, "mindHash" = ${targetsSignature(compiled)},
        "compiledAt" = ${now}, "updatedAt" = ${now} WHERE "id" = ${id}
        AND (SELECT COUNT(*) FROM "Target" WHERE "bookId" = ${id} AND "ar" = 1) = ${compiled.length}
        AND (SELECT COUNT(*) FROM "Target", json_each(${expected}) AS compiledPage
          WHERE "Target"."bookId" = ${id} AND "Target"."ar" = 1 AND "Target"."id" = json_extract(compiledPage.value, '$.targetId')
            AND "Target"."imageUrl" = json_extract(compiledPage.value, '$.imageUrl')) = ${compiled.length}`,
      Prisma.sql`UPDATE "Target" SET "targetIndex" = NULL, "updatedAt" = ${now}
        WHERE "bookId" = ${id} AND "ar" = 0 AND ${published}`,
      Prisma.sql`UPDATE "Target" SET "targetIndex" = targetOrder.key, "updatedAt" = ${now}
        FROM json_each(${JSON.stringify(order)}) AS targetOrder
        WHERE "Target"."id" = targetOrder.value AND "Target"."bookId" = ${id} AND ${published}`,
    ]);
    if (!changed) {
      await deleteUpload(url);
      return conflict();
    }
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
