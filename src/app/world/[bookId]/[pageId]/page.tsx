import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireReadableBook } from "@/lib/books";
import { db } from "@/lib/db";
import { worldEffectOf } from "@/lib/world-effects";
import { WorldViewer } from "./world-viewer";

export const metadata: Metadata = { title: "Story world" };
export const viewport: Viewport = { themeColor: "#000000", maximumScale: 1, userScalable: false };

/** Step inside a page: its 360° story world, looked around by turning the phone. */
export default async function WorldPage({ params, searchParams }: { params: Promise<{ bookId: string; pageId: string }>; searchParams: Promise<{ from?: string }> }) {
  const [{ bookId, pageId }, { from }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  await requireReadableBook(user, bookId, `/world/${bookId}/${pageId}`);
  const page = await db.target.findFirst({
    where: { id: pageId, bookId },
    select: { id: true, name: true, worldUrl: true, worldEffect: true, narrationUrl: true, book: { select: { title: true, subject: { select: { color: true } } } } },
  });
  if (!page?.worldUrl) notFound();

  return (
    <WorldViewer
      world={{ url: page.worldUrl, effect: worldEffectOf(page.worldEffect), title: page.name, bookTitle: page.book.title, color: page.book.subject.color, narrationUrl: page.narrationUrl }}
      // Back to where the reader came from: the scanner, or the page in the book.
      backHref={from === "scan" ? `/scan/${bookId}` : `/read/${bookId}`}
    />
  );
}
