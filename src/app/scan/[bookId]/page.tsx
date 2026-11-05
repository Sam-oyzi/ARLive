import type { Metadata, Viewport } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requireReadableBook } from "@/lib/books";
import type { ContentData } from "@/lib/content";
import { db } from "@/lib/db";
import { plainStory } from "@/lib/story-text";
import { ARViewer } from "./ar-viewer";

export const metadata: Metadata = { title: "Scan" };
export const viewport: Viewport = { themeColor: "#000000", maximumScale: 1, userScalable: false };

export default async function ScanPage({ params }: { params: Promise<{ bookId: string }> }) {
  const user = await getCurrentUser();
  const { bookId } = await params;
  await requireReadableBook(user, bookId, `/scan/${bookId}`);

  const book = await db.book.findUnique({
    where: { id: bookId },
    include: {
      subject: true,
      targets: {
        where: { ar: true, targetIndex: { not: null } },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        include: { contents: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!book) notFound();
  // A QR code from before the AR pages were compiled: read the book instead.
  if (!book.mindUrl) redirect(`/read/${bookId}`);

  const backHref =
    user?.role === "SUPER_ADMIN" ? `/admin/books/${book.id}`
    : user?.role === "SCHOOL_ADMIN" ? "/school"
    : user?.role === "STUDENT" && !book.ownerId ? `/learn/${book.subject.slug}`
    : book.ownerId ? "/account" : `/library/${book.id}`;

  return (
    <ARViewer
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
        targetIndex: t.targetIndex!,
        contents: t.contents as ContentData[],
      }))}
      backHref={backHref}
    />
  );
}
