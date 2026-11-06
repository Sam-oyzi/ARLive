// Adds a whole language to an installed book from one file: each page's title and story, the page
// notes if there are any, and a translated cover picture. Safe to re-run; other languages are kept.
//   npx tsx scripts/apply-translation.ts "Sarra and the Little Lost Roar" books/sarra-and-the-little-lost-roar/translations-ar.json
// The file: { "language": "ar", "cover": "ar-page-01.jpg", "pages": [{ "title", "story", "note"? }, …] },
// one entry per page in reading order; the cover sits next to the book's own page pictures.
import fs from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { pageTranslationsSchema } from "../src/lib/page-translations";

type TranslationFile = { language: string; cover?: string; pages: { title: string; story?: string; note?: string }[] };

async function main() {
  const [title, file] = process.argv.slice(2);
  if (!title || !file) throw new Error('Usage: npx tsx scripts/apply-translation.ts "Book title" translations.json');
  const spec = JSON.parse(fs.readFileSync(file, "utf8")) as TranslationFile;
  const db = new PrismaClient();
  try {
    const book = await db.book.findFirst({ where: { title }, include: { targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } } });
    if (!book) throw new Error(`No book called "${title}".`);
    if (book.targets.length !== spec.pages.length) throw new Error(`The book has ${book.targets.length} pages; the file has ${spec.pages.length}.`);
    const coverUrl = spec.cover && `${path.posix.dirname(book.targets[0]!.imageUrl)}/${spec.cover}`;
    if (coverUrl && !fs.existsSync(path.join(process.cwd(), "public", coverUrl))) throw new Error(`Missing ${coverUrl} in public/.`);

    for (const [index, page] of book.targets.entries()) {
      const words = spec.pages[index]!;
      const current = pageTranslationsSchema.safeParse(page.translations).data ?? {};
      const next = pageTranslationsSchema.parse({
        ...current,
        [spec.language]: { title: words.title, story: words.story || undefined, note: words.note || undefined, imageUrl: index === 0 ? coverUrl : undefined },
      });
      await db.target.update({ where: { id: page.id }, data: { translations: next as Prisma.InputJsonValue } });
    }
    console.log(`${book.title}: ${spec.language} added to ${book.targets.length} pages.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
