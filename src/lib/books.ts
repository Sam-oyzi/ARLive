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

/** Who is looking at a book: a signed-in user, or null for a visitor. */
export type Viewer = { id: string; role: string; schoolId: string | null } | null;

/** The public library: published books that weren't made for one family. Free for everyone. */
export const libraryBooksWhere = { published: true, ownerId: null } as const;

/**
 * Published books a viewer may open: the library, their own custom stories, and books their school
 * was granted. Admins see everything, drafts included.
 */
export function readableWhere(viewer: Viewer) {
  if (viewer?.role === "SUPER_ADMIN") return {};
  return {
    published: true,
    OR: [
      { ownerId: null },
      ...(viewer ? [{ ownerId: viewer.id }] : []),
      ...(viewer?.schoolId ? [{ access: { some: { schoolId: viewer.schoolId } } }] : []),
    ],
  };
}

/** Reading the book (flip-through, print) doesn't need compiled AR data. */
export async function canUserReadBook(viewer: Viewer, bookId: string) {
  const count = await db.book.count({ where: { id: bookId, ...readableWhere(viewer) } });
  return count > 0;
}

/** Scanning needs the compiled AR data as well. */
export async function canUserOpenBook(viewer: Viewer, bookId: string) {
  const count = await db.book.count({ where: { id: bookId, mindUrl: { not: null }, ...readableWhere(viewer) } });
  return count > 0;
}

/** A book needs pages to be published. AR pages are optional, but must be compiled once there are some. */
export function canPublish(state: CompileState, pages: number): boolean {
  return pages > 0 && state !== "missing";
}
