"use client";

import Link from "next/link";
import { Heart, Lock, ScanLine, UserRound } from "lucide-react";
import { Thumb } from "@/components/thumb";
import type { BookCardData } from "@/lib/library";
import { useI18n } from "@/lib/i18n/client";
import { compactNumber } from "@/lib/i18n/format";
import { categoryName } from "@/lib/i18n/messages";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import { RatingSummary } from "./stars";

export function BookCover({ book, className, sizes = { width: 300, height: 400 } }: { book: Pick<BookCardData, "imageUrl" | "category" | "title">; className?: string; sizes?: { width: number; height: number } }) {
  const { t } = useI18n();
  return (
    <div
      className={cn("relative aspect-[3/4] overflow-hidden rounded-[22px] shadow-lift ring-1 ring-ink-900/5", className)}
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${book.category.color} 30%, white), color-mix(in oklab, ${book.category.color} 70%, white))` }}
    >
      {book.imageUrl ? (
        <Thumb src={book.imageUrl} alt={t.card.coverOf(book.title)} width={sizes.width} height={sizes.height} className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-white">
          <SubjectIcon icon={book.category.icon} className="size-14 opacity-80" />
        </div>
      )}
    </div>
  );
}

export function BookCard({ book }: { book: BookCardData }) {
  const { locale, t } = useI18n();
  return (
    <Link href={`/library/${book.id}`} className="group flex flex-col rounded-[24px] outline-offset-4">
      <div className="relative transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-0.6deg]">
        <BookCover book={book} />
        <div className="absolute start-2.5 top-2.5 flex flex-wrap gap-1.5">
          {book.isNew && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-950 shadow-sm">{t.card.new}</span>}
          {book.ar && (
            <span className="flex items-center gap-1 rounded-full bg-ink-950/75 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
              <ScanLine aria-hidden="true" className="size-3" /> AR
            </span>
          )}
        </div>
        <AccessBadge visibility={book.visibility} />
      </div>
      <div className="mt-3 px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: book.category.color }}>
          <SubjectIcon icon={book.category.icon} className="size-3.5 shrink-0" />
          <span className="truncate">{categoryName(t, book.category.slug, book.category.name)}</span>
          {book.ages && <span className="shrink-0 font-medium text-ink-400">· <bdi>{book.ages}</bdi></span>}
        </div>
        <h3 dir="auto" className="mt-1 line-clamp-2 font-display text-[17px] leading-snug font-bold text-ink-900 group-hover:text-brand-600">{book.title}</h3>
        <RatingSummary average={book.rating.average} count={book.rating.count} className="mt-1.5" />
        <div className="mt-1.5 flex items-center gap-3 text-xs font-medium text-ink-500">
          <span className="flex items-center gap-1" title={`${book.likes} ${t.card.likes(book.likes)}`}>
            <Heart aria-hidden="true" className="size-3.5" /> <span className="tabular-nums">{compactNumber(locale, book.likes)}</span>
            <span className="sr-only">{t.card.likes(book.likes)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/** Free for everyone, free with an account, or for approved readers only. */
export function AccessBadge({ visibility, className }: { visibility: BookCardData["visibility"]; className?: string }) {
  const { t } = useI18n();
  const base = "absolute end-2.5 top-2.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm backdrop-blur";
  if (visibility === "PUBLIC") return <span className={cn(base, "bg-white/90 text-emerald-700", className)}>{t.card.free}</span>;
  if (visibility === "MEMBERS") {
    return (
      <span className={cn(base, "bg-white/90 text-sky-700", className)} title={t.card.membersTitle}>
        <UserRound aria-hidden="true" className="size-3" /> {t.card.members}
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-ink-950/75 text-white", className)} title={t.card.onRequestTitle}>
      <Lock aria-hidden="true" className="size-3" /> {t.card.onRequest}
    </span>
  );
}

export function BookGrid({ books, className }: { books: BookCardData[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4 xl:grid-cols-5", className)}>
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
