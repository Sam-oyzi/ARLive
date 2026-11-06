import { getCurrentUser } from "@/lib/auth";
import { backCoverSvg } from "@/lib/book-credits";
import { readableWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { matchesEtag } from "@/lib/media-cache";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // One name per dynamic segment: this folder is shared with ./mind.
  const { id } = await params;
  const book = await db.book.findFirst({ where: { id, ...readableWhere(await getCurrentUser()) } });
  if (!book) return new Response("Not found", { status: 404 });
  const etag = `"${book.id}:${book.updatedAt.getTime()}"`;
  const headers = {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, no-cache",
    "ETag": etag,
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  return matchesEtag(request.headers.get("if-none-match"), etag)
    ? new Response(null, { status: 304, headers })
    : new Response(backCoverSvg(book), { headers });
}
