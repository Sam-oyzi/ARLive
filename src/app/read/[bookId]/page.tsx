import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { pageAspect } from "@/lib/book-format";
import { canUserReadBook, compileState } from "@/lib/books";
import { db } from "@/lib/db";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { Reader } from "./reader";

export const metadata: Metadata = { title: "Read" };
export const viewport: Viewport = { themeColor: "#efe8da" };

export default async function ReadPage({ params }: { params: Promise<{ bookId: string }> }) {
  const user = await requireUser();
  const { bookId } = await params;
  if (!(await canUserReadBook(user, bookId))) notFound();

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

  const editable = user.role === "SUPER_ADMIN";
  const backHref = editable ? `/admin/books/${book.id}` : user.role === "SCHOOL_ADMIN" ? "/school/catalog" : `/learn/${book.subject.slug}`;
  const state = compileState(book, book.targets);

  return (
    <Reader
      book={{
        id: book.id,
        title: book.title,
        format: book.format,
        subject: { name: book.subject.name, color: book.subject.color, icon: book.subject.icon },
        // Students can only scan once the AR data is compiled; admins see the compile status instead.
        canScan: !!book.mindUrl && state !== "empty",
        needsCompile: editable && (state === "stale" || state === "missing"),
      }}
      aspect={pageAspect(book.format)}
      pages={book.targets.map((t) => ({
        id: t.id, imageUrl: t.imageUrl, title: t.name, story: t.description, ar: t.ar,
        translations: pageTranslationsSchema.safeParse(t.translations).data,
      }))}
      editable={editable}
      backHref={backHref}
    />
  );
}
