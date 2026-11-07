import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { BookGrid } from "@/components/library/book-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { libraryBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { bookCardSelect, LIBRARY_SORTS, libraryOrderBy, librarySort, toBookCard, type LibrarySort } from "@/lib/library";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn } from "@/lib/utils";
import { getI18n } from "@/lib/i18n/server";
import { categoryDescription, categoryName } from "@/lib/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.meta.library, description: t.meta.libraryDescription };
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; sort?: string }> }) {
  const params = await searchParams;
  const { t } = await getI18n();
  const l = t.library;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const category = typeof params.category === "string" ? params.category : undefined;
  const sort = librarySort(params.sort);

  const [categories, rows] = await Promise.all([
    db.subject.findMany({
      where: { books: { some: libraryBooksWhere } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, icon: true, color: true, description: true, _count: { select: { books: { where: libraryBooksWhere } } } },
    }),
    db.book.findMany({
      where: {
        ...libraryBooksWhere,
        ...(category && { subject: { slug: category } }),
        ...(query && { OR: [{ title: { contains: query } }, { description: { contains: query } }] }),
      },
      orderBy: libraryOrderBy(sort),
      take: 120,
      select: bookCardSelect,
    }),
  ]);
  const books = rows.map((b) => toBookCard(b));
  const active = categories.find((c) => c.slug === category);
  const total = categories.reduce((n, c) => n + c._count.books, 0);

  function href(next: { category?: string | null; sort?: LibrarySort; q?: string }) {
    const qs = new URLSearchParams();
    const c = next.category === null ? undefined : (next.category ?? category);
    const s = next.sort ?? sort;
    const q = next.q ?? query;
    if (c) qs.set("category", c);
    if (s !== "popular") qs.set("sort", s);
    if (q) qs.set("q", q);
    return `/library${qs.size ? `?${qs}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-6">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-600">{l.eyebrow}</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">{active ? categoryName(t, active.slug, active.name) : l.title}</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-600">
            {(active && categoryDescription(t, active.slug, active.description)) ?? l.intro}
          </p>
        </div>
        <form action="/library" className="flex w-full gap-2 lg:w-auto">
          {category && <input type="hidden" name="category" value={category} />}
          {sort !== "popular" && <input type="hidden" name="sort" value={sort} />}
          <div className="relative flex-1 lg:w-72">
            <Search aria-hidden="true" className="pointer-events-none absolute start-3.5 top-3 size-4 text-ink-400" />
            <Input type="search" name="q" key={query} defaultValue={query} maxLength={120} aria-label={l.searchStories} placeholder={l.searchStories} className="h-10 rounded-full bg-white ps-10" />
          </div>
          <Button type="submit" variant="secondary" className="rounded-full">
            {l.search}
          </Button>
        </form>
      </header>

      <div className="mt-8 flex flex-col gap-4 border-b border-[#eadfca] pb-5 md:flex-row md:items-center md:justify-between">
        <nav aria-label={l.categories} className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
          <Chip href={href({ category: null })} active={!category} label={l.all} count={total} />
          {categories.map((c) => (
            <Chip key={c.id} href={href({ category: c.slug })} active={c.slug === category} label={categoryName(t, c.slug, c.name)} count={c._count.books} color={c.color} icon={c.icon} />
          ))}
        </nav>
        <nav aria-label={l.sort} className="flex shrink-0 gap-1 rounded-full bg-white p-1 ring-1 ring-[#eadfca]">
          {(Object.keys(LIBRARY_SORTS) as LibrarySort[]).map((key) => (
            <Link
              key={key}
              href={href({ sort: key })}
              aria-current={key === sort ? "true" : undefined}
              className={cn("flex h-10 items-center rounded-full px-4 text-sm font-semibold transition", key === sort ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900")}
            >
              {l.sorts[key]}
            </Link>
          ))}
        </nav>
      </div>

      <p className="mt-5 mb-6 text-sm text-ink-500" aria-live="polite">
        {query ? <>{l.count(books.length)} {l.forQuery(query)} · <Link href={href({ q: "" })} className="font-semibold text-brand-600 hover:underline">{l.clearSearch}</Link></> : l.count(books.length)}
      </p>

      {books.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#e2d4b8] bg-white/60 px-6 py-16 text-center">
          <BookOpen aria-hidden="true" className="mx-auto size-8 text-brand-400" />
          <h2 className="mt-4 font-display text-xl font-bold text-ink-900">{query ? l.noMatch : l.noneYet}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">{query ? l.noMatchText : l.noneYetText}</p>
          <Link href="/library" className="mt-5 inline-block text-sm font-semibold text-brand-600 hover:underline">
            {l.seeAll}
          </Link>
        </div>
      ) : (
        <BookGrid books={books} />
      )}
    </div>
  );
}

function Chip({ href, active, label, count, color, icon }: { href: string; active: boolean; label: string; count: number; color?: string; icon?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border py-1.5 pe-3.5 text-sm font-semibold transition",
        icon ? "ps-1.5" : "ps-3.5",
        active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200/80 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
      )}
    >
      {icon && (
        <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: color }}>
          <SubjectIcon icon={icon} className="size-3.5" />
        </span>
      )}
      {label}
      <span className={cn("text-xs", active ? "text-white/60" : "text-ink-400")}>{count}</span>
    </Link>
  );
}
