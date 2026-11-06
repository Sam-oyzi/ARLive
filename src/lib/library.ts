import type { Prisma } from "@prisma/client";
import { compileState } from "./books";
import { visibilityOf, type Visibility } from "./visibility";

/** Everything a library card needs, in one select. */
export const bookCardSelect = {
  id: true,
  title: true,
  description: true,
  gradeLevel: true,
  coverUrl: true,
  mindUrl: true,
  mindHash: true,
  visibility: true,
  downloads: true,
  likeCount: true,
  ratingCount: true,
  ratingAvg: true,
  createdAt: true,
  subject: { select: { name: true, slug: true, color: true, icon: true } },
  targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, imageUrl: true, ar: true } },
} satisfies Prisma.BookSelect;

export type BookCardRow = Prisma.BookGetPayload<{ select: typeof bookCardSelect }>;

export type BookCardData = {
  id: string;
  title: string;
  description: string | null;
  ages: string | null;
  imageUrl: string | null;
  category: { name: string; slug: string; color: string; icon: string };
  pages: number;
  /** Has AR pages that a phone can scan right now. */
  ar: boolean;
  visibility: Visibility;
  downloads: number;
  likes: number;
  rating: { average: number; count: number };
  isNew: boolean;
};

const NEW_FOR_MS = 30 * 24 * 60 * 60 * 1000;

export function toBookCard(book: BookCardRow, now = Date.now()): BookCardData {
  const state = compileState(book, book.targets);
  return {
    id: book.id,
    title: book.title,
    description: book.description,
    ages: book.gradeLevel,
    imageUrl: book.coverUrl ?? book.targets[0]?.imageUrl ?? null,
    category: book.subject,
    pages: book.targets.length,
    ar: !!book.mindUrl && (state === "ready" || state === "stale"),
    visibility: visibilityOf(book.visibility),
    downloads: book.downloads,
    likes: book.likeCount,
    rating: { average: book.ratingAvg, count: book.ratingCount },
    isNew: now - book.createdAt.getTime() < NEW_FOR_MS,
  };
}

export const LIBRARY_SORTS = {
  popular: { label: "Most popular" },
  rating: { label: "Top rated" },
  new: { label: "Newest" },
} as const;

export type LibrarySort = keyof typeof LIBRARY_SORTS;

export function librarySort(value: unknown): LibrarySort {
  return typeof value === "string" && Object.hasOwn(LIBRARY_SORTS, value) ? (value as LibrarySort) : "popular";
}

export function libraryOrderBy(sort: LibrarySort): Prisma.BookOrderByWithRelationInput[] {
  if (sort === "rating") return [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }];
  if (sort === "new") return [{ createdAt: "desc" }];
  return [{ downloads: "desc" }, { likeCount: "desc" }, { ratingCount: "desc" }, { createdAt: "desc" }];
}

/** Average of 1–5 star ratings, rounded to one decimal; 0 when nobody has rated yet. */
export function averageStars(stars: number[]): number {
  if (stars.length === 0) return 0;
  return Math.round((stars.reduce((sum, s) => sum + s, 0) / stars.length) * 10) / 10;
}

export { compactNumber } from "./utils";
