import { getCurrentUser } from "@/lib/auth";
import { backCoverSvg } from "@/lib/book-credits";
import { readableWhere } from "@/lib/books";
import { db } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  // One name per dynamic segment: this folder is shared with ./mind.
  const { id } = await params;
  const book = await db.book.findFirst({ where: { id, ...readableWhere(await getCurrentUser()) } });
  if (!book) return new Response("Not found", { status: 404 });
  return new Response(backCoverSvg(book), { headers: {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
