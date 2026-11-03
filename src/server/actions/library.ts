"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { canUserReadBook } from "@/lib/books";
import { db } from "@/lib/db";
import { averageStars } from "@/lib/library";
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
    const likes = await db.$transaction(async (tx) => {
      if (liked) await tx.bookLike.create({ data: { userId: user.id, bookId } });
      else await tx.bookLike.delete({ where: key });
      // Recount rather than increment, so the counter can't drift from the rows.
      const count = await tx.bookLike.count({ where: { bookId } });
      await tx.book.update({ where: { id: bookId }, data: { likeCount: count } });
      return count;
    });
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
    const summary = await db.$transaction(async (tx) => {
      await tx.bookRating.upsert({
        where: { userId_bookId: { userId: user.id, bookId } },
        update: { stars: parsed.data },
        create: { userId: user.id, bookId, stars: parsed.data },
      });
      const all = await tx.bookRating.findMany({ where: { bookId }, select: { stars: true } });
      const result = { average: averageStars(all.map((r) => r.stars)), count: all.length };
      await tx.book.update({ where: { id: bookId }, data: { ratingAvg: result.average, ratingCount: result.count } });
      return result;
    });
    refreshAll();
    return { ok: true, message: "Thanks for rating!", data: summary };
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
