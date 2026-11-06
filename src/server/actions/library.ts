"use server";

import { headers } from "next/headers";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { canUserReadBook } from "@/lib/books";
import { db, writeBatch } from "@/lib/db";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { failure, refreshAll, type ActionState } from "../forms";

// One download per visitor per book in this window, so reprinting doesn't inflate the counter.
const DOWNLOAD_WINDOW_MS = 6 * 60 * 60 * 1000;

async function readerFor(bookId: string) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Sign in to do that.");
  if (!(await canUserReadBook(user, bookId))) throw new AuthError("This book isn't available.");
  return user;
}

export async function toggleLike(bookId: string): Promise<ActionState<{ liked: boolean; likes: number }>> {
  try {
    const user = await readerFor(bookId);
    const key = { userId_bookId: { userId: user.id, bookId } };
    const liked = !(await db.bookLike.findUnique({ where: key }));
    const now = new Date();
    await writeBatch([
      liked
        ? Prisma.sql`INSERT INTO "BookLike" ("userId", "bookId", "createdAt") VALUES (${user.id}, ${bookId}, ${now}) ON CONFLICT ("userId", "bookId") DO NOTHING`
        : Prisma.sql`DELETE FROM "BookLike" WHERE "userId" = ${user.id} AND "bookId" = ${bookId}`,
      Prisma.sql`UPDATE "Book" SET "likeCount" = (SELECT COUNT(*) FROM "BookLike" WHERE "bookId" = ${bookId}),
        "updatedAt" = ${now} WHERE "id" = ${bookId}`,
    ]);
    const { likeCount: likes } = await db.book.findUniqueOrThrow({ where: { id: bookId }, select: { likeCount: true } });
    refreshAll();
    return { ok: true, data: { liked, likes } };
  } catch (error) {
    return failure(error);
  }
}

const stars = z.number().int().min(1).max(5);

export async function rateBook(bookId: string, value: number): Promise<ActionState<{ average: number; count: number }>> {
  try {
    const user = await readerFor(bookId);
    const parsed = stars.safeParse(value);
    if (!parsed.success) return { error: "Pick 1 to 5 stars." };
    const now = new Date();
    await writeBatch([
      Prisma.sql`INSERT INTO "BookRating" ("userId", "bookId", "stars", "createdAt", "updatedAt")
        VALUES (${user.id}, ${bookId}, ${parsed.data}, ${now}, ${now})
        ON CONFLICT ("userId", "bookId") DO UPDATE SET "stars" = excluded."stars", "updatedAt" = excluded."updatedAt"`,
      Prisma.sql`UPDATE "Book" SET
        "ratingAvg" = (SELECT COALESCE(ROUND(AVG("stars"), 1), 0) FROM "BookRating" WHERE "bookId" = ${bookId}),
        "ratingCount" = (SELECT COUNT(*) FROM "BookRating" WHERE "bookId" = ${bookId}),
        "updatedAt" = ${now} WHERE "id" = ${bookId}`,
    ]);
    const { ratingAvg: average, ratingCount: count } = await db.book.findUniqueOrThrow({
      where: { id: bookId }, select: { ratingAvg: true, ratingCount: true },
    });
    refreshAll();
    return { ok: true, message: "Thanks for rating!", data: { average, count } };
  } catch (error) {
    return failure(error);
  }
}

/** Counts a download (print / save as PDF). Visitors don't need an account. */
export async function recordDownload(bookId: string): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!(await canUserReadBook(user, bookId))) return { error: "This book isn't available." };
    const who = user?.id ?? (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const key = `download:${bookId}:${who}`;
    if (isBlocked(key, 1)) return { ok: true };
    recordFailure(key, DOWNLOAD_WINDOW_MS);
    await db.book.update({ where: { id: bookId }, data: { downloads: { increment: 1 } } });
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
