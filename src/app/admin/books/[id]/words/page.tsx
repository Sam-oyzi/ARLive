import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { pageAspect } from "@/lib/book-format";
import { db } from "@/lib/db";
import { textPositionOf } from "@/lib/story-text";
import { readStoryLayouts } from "@/lib/story-layout";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { WordsPreview } from "./words-preview";

export const metadata = { title: "Words on pages" };

export default async function WordsOnPages({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { id } = await params;
  const book = await db.book.findUnique({
    where: { id },
    select: { id: true, title: true, format: true, targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, imageUrl: true, description: true, textPosition: true, textScale: true, translations: true, storyLayouts: true } } },
  });
  if (!book) notFound();

  return (
    <>
      <Link href={`/admin/books/${book.id}`} className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> {book.title}
      </Link>
      <PageHeader
        title="Words on pages"
        description="Click a page to edit its text over the artwork. Drag paragraphs into place and style them for the reader and print."
      />
      <WordsPreview
        bookId={book.id}
        aspect={pageAspect(book.format)}
        pages={book.targets.map((t) => ({ id: t.id, name: t.name, imageUrl: t.imageUrl, story: t.description, textPosition: textPositionOf(t.textPosition), textScale: t.textScale, translations: pageTranslationsSchema.safeParse(t.translations).data, layouts: readStoryLayouts(t.storyLayouts) }))}
      />
    </>
  );
}
