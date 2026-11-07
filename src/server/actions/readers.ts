"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { assertRole, AuthError, getCurrentUser } from "@/lib/auth";
import { VISIBILITY_KEYS } from "@/lib/books";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { failure, refreshAll, type ActionState } from "../forms";

const MAX_EMAILS_AT_ONCE = 200;

/** A signed-in reader asks for a locked book. An admin approves or declines it. */
export async function requestBookAccess(bookId: string, message?: string): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    const say = (await getI18n()).t.server;
    if (!user) throw new AuthError(say.signInFirst);
    const book = await db.book.findFirst({ where: { id: bookId, published: true }, select: { ownerId: true, visibility: true } });
    // Custom stories can only be asked for by the family they were made for.
    if (!book || (book.ownerId ? book.ownerId !== user.id : book.visibility !== "APPROVED")) {
      return { error: say.cantRequest };
    }
    const key = { bookId_email: { bookId, email: user.username } };
    const existing = await db.bookReader.findUnique({ where: key });
    if (existing?.status === "APPROVED") return { ok: true, message: say.hasAccess };
    const note = message?.trim().slice(0, 300) || null;
    await db.bookReader.upsert({
      where: key,
      update: { status: "PENDING", message: note, decidedAt: null },
      create: { bookId, email: user.username, status: "PENDING", message: note },
    });
    refreshAll();
    return { ok: true, message: say.accessRequested };
  } catch (error) {
    return failure(error);
  }
}

// ---------- Admin ----------

export async function setBookVisibility(bookId: string, visibility: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = z.enum(VISIBILITY_KEYS).safeParse(visibility);
    if (!parsed.success) return { error: "Pick who can read this book." };
    const book = await db.book.findUniqueOrThrow({ where: { id: bookId }, select: { ownerId: true } });
    if (book.ownerId) return { error: "Custom stories are only for the emails you approve." };
    await db.book.update({ where: { id: bookId }, data: { visibility: parsed.data } });
    refreshAll();
    return { ok: true, message: "Reading access updated" };
  } catch (error) {
    return failure(error);
  }
}

const emailList = z
  .string()
  .transform((text) => [...new Set(text.toLowerCase().split(/[\s,;]+/).filter(Boolean))])
  .pipe(z.array(z.email({ error: "One of these isn't an email address" })).min(1, "Enter at least one email").max(MAX_EMAILS_AT_ONCE));

/** Approves emails up front, e.g. families who bought the printed book. Their accounts can come later. */
export async function addBookReaders(bookId: string, text: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const parsed = emailList.safeParse(text);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the emails." };
    const now = new Date();
    const readers = JSON.stringify(parsed.data.map((email) => ({ id: randomUUID(), email })));
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "BookReader" ("id", "bookId", "email", "status", "createdAt", "decidedAt")
      SELECT json_extract(value, '$.id'), ${bookId}, json_extract(value, '$.email'), 'APPROVED', ${now}, ${now}
      FROM json_each(${readers}) WHERE true
      ON CONFLICT ("bookId", "email") DO UPDATE SET "status" = 'APPROVED', "decidedAt" = excluded."decidedAt"
    `);
    refreshAll();
    return { ok: true, message: parsed.data.length === 1 ? `${parsed.data[0]} can read it now` : `${parsed.data.length} readers approved` };
  } catch (error) {
    return failure(error);
  }
}

export async function decideBookReader(readerId: string, approve: boolean): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const reader = await db.bookReader.update({
      where: { id: readerId },
      data: { status: approve ? "APPROVED" : "DECLINED", decidedAt: new Date() },
    });
    refreshAll();
    return { ok: true, message: approve ? `${reader.email} can read it now` : "Request declined" };
  } catch (error) {
    return failure(error);
  }
}

export async function removeBookReader(readerId: string): Promise<ActionState> {
  try {
    await assertRole(["SUPER_ADMIN"]);
    const reader = await db.bookReader.delete({ where: { id: readerId } });
    refreshAll();
    return { ok: true, message: `${reader.email} can no longer read it` };
  } catch (error) {
    return failure(error);
  }
}
