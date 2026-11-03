import Link from "next/link";
import { Download, Heart, ScanLine } from "lucide-react";
import { Thumb } from "@/components/thumb";
import { compactNumber, type BookCardData } from "@/lib/library";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import { RatingSummary } from "./stars";

export function BookCover({ book, className, sizes = { width: 300, height: 400 } }: { book: Pick<BookCardData, "imageUrl" | "category" | "title">; className?: string; sizes?: { width: number; height: number } }) {
  return (
    <div
      className={cn("relative aspect-[3/4] overflow-hidden rounded-[22px] shadow-lift ring-1 ring-ink-900/5", className)}
      style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${book.category.color} 30%, white), color-mix(in oklab, ${book.category.color} 70%, white))` }}
    >
      {book.imageUrl ? (
        <Thumb src={book.imageUrl} alt={`Cover of ${book.title}`} width={sizes.width} height={sizes.height} className="size-full object-cover" />
      ) : (
        <div className="grid size-full place-items-center text-white">
          <SubjectIcon icon={book.category.icon} className="size-14 opacity-80" />
        </div>
      )}
    </div>
  );
}

export function BookCard({ book }: { book: BookCardData }) {
  return (
    <Link href={`/library/${book.id}`} className="group flex flex-col rounded-[24px] outline-offset-4">
      <div className="relative transition duration-300 group-hover:-translate-y-1 group-hover:rotate-[-0.6deg]">
        <BookCover book={book} />
        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
          {book.isNew && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-950 shadow-sm">New</span>}
          {book.ar && (
            <span className="flex items-center gap-1 rounded-full bg-ink-950/75 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
              <ScanLine aria-hidden="true" className="size-3" /> AR
            </span>
          )}
        </div>
        <span className="absolute top-2.5 right-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-emerald-700 shadow-sm backdrop-blur">Free</span>
      </div>
      <div className="mt-3 px-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: book.category.color }}>
          <SubjectIcon icon={book.category.icon} className="size-3.5 shrink-0" />
          <span className="truncate">{book.category.name}</span>
          {book.ages && <span className="shrink-0 font-medium text-ink-400">· {book.ages}</span>}
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-[17px] leading-snug font-bold text-ink-900 group-hover:text-brand-600">{book.title}</h3>
        <RatingSummary average={book.rating.average} count={book.rating.count} className="mt-1.5" />
        <div className="mt-1.5 flex items-center gap-3 text-xs font-medium text-ink-500">
          <span className="flex items-center gap-1" title={`${book.downloads} downloads`}>
            <Download aria-hidden="true" className="size-3.5" /> <span className="tabular-nums">{compactNumber(book.downloads)}</span>
            <span className="sr-only">{book.downloads === 1 ? "download" : "downloads"}</span>
          </span>
          <span className="flex items-center gap-1" title={`${book.likes} likes`}>
            <Heart aria-hidden="true" className="size-3.5" /> <span className="tabular-nums">{compactNumber(book.likes)}</span>
            <span className="sr-only">{book.likes === 1 ? "like" : "likes"}</span>
          </span>
        </div>
      </div>
    </Link>
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
