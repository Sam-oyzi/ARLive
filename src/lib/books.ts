import { createHash } from "node:crypto";
import { db } from "./db";

/** Order-independent fingerprint of a book's targets; a mismatch with Book.mindHash means "recompile". */
export function targetsSignature(targets: { id: string; imageUrl: string }[]): string {
  const parts = targets.map((t) => `${t.id}:${t.imageUrl}`).sort();
  return createHash("sha1").update(parts.join("|")).digest("hex");
}

export type CompileState = "empty" | "missing" | "stale" | "ready";

export function compileState(book: { mindUrl: string | null; mindHash: string | null }, targets: { id: string; imageUrl: string }[]): CompileState {
  if (targets.length === 0) return "empty";
  if (!book.mindUrl) return "missing";
  return book.mindHash === targetsSignature(targets) ? "ready" : "stale";
}

/** Books a school can open in AR: granted, published and compiled. */
export function playableBooksWhere(schoolId: string) {
  return {
    published: true,
    mindUrl: { not: null },
    access: { some: { schoolId } },
  } as const;
}

export async function canUserOpenBook(user: { role: string; schoolId: string | null }, bookId: string) {
  if (user.role === "SUPER_ADMIN") return true;
  if (!user.schoolId) return false;
  const count = await db.book.count({ where: { id: bookId, ...playableBooksWhere(user.schoolId) } });
  return count > 0;
}
