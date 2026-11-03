import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { canUserOpenBook } from "@/lib/books";
import type { ContentData } from "@/lib/content";
import { db } from "@/lib/db";
import { ARViewer } from "./ar-viewer";

export const metadata: Metadata = { title: "Scan" };
export const viewport: Viewport = { themeColor: "#000000", maximumScale: 1, userScalable: false };

export default async function ScanPage({ params }: { params: Promise<{ bookId: string }> }) {
  const user = await getCurrentUser();
  const { bookId } = await params;
  if (!(await canUserOpenBook(user, bookId))) notFound();

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
  if (!book?.mindUrl) notFound();

  const backHref =
    user?.role === "SUPER_ADMIN" ? `/admin/books/${book.id}`
    : user?.role === "SCHOOL_ADMIN" ? "/school"
    : user?.role === "STUDENT" && !book.ownerId ? `/learn/${book.subject.slug}`
    : `/read/${book.id}`;

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
        description: t.description,
        imageUrl: t.imageUrl,
        targetIndex: t.targetIndex!,
        contents: t.contents as ContentData[],
      }))}
      backHref={backHref}
    />
  );
}
