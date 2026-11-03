import { createHash } from "node:crypto";
import { db } from "./db";

/** Order-independent fingerprint of a book's targets; a mismatch with Book.mindHash means "recompile". */
export function targetsSignature(targets: { id: string; imageUrl: string }[]): string {
  const parts = targets.map((t) => `${t.id}:${t.imageUrl}`).sort();
  return createHash("sha1").update(parts.join("|")).digest("hex");
}

export type CompileState = "empty" | "missing" | "stale" | "ready";

/** Only AR pages are compiled; story pages appear in the reader and in print only. */
export function arTargets<T extends { ar: boolean }>(targets: T[]): T[] {
  return targets.filter((t) => t.ar);
}

export function compileState(
  book: { mindUrl: string | null; mindHash: string | null },
  targets: { id: string; imageUrl: string; ar: boolean }[],
): CompileState {
  const ar = arTargets(targets);
  if (ar.length === 0) return "empty";
  if (!book.mindUrl) return "missing";
  return book.mindHash === targetsSignature(ar) ? "ready" : "stale";
}

export function readableBooksWhere(schoolId: string) {
  return {
    published: true,
    access: { some: { schoolId } },
  } as const;
}

/** Books a school can open in AR: granted, published and compiled. */
export function playableBooksWhere(schoolId: string) {
  return { ...readableBooksWhere(schoolId), mindUrl: { not: null } } as const;
}

/** Reading the book (flip-through) doesn't need compiled AR data, only access to a published book. */
export async function canUserReadBook(user: { role: string; schoolId: string | null }, bookId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  if (!user.schoolId) return false;
  const count = await db.book.count({ where: { id: bookId, ...readableBooksWhere(user.schoolId) } });
  return count > 0;
}

export async function canUserOpenBook(user: { role: string; schoolId: string | null }, bookId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  if (!user.schoolId) return false;
  const count = await db.book.count({ where: { id: bookId, ...playableBooksWhere(user.schoolId) } });
  return count > 0;
}
