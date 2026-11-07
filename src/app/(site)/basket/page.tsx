import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { readableWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { siteOrigin } from "@/lib/site-url";
import { getI18n } from "@/lib/i18n/server";
import { BasketView } from "./basket-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.basket };
}

/**
 * Printed books to order. `?add=<book>` puts a book in (the "Buy" buttons link here); the basket itself
 * lives in the reader's browser, and ordering sends it to us on WhatsApp.
 */
export default async function BasketPage({ searchParams }: { searchParams: Promise<{ add?: string | string[] }> }) {
  const { add } = await searchParams;
  const user = await getCurrentUser();
  const bookId = typeof add === "string" ? add : null;
  const book = bookId
    ? await db.book.findFirst({
        where: { id: bookId, ...readableWhere(user) },
        select: { id: true, title: true, coverUrl: true, targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], take: 1, select: { imageUrl: true } } },
      })
    : null;
  return (
    <BasketView
      adding={book ? { bookId: book.id, title: book.title, imageUrl: book.coverUrl ?? book.targets[0]?.imageUrl ?? null } : null}
      whatsapp={process.env.WHATSAPP_NUMBER?.trim() || null}
      origin={await siteOrigin()}
    />
  );
}
