import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { backCoverFor, requireReadableBook } from "@/lib/books";
import { bookFormat } from "@/lib/book-format";
import { db } from "@/lib/db";
import { bookQrPath, siteOrigin } from "@/lib/site-url";
import { textPositionOf } from "@/lib/story-text";
import { PrintBook } from "./print-book";

export const metadata: Metadata = { title: "Download" };

export default async function PrintPage({ params }: { params: Promise<{ bookId: string }> }) {
  const user = await getCurrentUser();
  const { bookId } = await params;
  await requireReadableBook(user, bookId, `/print/${bookId}`);
  const book = await db.book.findUnique({
    where: { id: bookId },
    include: { targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!book) notFound();
  const format = bookFormat(book.format);

  return (
    <PrintBook
      book={{ id: book.id, title: book.title }}
      // Admins print proofs; everyone else's print or PDF counts as a download.
      countDownload={user?.role !== "SUPER_ADMIN"}
      format={{ label: format.label, widthMm: format.widthMm, heightMm: format.heightMm }}
      pages={book.targets.map((t) => ({ id: t.id, imageUrl: t.imageUrl, title: t.name, ar: t.ar, story: t.description, textPosition: textPositionOf(t.textPosition) }))}
      backCover={{ imageUrl: backCoverFor(book), qrUrl: `${await siteOrigin()}${bookQrPath(book)}`, ar: !!book.mindUrl }}
    />
  );
}
