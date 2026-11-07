import type { Metadata, Viewport } from "next";
import { getI18n } from "@/lib/i18n/server";
import { worldExperienceOf } from "@/lib/scan-actions";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireReadableBook } from "@/lib/books";
import { db } from "@/lib/db";
import { soundLayers } from "@/lib/sound-layers";
import { worldEffectOf } from "@/lib/world-effects";
import { WorldViewer } from "@/components/story-world/world-viewer";
import { bookReturnHref, readerHref } from "@/lib/reader-navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.storyWorld };
}
export const viewport: Viewport = { themeColor: "#000000", maximumScale: 1, userScalable: false };

/** Open only the experience selected by the studio for this page. */
export default async function WorldPage({ params, searchParams }: { params: Promise<{ bookId: string; pageId: string }>; searchParams: Promise<{ from?: string; returnTo?: string }> }) {
  const [{ bookId, pageId }, { from, returnTo }] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  await requireReadableBook(user, bookId, `/world/${bookId}/${pageId}`);
  const page = await db.target.findFirst({
    where: { id: pageId, bookId },
    select: { id: true, name: true, worldUrl: true, scanAction: true, worldEffect: true, narrationUrl: true, sounds: { where: { kind: "scene" }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }, book: { select: { title: true, subject: { select: { color: true } } } } },
  });
  const experience = worldExperienceOf(page?.scanAction, page?.worldUrl ?? null);
  if (!page?.worldUrl || !experience) notFound();

  return (
    <WorldViewer
      key={`${page.id}:${experience}`}
      experience={experience}
      world={{ url: page.worldUrl, effect: worldEffectOf(page.worldEffect), title: page.name, bookTitle: page.book.title, color: page.book.subject.color, narrationUrl: page.narrationUrl, sounds: soundLayers(page.sounds) }}
      // Back to where the reader came from: the scanner, or the page in the book.
      backHref={bookReturnHref(bookId, returnTo, from === "scan" ? `/scan/${bookId}` : readerHref(bookId, pageId))}
    />
  );
}
