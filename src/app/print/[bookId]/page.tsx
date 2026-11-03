import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { bookFormat } from "@/lib/book-format";
import { db } from "@/lib/db";
import { PrintBook } from "./print-book";

export const metadata: Metadata = { title: "Print" };

export default async function PrintPage({ params }: { params: Promise<{ bookId: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { bookId } = await params;
  const book = await db.book.findUnique({
    where: { id: bookId },
    include: { subject: true, targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!book) notFound();
  const format = bookFormat(book.format);

  return (
    <PrintBook
      book={{ id: book.id, title: book.title, color: book.subject.color }}
      format={{ label: format.label, widthMm: format.widthMm, heightMm: format.heightMm }}
      pages={book.targets.map((t) => ({ id: t.id, imageUrl: t.imageUrl, title: t.name, ar: t.ar }))}
    />
  );
}
