import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { pageAspect } from "@/lib/book-format";
import { backCoverFor, compileState, requireReadableBook } from "@/lib/books";
import { db } from "@/lib/db";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { textPositionOf } from "@/lib/story-text";
import { Reader } from "./reader";

export async function generateMetadata({ params }: { params: Promise<{ bookId: string }> }): Promise<Metadata> {
  const { bookId } = await params;
  const book = await db.book.findFirst({ where: { id: bookId, published: true, ownerId: null }, select: { title: true } });
  return { title: book ? `Read “${book.title}”` : "Read" };
}
export const viewport: Viewport = { themeColor: "#efe8da" };

export default async function ReadPage({ params }: { params: Promise<{ bookId: string }> }) {
  const user = await getCurrentUser();
  const { bookId } = await params;
  await requireReadableBook(user, bookId, `/read/${bookId}`);

  const book = await db.book.findUnique({
    where: { id: bookId },
    include: {
      subject: true,
      targets: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!book) notFound();

  const editable = user?.role === "SUPER_ADMIN";
  const backHref = editable
    ? `/admin/books/${book.id}`
    : user?.role === "SCHOOL_ADMIN" ? "/school/catalog"
    : user?.role === "STUDENT" && !book.ownerId ? `/learn/${book.subject.slug}`
    : book.ownerId ? "/account" : `/library/${book.id}`;
  const state = compileState(book, book.targets);

  return (
    <Reader
      book={{
        id: book.id,
        title: book.title,
        backCoverImageUrl: backCoverFor(book),
        format: book.format,
        subject: { name: book.subject.name, color: book.subject.color, icon: book.subject.icon },
        // Students can only scan once the AR data is compiled; admins see the compile status instead.
        canScan: !!book.mindUrl && state !== "empty",
        needsCompile: editable && (state === "stale" || state === "missing"),
      }}
      aspect={pageAspect(book.format)}
      pages={book.targets.map((t) => ({
        id: t.id, imageUrl: t.imageUrl, title: t.name, story: t.description, ar: t.ar, narrationUrl: t.narrationUrl,
        textPosition: textPositionOf(t.textPosition),
        translations: pageTranslationsSchema.safeParse(t.translations).data,
      }))}
      editable={editable}
      backHref={backHref}
    />
  );
}
