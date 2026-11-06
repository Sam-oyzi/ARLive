import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireReadableBook } from "@/lib/books";
import type { ContentData } from "@/lib/content";
import { db } from "@/lib/db";
import { soundLayers } from "@/lib/sound-layers";
import { plainStory } from "@/lib/story-text";
import { scanActionOf, opensModel } from "@/lib/scan-actions";
import { worldEffectOf } from "@/lib/world-effects";
import { ARViewer } from "./ar-viewer";
import { bookReturnHref, withReturnTo } from "@/lib/reader-navigation";

export const metadata: Metadata = { title: "Scan" };
export const viewport: Viewport = { themeColor: "#000000", maximumScale: 1, userScalable: false };

export default async function ScanPage({ params, searchParams }: { params: Promise<{ bookId: string }>; searchParams: Promise<{ preview?: string; returnTo?: string }> }) {
  const user = await getCurrentUser();
  const { bookId } = await params;
  const { preview, returnTo } = await searchParams;
  const scanPath = `/scan/${bookId}`;
  const readerReturn = bookReturnHref(bookId, returnTo, "");
  await requireReadableBook(user, bookId, readerReturn ? `${scanPath}?returnTo=${encodeURIComponent(readerReturn)}` : scanPath);

  const book = await db.book.findUnique({
    where: { id: bookId },
    include: {
      subject: true,
      targets: {
        where: { ar: true, targetIndex: { not: null } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { contents: { orderBy: { order: "asc" } }, sounds: { where: { kind: "scene" }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
      },
    },
  });
  if (!book) notFound();
  // A QR code from before the AR pages were compiled: read the book instead.
  if (!book.mindUrl) redirect(readerReturn || `/read/${bookId}`);

  const defaultBackHref =
    user?.role === "SUPER_ADMIN" ? `/admin/books/${book.id}`
    : user?.role === "SCHOOL_ADMIN" ? "/school"
    : user?.role === "STUDENT" && !book.ownerId ? `/learn/${book.subject.slug}`
    : book.ownerId ? "/account" : `/library/${book.id}`;
  const backHref = bookReturnHref(bookId, returnTo, defaultBackHref);
  const previewTarget = user?.role === "SUPER_ADMIN" ? book.targets.find((target) => target.id === preview && opensModel(target.scanAction)) : undefined;

  return (
    <ARViewer
      key={`${book.id}:${previewTarget?.id ?? "scan"}:${book.targets.map((target) => target.scanAction).join(",")}`}
      book={{
        id: book.id,
        title: book.title,
        mindUrl: book.mindUrl,
        coverUrl: book.coverUrl,
        subject: { name: book.subject.name, color: book.subject.color, icon: book.subject.icon },
      }}
      targets={book.targets.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description && plainStory(t.description),
        imageUrl: t.imageUrl,
        worldUrl: t.worldUrl,
        worldEffect: worldEffectOf(t.worldEffect),
        scanAction: scanActionOf(t.scanAction),
        narrationUrl: t.narrationUrl,
        sounds: soundLayers(t.sounds),
        targetIndex: t.targetIndex!,
        contents: t.contents as ContentData[],
      }))}
      backHref={backHref}
      scanHref={withReturnTo(scanPath, backHref)}
      // Admins can review the selected engine without having to hold up a printed proof.
      previewTargetId={previewTarget?.id}
    />
  );
}
