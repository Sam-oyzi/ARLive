import Link from "next/link";
import { ArrowRight, BookOpen, Camera, Download, Heart, Laptop, Printer, Smartphone, Sparkles, Star, Wand2 } from "lucide-react";
import { PageExperiences } from "@/components/home/page-experiences";
import { BookCover, BookGrid } from "@/components/library/book-card";
import { ButtonLink } from "@/components/ui/button";
import { libraryBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { bookCardSelect, libraryOrderBy, toBookCard, type BookCardData } from "@/lib/library";
import { compactNumber } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import { categoryName, type Messages } from "@/lib/i18n/messages";
import { STORY_GOALS, type StoryGoal } from "@/lib/stories";
import { SubjectIcon } from "@/lib/subject-icons";

export default async function Home() {
  const { locale, t } = await getI18n();
  const h = t.home;
  const [popularRows, ratedRows, newRows, featuredRows, categories, totals] = await Promise.all([
    db.book.findMany({ where: libraryBooksWhere, orderBy: libraryOrderBy("popular"), take: 10, select: bookCardSelect }),
    db.book.findMany({ where: { ...libraryBooksWhere, ratingCount: { gt: 0 } }, orderBy: libraryOrderBy("rating"), take: 5, select: bookCardSelect }),
    db.book.findMany({ where: libraryBooksWhere, orderBy: libraryOrderBy("new"), take: 5, select: bookCardSelect }),
    db.book.findMany({ where: { ...libraryBooksWhere, featured: true }, orderBy: libraryOrderBy("popular"), take: 3, select: bookCardSelect }),
    db.subject.findMany({
      where: { books: { some: libraryBooksWhere } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, icon: true, color: true, _count: { select: { books: { where: libraryBooksWhere } } } },
    }),
    db.book.aggregate({ where: { ...libraryBooksWhere, visibility: { in: ["PUBLIC", "MEMBERS"] } }, _count: { _all: true }, _sum: { downloads: true, likeCount: true } }),
  ]);
  const popular = popularRows.map((b) => toBookCard(b));
  const topRated = ratedRows.map((b) => toBookCard(b));
  const newest = newRows.map((b) => toBookCard(b));
  // The hero fans out featured books, topped up with the most popular ones.
  // Extra shelves only help once the library is bigger than the first one; before that they repeat it.
  const moreShelves = totals._count._all > popular.length;
  const hero = [...featuredRows.map((b) => toBookCard(b)), ...popular].filter((b, i, all) => all.findIndex((x) => x.id === b.id) === i).slice(0, 3);

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="absolute -top-32 -left-24 size-[420px] rounded-full bg-amber-200/50 blur-[90px]" />
        <div aria-hidden="true" className="absolute top-20 -right-32 size-[460px] rounded-full bg-sky-200/60 blur-[100px]" />
        <div aria-hidden="true" className="absolute bottom-0 left-1/3 size-[300px] rounded-full bg-brand-200/50 blur-[90px]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-24">
          <div className="text-center lg:text-start">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-xs font-bold text-brand-700 shadow-soft ring-1 ring-brand-100">
              <BookOpen aria-hidden="true" className="size-3.5" /> {h.badge}
            </span>
            <h1 className="mt-6 font-display text-[42px] leading-[1.02] font-bold tracking-tight text-ink-900 sm:text-6xl lg:text-[68px]">
              {h.titleA}
              <br />
              <span className="bg-gradient-to-r from-brand-700 via-brand-500 to-emerald-500 bg-clip-text text-transparent rtl:bg-gradient-to-l">{h.titleB}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-600 lg:mx-0">{h.intro}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <ButtonLink href="/library" size="lg" className="shadow-glow">
                <BookOpen /> {h.explore}
              </ButtonLink>
              <ButtonLink href="/stories" size="lg" variant="outline" className="border-ink-200/80 bg-white/80">
                <Wand2 /> {h.askCustom}
              </ButtonLink>
            </div>
            <a href="#experiences" className="mt-5 hidden items-center gap-1.5 text-sm font-semibold text-ink-600 underline decoration-ink-300 underline-offset-4 hover:text-ink-900 lg:inline-flex">
              <Sparkles aria-hidden="true" className="size-4 text-brand-500" /> {h.whatMean}
            </a>
            <dl className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm lg:justify-start">
              <Stat icon={BookOpen} value={totals._count._all} label={h.books} locale={locale} />
              <Stat icon={Download} value={totals._sum.downloads ?? 0} label={h.downloads} locale={locale} />
              <Stat icon={Heart} value={totals._sum.likeCount ?? 0} label={h.likes} locale={locale} />
            </dl>
          </div>

          {/* Phones go straight from the words to what the pages can do; the books are on the shelf below. */}
          <div className="hidden lg:block">
            <HeroBooks books={hero} t={t} locale={locale} />
          </div>
        </div>
      </section>

      <PageExperiences />

      {/* categories */}
      {categories.length > 0 && (
        <section aria-label={h.categories} className="border-y border-[#eadfca] bg-white/60 py-4">
          <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 scrollbar-none sm:px-6">
            <Link href="/library" className="flex shrink-0 items-center gap-2 rounded-full bg-ink-900 py-1.5 ps-3 pe-4 text-sm font-semibold text-white">
              {h.allStories}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/library?category=${c.slug}`}
                className="flex shrink-0 items-center gap-2 rounded-full border border-ink-200/70 bg-white py-1.5 ps-1.5 pe-4 text-sm font-semibold text-ink-700 transition hover:border-ink-300 hover:text-ink-900"
              >
                <span className="grid size-7 place-items-center rounded-full text-white" style={{ background: c.color }}>
                  <SubjectIcon icon={c.icon} className="size-3.5" />
                </span>
                {categoryName(t, c.slug, c.name)}
                <span className="text-xs text-ink-400">{c._count.books}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {popular.length === 0 ? (
          <div className="my-16 rounded-[28px] border border-dashed border-[#e2d4b8] bg-white/60 px-6 py-14 text-center">
            <BookOpen aria-hidden="true" className="mx-auto size-8 text-brand-400" />
            <h2 className="mt-4 font-display text-xl font-bold text-ink-900">{h.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">{h.emptyText}</p>
          </div>
        ) : (
          <>
            <Shelf title={h.mostLoved} subtitle={h.mostLovedSub} href="/library" books={popular} seeAll={h.seeAll} />
            {moreShelves && topRated.length > 0 && <Shelf title={h.topRated} subtitle={h.topRatedSub} href="/library?sort=rating" books={topRated} seeAll={h.seeAll} />}
            {moreShelves && newest.length > 0 && <Shelf title={h.newIn} subtitle={h.newInSub} href="/library?sort=new" books={newest} seeAll={h.seeAll} />}
          </>
        )}
      </div>

      {/* how it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{h.howTitle}</h2>
          <p className="mt-3 text-lg text-ink-500">{h.howSub}</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            { icon: Laptop, color: "bg-brand-500", ...h.steps[0]! },
            { icon: Printer, color: "bg-sky-500", ...h.steps[1]! },
            { icon: Camera, color: "bg-emerald-500", ...h.steps[2]! },
          ].map((step, i) => (
            <div key={step.title} className="relative rounded-[28px] bg-white p-7 shadow-soft ring-1 ring-[#eadfca]">
              <span className="absolute end-7 top-6 font-display text-6xl font-bold text-[#f1e8d6]">{i + 1}</span>
              <span className={`relative grid size-12 place-items-center rounded-2xl text-white shadow-lift ${step.color}`}>
                <step.icon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="relative mt-6 font-display text-xl font-bold text-ink-900">{step.title}</h3>
              <p className="relative mt-2 text-[15px] leading-relaxed text-ink-500">{step.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 flex items-center justify-center gap-4 text-sm text-ink-500">
          <span className="flex items-center gap-1.5"><Smartphone aria-hidden="true" className="size-4" /> {h.phones}</span>
          <span className="flex items-center gap-1.5"><Laptop aria-hidden="true" className="size-4" /> {h.laptops}</span>
        </p>
      </section>

      {/* custom stories */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-teal-700 to-cyan-800 px-6 py-12 text-white sm:px-12 sm:py-16">
          <div aria-hidden="true" className="absolute -top-24 -right-20 size-80 rounded-full bg-amber-300/40 blur-[100px]" />
          <div aria-hidden="true" className="absolute -bottom-24 -left-10 size-72 rounded-full bg-brand-400/30 blur-[100px]" />
          <div className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-amber-200">
                <Sparkles aria-hidden="true" className="size-3.5" /> {h.customBadge}
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight sm:text-4xl">{h.customTitle}</h2>
              <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-white/85">{h.customText}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/stories" size="lg" className="bg-white text-ink-950 shadow-none hover:bg-white/90">
                  {h.askStory} <ArrowRight className="rtl:-scale-x-100" />
                </ButtonLink>
              </div>
            </div>
            <ul className="flex flex-wrap gap-2">
              {(Object.keys(STORY_GOALS) as StoryGoal[])
                .filter((key) => key !== "other")
                .map((key) => (
                  <li key={key} className="flex items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-2 text-sm font-semibold ring-1 ring-white/10">
                    <span aria-hidden="true">{STORY_GOALS[key].emoji}</span> {t.stories.goals[key]}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ icon: Icon, value, label: word, locale }: { icon: typeof BookOpen; value: number; label: (count: number) => string; locale: Locale }) {
  // The words carry a "#" where the number goes (Arabic says "كتابان", two books, with no number).
  const [before, after] = word(value).split("#");
  const number = <span className="font-display text-lg font-bold text-ink-900 tabular-nums">{compactNumber(locale, value)}</span>;
  return (
    <div className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-brand-500" />
      <dt className="sr-only">{(before + (after ?? "")).trim()}</dt>
      <dd className="text-ink-500">
        {after === undefined ? <span className="font-semibold text-ink-800">{before}</span> : <>{before}{number}{after}</>}
      </dd>
    </div>
  );
}

function Shelf({ title, subtitle, href, books, seeAll }: { title: string; subtitle: string; href: string; books: BookCardData[]; seeAll: string }) {
  return (
    <section className="pt-14">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-ink-500 sm:text-[15px]">{subtitle}</p>
        </div>
        <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
          {seeAll} <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </Link>
      </div>
      <BookGrid books={books} />
    </section>
  );
}

/** Up to three covers fanned out like books on a table. */
function HeroBooks({ books, t, locale }: { books: BookCardData[]; t: Messages; locale: Locale }) {
  if (books.length === 0) {
    return (
      <div className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center rounded-[40px] bg-white/70 shadow-lift ring-1 ring-[#eadfca]">
        <BookOpen aria-hidden="true" className="size-20 text-brand-300" />
      </div>
    );
  }
  // Inline transforms so the slot position doesn't fight Tailwind's translate utilities.
  const SLOTS = {
    center: "translate(-50%, -54%)",
    left: "translate(-104%, -44%) rotate(-9deg)",
    right: "translate(4%, -44%) rotate(9deg)",
  };
  const slots: (keyof typeof SLOTS)[] = books.length === 1 ? ["center"] : books.length === 2 ? ["left", "right"] : ["center", "left", "right"];
  const lead = books[0]!;
  return (
    <div className="relative mx-auto h-[340px] w-full max-w-md sm:h-[420px]">
      {books.map((book, i) => (
        <Link
          key={book.id}
          href={`/library/${book.id}`}
          aria-label={book.title}
          className={`absolute top-1/2 left-1/2 w-[46%] transition-[scale] duration-500 hover:z-30 hover:scale-105 ${slots[i] === "center" ? "z-10" : ""}`}
          style={{ transform: SLOTS[slots[i]!] }}
        >
          <BookCover book={book} sizes={{ width: 240, height: 320 }} className="rounded-[18px] ring-4 ring-white" />
        </Link>
      ))}
      <span className="absolute top-4 left-0 z-20 flex animate-float items-center gap-1.5 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-ink-900 shadow-lift sm:left-4">
        <Star aria-hidden="true" className="size-4 text-amber-400" fill="currentColor" strokeWidth={0} />
        {lead.rating.count > 0 ? lead.rating.average.toFixed(1) : t.home.heroNew}
      </span>
      <span className="absolute right-0 bottom-6 z-20 flex animate-float items-center gap-1.5 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-ink-900 shadow-lift [animation-delay:1.2s] sm:right-4">
        <Heart aria-hidden="true" className="size-4 text-rose-500" fill="currentColor" strokeWidth={0} /> {compactNumber(locale, lead.likes)}
      </span>
      {lead.ar && (
        <span className="absolute bottom-2 left-6 z-20 flex animate-float items-center gap-1.5 rounded-2xl bg-ink-950 px-3 py-2 text-sm font-bold text-white shadow-lift [animation-delay:0.6s]">
          <Camera aria-hidden="true" className="size-4" /> {t.home.scan3d}
        </span>
      )}
    </div>
  );
}
