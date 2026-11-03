import assert from "node:assert/strict";
import { test } from "node:test";
import { averageStars, compactNumber, librarySort, toBookCard, type BookCardRow } from "./library";

const row: BookCardRow = {
  id: "b1",
  title: "Lina and the Cloud",
  description: null,
  gradeLevel: "Ages 4–7",
  coverUrl: null,
  mindUrl: null,
  mindHash: null,
  downloads: 3,
  likeCount: 2,
  ratingCount: 1,
  ratingAvg: 5,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  subject: { name: "Bedtime", slug: "bedtime", color: "#3b82f6", icon: "book" },
  targets: [
    { id: "t1", imageUrl: "/files/targets/1.jpg", ar: false },
    { id: "t2", imageUrl: "/files/targets/2.jpg", ar: true },
  ],
};

test("averages star ratings to one decimal", () => {
  assert.equal(averageStars([]), 0);
  assert.equal(averageStars([5, 4]), 4.5);
  assert.equal(averageStars([5, 4, 4]), 4.3);
});

test("unknown sorts fall back to most popular", () => {
  assert.equal(librarySort("rating"), "rating");
  assert.equal(librarySort("constructor"), "popular");
  assert.equal(librarySort(undefined), "popular");
});

test("a card uses the cover, or else the first page", () => {
  assert.equal(toBookCard(row).imageUrl, "/files/targets/1.jpg");
  assert.equal(toBookCard({ ...row, coverUrl: "/files/covers/c.jpg" }).imageUrl, "/files/covers/c.jpg");
});

test("a card only offers AR once the AR pages are compiled", () => {
  assert.equal(toBookCard(row).ar, false);
  assert.equal(toBookCard({ ...row, mindUrl: "/files/mind/x.mind", mindHash: "old" }).ar, true);
});

test("books are new for 30 days", () => {
  const created = row.createdAt.getTime();
  assert.equal(toBookCard(row, created + 29 * 86400000).isNew, true);
  assert.equal(toBookCard(row, created + 31 * 86400000).isNew, false);
});

test("large counters are shortened", () => {
  assert.equal(compactNumber(950), "950");
  assert.equal(compactNumber(1234), "1.2K");
});
