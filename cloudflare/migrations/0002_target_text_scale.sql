-- Studio's text size for a page's story words (Target.textScale in prisma/schema.prisma): a share of the
-- size that fits, 0.6 to 1.6. Translations keep their own size in "translations".
ALTER TABLE "Target" ADD COLUMN "textScale" REAL NOT NULL DEFAULT 1;
