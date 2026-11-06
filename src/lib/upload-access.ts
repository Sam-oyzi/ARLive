import { Prisma } from "@prisma/client";
import { getCurrentUser } from "./auth";
import { readableWhere } from "./books";
import { db } from "./db";

/** Uploaded files in R2 follow the visibility of the book or school that references them. */
export async function canReadUpload(url: string, kind: string) {
  const user = await getCurrentUser();
  if (user?.role === "SUPER_ADMIN") return true;
  if (kind === "logos") return !!user?.schoolId &&
    (await db.school.count({ where: { id: user.schoolId, logoUrl: url } })) > 0;
  // The library shows published covers even when the rest of the book requires access.
  if ((kind === "covers" || kind === "targets") && await db.book.findFirst({
    where: {
      published: true,
      ownerId: null,
      OR: [{ coverUrl: url }, { coverUrl: null, targets: { some: { order: 0, imageUrl: url } } }],
    },
    select: { id: true },
  })) return true;

  const translationPages = kind === "targets" || kind === "covers" ? await db.$queryRaw<{ bookId: string }[]>(Prisma.sql`
    SELECT DISTINCT "bookId" FROM "Target", json_each(COALESCE("translations", '{}'))
    WHERE json_extract(json_each.value, '$.imageUrl') = ${url}
  `) : [];
  return !!await db.book.findFirst({
    where: {
      AND: [readableWhere(user), {
        OR: [
          { coverUrl: url },
          { mindUrl: url },
          { id: { in: translationPages.map(({ bookId }) => bookId) } },
          { targets: { some: { OR: [
            { imageUrl: url }, { narrationUrl: url }, { worldUrl: url },
            { contents: { some: { url } } }, { sounds: { some: { url } } },
          ] } } },
        ],
      }],
    },
    select: { id: true },
  });
}
