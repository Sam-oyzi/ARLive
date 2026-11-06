import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { backCoverFor, requireReadableBook } from "@/lib/books";
import { bookFormat } from "@/lib/book-format";
import { db } from "@/lib/db";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { bookQrPath, siteOrigin } from "@/lib/site-url";
import { worldExperienceOf } from "@/lib/scan-actions";
import { textPositionOf } from "@/lib/story-text";
import { readStoryLayouts } from "@/lib/story-layout";
import { readerHref, withReturnTo } from "@/lib/reader-navigation";
import { PrintBook } from "./print-book";

export const metadata: Metadata = { title: "Download" };

export default async function PrintPage({ params, searchParams }: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  const { bookId } = await params;
  const { lang } = await searchParams;
  const requestedLanguage = typeof lang === "string" ? lang : "";
  await requireReadableBook(user, bookId, `/print/${bookId}${requestedLanguage ? `?lang=${encodeURIComponent(requestedLanguage)}` : ""}`);
  const book = await db.book.findUnique({
    where: { id: bookId },
    include: { targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
  });
  if (!book) notFound();
  const format = bookFormat(book.format);
  const translations = book.targets.map((target) => pageTranslationsSchema.safeParse(target.translations).data);
  const language = translations.some((page) => page && Object.hasOwn(page, requestedLanguage)) ? requestedLanguage : "";
  const origin = await siteOrigin();
  const reader = readerHref(bookId, null, language);
  const guidePath = book.mindUrl ? withReturnTo(bookQrPath(book), reader) : reader;

  return (
    <PrintBook
      book={{ id: book.id, title: translations[0]?.[language]?.title ?? book.title }}
      language={language}
      guideQrUrl={`${origin}${guidePath}`}
      // Admins print proofs; everyone else's print or PDF counts as a download.
      countDownload={user?.role !== "SUPER_ADMIN"}
      format={{ label: format.label, widthMm: format.widthMm, heightMm: format.heightMm }}
      pages={book.targets.map((t, index) => {
        const translation = translations[index]?.[language];
        return {
          id: t.id,
          imageUrl: translation?.imageUrl ?? t.imageUrl,
          title: translation?.title ?? t.name,
          ar: t.ar,
          experience: worldExperienceOf(t.scanAction, t.worldUrl),
          story: translation ? translation.story ?? null : t.description,
          lang: translation ? language : "en",
          blocks: readStoryLayouts(t.storyLayouts)[translation ? language : "original"],
          textPosition: textPositionOf(t.textPosition),
        };
      })}
      backCover={{ imageUrl: backCoverFor(book), qrUrl: `${origin}${bookQrPath(book)}`, ar: !!book.mindUrl }}
    />
  );
}
