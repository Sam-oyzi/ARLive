import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
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
export type Viewer = { id: string; role: string; schoolId: string | null; username: string } | null;

export { VISIBILITIES, VISIBILITY_KEYS, visibilityOf, type Visibility } from "./visibility";

/** The library lists every published book that wasn't made for one family, locked or not. */
export const libraryBooksWhere = { published: true, ownerId: null } as const;

/**
 * Published books a viewer may open: public library books, members' books once signed in, books
 * their email was approved for (custom stories included), and books their school was granted.
 * Admins see everything, drafts included.
 */
export function readableWhere(viewer: Viewer) {
  if (viewer?.role === "SUPER_ADMIN") return {};
  return {
    published: true,
    OR: [
      { ownerId: null, visibility: "PUBLIC" },
      ...(viewer
        ? [{ ownerId: null, visibility: "MEMBERS" }, { readers: { some: { email: viewer.username, status: "APPROVED" } } }]
        : []),
      ...(viewer?.schoolId ? [{ access: { some: { schoolId: viewer.schoolId } } }] : []),
    ],
  };
}

export type Access = "open" | "sign-in" | "request" | "pending" | "declined";

/** What a viewer can do with a published book; the same rules as readableWhere, for one book. */
export function accessState(
  book: { visibility: string; ownerId: string | null },
  viewer: Viewer,
  reader: { status: string } | null,
  schoolGranted = false,
): Access {
  if (viewer?.role === "SUPER_ADMIN") return "open";
  if (!book.ownerId && book.visibility === "PUBLIC") return "open";
  if (!viewer) return "sign-in";
  if (schoolGranted || reader?.status === "APPROVED") return "open";
  if (!book.ownerId && book.visibility === "MEMBERS") return "open";
  if (reader?.status === "PENDING") return "pending";
  if (reader?.status === "DECLINED") return "declined";
  return "request";
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

/**
 * For the reader, scanner and print pages: lets the viewer through, or sends them where they can get
 * access. Visitors sign in first (a QR code on a printed book leads here); signed-in readers of a
 * locked library book go to its page to ask for access; anything else doesn't exist for them.
 */
export async function requireReadableBook(viewer: Viewer, bookId: string, here: string) {
  if (await canUserReadBook(viewer, bookId)) return;
  const book = await db.book.findFirst({ where: { id: bookId, published: true }, select: { ownerId: true } });
  if (!book) notFound();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(here)}`);
  if (!book.ownerId) redirect(`/library/${bookId}`);
  notFound();
}

/** The back cover drawn after the last page, in the reader and in print. */
export function backCoverFor(book: { id: string; updatedAt: Date }): string {
  return `/api/books/${encodeURIComponent(book.id)}/back-cover?v=${book.updatedAt.getTime()}`;
}

/** A book needs pages to be published. AR pages are optional, but must be compiled once there are some. */
export function canPublish(state: CompileState, pages: number): boolean {
  return pages > 0 && state !== "missing";
}
