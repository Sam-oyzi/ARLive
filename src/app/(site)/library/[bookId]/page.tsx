import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Box, Camera, FileText, Heart, Languages, Orbit, Printer, ScanLine, ShoppingBasket, Sparkles, type LucideIcon } from "lucide-react";
import { BookCover, BookGrid } from "@/components/library/book-card";
import { RatingSummary } from "@/components/library/stars";
import { Thumb } from "@/components/thumb";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { bookFormat } from "@/lib/book-format";
import { accessState, libraryBooksWhere, readableWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { bookCardSelect, libraryOrderBy, toBookCard } from "@/lib/library";
import { compactNumber } from "@/lib/i18n/format";
import { getI18n } from "@/lib/i18n/server";
import { categoryName, type Messages } from "@/lib/i18n/messages";
import { SubjectIcon } from "@/lib/subject-icons";
import { AccessPanel, LikeButton, RatingInput } from "./book-actions";
import { CoverActions, MoreActionsButton, type CoverAction } from "./cover-actions";
import { PaperBadge, type PaperBadgeKind } from "@/components/paper-badge";
import { opensModel, isPlaceableModel, scanActionOf, worldExperienceOf } from "@/lib/scan-actions";
import { nativeLanguageName } from "@/lib/reader-words";
import { cn } from "@/lib/utils";
import { readerHref, withReturnTo } from "@/lib/reader-navigation";

export async function generateMetadata({ params }: { params: Promise<{ bookId: string }> }): Promise<Metadata> {
  const { bookId } = await params;
  const book = await db.book.findFirst({ where: { id: bookId, ...libraryBooksWhere }, select: { title: true, description: true } });
  const { t } = await getI18n();
  return book ? { title: book.title, description: book.description ?? undefined } : { title: t.meta.story };
}

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const [user, { locale, t }] = await Promise.all([getCurrentUser(), getI18n()]);
  const b = t.book;
  // Every library book has a page, locked or not, so readers can ask for access. Custom stories
  // only exist for the readers they were shared with.
  const row = await db.book.findFirst({
    where: { id: bookId, OR: [libraryBooksWhere, readableWhere(user)] },
    select: { ...bookCardSelect, format: true, ownerId: true, subjectId: true, targets: { ...bookCardSelect.targets, select: { ...bookCardSelect.targets.select, name: true, scanAction: true, worldUrl: true, translations: true, contents: { select: { type: true, url: true, text: true } } } } },
  });
  if (!row) notFound();
  const book = toBookCard(row);
  const custom = !!row.ownerId;

  const [reader, schoolGrant] = await Promise.all([
    user ? db.bookReader.findUnique({ where: { bookId_email: { bookId, email: user.username } }, select: { status: true } }) : null,
    user?.schoolId ? db.schoolBook.findUnique({ where: { schoolId_bookId: { schoolId: user.schoolId, bookId } }, select: { bookId: true } }) : null,
  ]);
  const access = accessState(row, user, reader, !!schoolGrant);
  const open = access === "open";

  const [mine, related] = await Promise.all([
    user
      ? Promise.all([
          db.bookLike.findUnique({ where: { userId_bookId: { userId: user.id, bookId } }, select: { userId: true } }),
          db.bookRating.findUnique({ where: { userId_bookId: { userId: user.id, bookId } }, select: { stars: true } }),
        ])
      : [null, null],
    custom
      ? []
      : db.book.findMany({ where: { ...libraryBooksWhere, subjectId: row.subjectId, id: { not: bookId } }, orderBy: libraryOrderBy("popular"), take: 5, select: bookCardSelect }),
  ]);
  const [like, rating] = mine;
  const arPages = row.targets.filter((t) => t.ar).length;
  const modelPage = row.targets.find((target) => opensModel(target.scanAction) && target.contents.some(isPlaceableModel));
  const hasDirectExperience = !!modelPage || row.targets.some((target) => worldExperienceOf(target.scanAction, target.worldUrl));
  // What the pages can do, with the names the reader's badges use (explained on the home page).
  const count = (test: (page: NonNullable<typeof row>["targets"][number]) => boolean) => row.targets.filter(test).length;
  const allExperiences: { kind: PaperBadgeKind; count: number }[] = [
    { kind: "scan", count: book.ar ? count((page) => page.ar && scanActionOf(page.scanAction) === "ar") : 0 },
    { kind: "inside", count: count((page) => worldExperienceOf(page.scanAction, page.worldUrl) === "box") },
    { kind: "panorama", count: count((page) => worldExperienceOf(page.scanAction, page.worldUrl) === "panorama") },
    { kind: "model", count: count((page) => opensModel(page.scanAction) && page.contents.some(isPlaceableModel)) },
  ];
  const experiences = allExperiences.filter((experience) => experience.count > 0);
  const translated = new Set(row.targets.flatMap((t) => Object.keys((t.translations ?? {}) as Record<string, unknown>)));
  const languages = translated.size ? ["en", ...[...translated].filter((lang) => lang !== "en").sort()] : [];
  // Everything a reader can do with the book: buttons from tablets up, circles round the cover on a phone.
  const actions: CoverAction[] = open
    ? [
        ...(book.pages > 0 ? [{ key: "read" as const, href: `/read/${book.id}`, label: b.actions.read }] : []),
        ...(modelPage ? [{ key: "model" as const, href: withReturnTo(`/place/${book.id}/${modelPage.id}`, `/library/${book.id}`), label: b.actions.model }] : []),
        ...(book.ar ? [{ key: "scan" as const, href: withReturnTo(`/scan/${book.id}`, `/library/${book.id}`), label: b.actions.scan }] : []),
        // Printed copies are ordered from the basket (print files are for admins preparing them).
        ...(book.pages > 0 ? [{ key: "buy" as const, href: `/basket?add=${book.id}`, label: b.actions.buy }] : []),
      ]
    : [];
  const secondary = actions.filter((action) => action.key !== "read");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6">
      <Link href={custom ? "/account" : "/library"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" /> {custom ? b.myAccount : t.common.library}
      </Link>

      {/* Tablets up: the cover on the left (it stays in view while the details scroll), the details beside it. */}
      <div className="mt-4 grid gap-7 sm:mt-6 md:grid-cols-[260px_1fr] md:items-start md:gap-10 lg:grid-cols-[340px_1fr] lg:gap-14">
        <div className="mx-auto w-full max-w-[188px] sm:max-w-[230px] md:sticky md:top-24 md:max-w-none">
          {actions.length > 0 ? (
            <CoverActions actions={actions} title={book.title}>
              <BookCover book={book} sizes={{ width: 380, height: 507 }} className="rounded-[24px] ring-[6px] ring-white sm:rounded-[28px] sm:ring-8" />
            </CoverActions>
          ) : (
            <BookCover book={book} sizes={{ width: 380, height: 507 }} className="rounded-[24px] ring-[6px] ring-white sm:rounded-[28px] sm:ring-8" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Link href={`/library?category=${book.category.slug}`} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 ring-1 ring-[#eadfca]" style={{ color: book.category.color }}>
              <SubjectIcon icon={book.category.icon} className="size-4" /> {categoryName(t, book.category.slug, book.category.name)}
            </Link>
            {book.ages && <bdi className="rounded-full bg-white px-3 py-1 text-ink-600 ring-1 ring-[#eadfca]">{book.ages}</bdi>}
            {custom ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                <Sparkles aria-hidden="true" className="size-4" /> {b.madeForFamily}
              </span>
            ) : book.visibility === "PUBLIC" ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">{b.free}</span>
            ) : (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 ring-1 ring-sky-100">{book.visibility === "MEMBERS" ? b.freeWithAccount : b.forApproved}</span>
            )}
          </div>

          <h1 dir="auto" className="mt-4 font-display text-[34px] leading-tight font-bold tracking-tight text-balance text-ink-900 sm:text-5xl">{book.title}</h1>
          {!custom && <RatingSummary average={book.rating.average} count={book.rating.count} size="md" className="mt-3 text-sm" />}
          {book.description && <p dir="auto" className="mt-4 max-w-2xl text-[17px] leading-relaxed text-pretty text-ink-600 sm:mt-5 sm:text-lg">{book.description}</p>}

          {!open && <AccessPanel bookId={book.id} access={access} visibility={custom ? "APPROVED" : book.visibility} />}

          {actions.length > 0 && (
            <div className="mt-7 max-w-xl sm:mt-8">
              {actions[0]?.key === "read" && (
                <ButtonLink href={actions[0].href} size="lg" className="h-14 w-full text-[17px] shadow-glow">
                  <BookOpen /> {b.readNow}
                </ButtonLink>
              )}
              {secondary.length > 0 && (
                <>
                  {/* Phones: the rest pop out of the cover. */}
                  <MoreActionsButton className={cn(buttonClasses("outline", "lg"), "mt-3 w-full md:hidden")}>
                    {secondary.map((action) => b.short[action.key]).join(" · ")}
                  </MoreActionsButton>
                  {/* Tablets up: one even row, however many there are. */}
                  <div className="mt-3 hidden gap-3 md:grid" style={{ gridTemplateColumns: `repeat(${secondary.length}, minmax(0, 1fr))` }}>
                    {secondary.map((action) => {
                      const Icon = ACTION_ICON[action.key];
                      return (
                        <ButtonLink key={action.key} href={action.href} size="lg" variant={action.key === "model" ? "secondary" : "outline"} className="h-12 min-w-0 gap-2 px-3 text-[15px]">
                          <Icon />
                          {/* Full names once the row is wide enough for them; short ones until then. */}
                          <span className="truncate xl:hidden">{b.short[action.key]}</span>
                          <span className="hidden truncate xl:inline">{action.label}</span>
                        </ButtonLink>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {open && (experiences.length > 0 || languages.length > 0) && (
            <div className="mt-6 max-w-2xl">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xs font-bold tracking-wide text-ink-500 uppercase">{b.inThisBook}</h2>
                {experiences.length > 0 && (
                  <Link href="/#experiences" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                    {b.whatMean} <ArrowRight aria-hidden="true" className="size-3.5 rtl:-scale-x-100" />
                  </Link>
                )}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {experiences.map((experience) => (
                  <Experience key={experience.kind} kind={experience.kind} label={b.kinds[experience.kind]} detail={b.units[experience.kind](experience.count)} />
                ))}
                {languages.length > 0 && (
                  <li className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink-700 ring-1 ring-[#eadfca]">
                    <Languages aria-hidden="true" className="size-4 text-ink-500" />
                    {languages.map((lang, i) => (
                      <span key={lang}>
                        {i > 0 && <span aria-hidden="true" className="mx-1 text-ink-300">·</span>}
                        <bdi lang={lang}>{nativeLanguageName(lang)}</bdi>
                      </span>
                    ))}
                  </li>
                )}
              </ul>
            </div>
          )}

          <dl className="mt-8 grid max-w-2xl grid-cols-3 gap-3">
            <Fact icon={Heart} label={b.facts.likes} value={compactNumber(locale, book.likes)} />
            <Fact icon={FileText} label={b.facts.pages} value={String(book.pages)} />
            <Fact icon={ScanLine} label={b.facts.arPages} value={String(arPages)} />
          </dl>

          {!custom && open && (
            <div className="mt-8 flex max-w-2xl flex-col gap-5 rounded-[24px] bg-white p-5 ring-1 ring-[#eadfca] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display font-bold text-ink-900">{b.enjoy}</p>
                <div className="mt-2">
                  <RatingInput bookId={book.id} mine={rating?.stars ?? null} signedIn={!!user} />
                </div>
              </div>
              <LikeButton bookId={book.id} liked={!!like} likes={book.likes} signedIn={!!user} />
            </div>
          )}

          {open && arPages > 0 && (
            <div className="mt-6 flex max-w-2xl gap-3 rounded-[20px] bg-ink-950 p-4 text-sm text-white/80">
              <Printer aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-300" />
              <p>
                {hasDirectExperience ? <><span className="font-semibold text-white">{b.phoneQ}</span> {b.phoneText} </> : null}
                <span className="font-semibold text-white">{b.printedQ}</span> {b.printedBefore} <span className="font-semibold text-white">«{b.actions.scan}»</span> {b.printedAfter}
                {" "}{b.format(`\u2068${bookFormat(row.format).label}\u2069`)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Locked books keep their pages to themselves. */}
      {open && row.targets.length > 1 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-ink-900">{b.inside}</h2>
          <div className="-mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-none sm:mx-0 sm:px-0">
            {row.targets.slice(0, 12).map((page, i) => (
              <Link key={page.id} href={readerHref(book.id, page.id)} className="group w-28 shrink-0 sm:w-32">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-[#eadfca]">
                  <Thumb src={page.imageUrl} width={128} height={171} className="size-full object-cover transition group-hover:scale-105" />
                  <PageBadge page={page} words={b.badges} />
                </div>
                <p className="mt-1.5 truncate text-xs font-medium text-ink-600">
                  {i + 1}. <bdi>{page.name}</bdi>
                </p>
              </Link>
            ))}
          </div>
          {row.targets.length > 12 && <p className="text-sm text-ink-500">{b.morePages(row.targets.length - 12)}</p>}
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-ink-900">{b.more(categoryName(t, book.category.slug, book.category.name))}</h2>
          <BookGrid books={related.map((b) => toBookCard(b))} />
        </section>
      )}

      {!custom && (
        <section className="mt-16 flex flex-col items-start gap-4 rounded-[28px] bg-gradient-to-br from-brand-500 to-brand-700 p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <h2 className="font-display text-2xl font-bold">{b.customTitle}</h2>
            <p className="mt-2 max-w-lg text-white/90">{b.customText}</p>
          </div>
          <ButtonLink href="/stories" size="lg" className="bg-white text-brand-700 shadow-none hover:bg-white/90">
            <Sparkles /> {b.askCustom}
          </ButtonLink>
        </section>
      )}
    </div>
  );
}

const ACTION_ICON: Record<CoverAction["key"], LucideIcon> = { read: BookOpen, model: Box, scan: Camera, buy: ShoppingBasket };

function Experience({ kind, label, detail }: { kind: PaperBadgeKind; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-2 py-1 pe-1 text-sm">
      <PaperBadge kind={kind} label={label} size="sm" tilt={-1} />
      <span className="font-medium text-ink-600">{detail}</span>
    </li>
  );
}

/** The badge a page shows in the reader, small, on its thumbnail. */
function PageBadge({ page, words }: { page: { ar: boolean; scanAction: string; worldUrl: string | null }; words: Messages["book"]["badges"] }) {
  const world = worldExperienceOf(page.scanAction, page.worldUrl);
  const kind: PaperBadgeKind | null = opensModel(page.scanAction) ? "model" : world === "box" ? "inside" : world === "panorama" ? "panorama" : page.ar ? "scan" : null;
  if (!kind) return null;
  return <PaperBadge kind={kind} label={words[kind]} size="xs" tilt={2} className="absolute end-2 bottom-2" />;
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-[#eadfca]">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
        <Icon aria-hidden="true" className="size-3.5" /> {label}
      </dt>
      <dd className="mt-0.5 font-display text-xl font-bold text-ink-900 tabular-nums">{value}</dd>
    </div>
  );
}
