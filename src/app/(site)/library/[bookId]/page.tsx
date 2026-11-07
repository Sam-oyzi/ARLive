import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Box, Camera, Download, FileText, Heart, Languages, Orbit, Printer, ScanLine, Sparkles, type LucideIcon } from "lucide-react";
import { BookCover, BookGrid } from "@/components/library/book-card";
import { RatingSummary } from "@/components/library/stars";
import { Thumb } from "@/components/thumb";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { bookFormat } from "@/lib/book-format";
import { accessState, libraryBooksWhere, readableWhere, VISIBILITIES } from "@/lib/books";
import { db } from "@/lib/db";
import { bookCardSelect, compactNumber, libraryOrderBy, toBookCard } from "@/lib/library";
import { SubjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/utils";
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
  return book ? { title: book.title, description: book.description ?? undefined } : { title: "Story" };
}

export default async function BookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const user = await getCurrentUser();
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
  const allExperiences: { kind: PaperBadgeKind; label: string; count: number; unit: string }[] = [
    { kind: "scan", label: "Scan", count: book.ar ? count((t) => t.ar && scanActionOf(t.scanAction) === "ar") : 0, unit: "page" },
    { kind: "inside", label: "Step inside", count: count((t) => worldExperienceOf(t.scanAction, t.worldUrl) === "box"), unit: "world" },
    { kind: "panorama", label: "360° view", count: count((t) => worldExperienceOf(t.scanAction, t.worldUrl) === "panorama"), unit: "scene" },
    { kind: "model", label: "Place model", count: count((t) => opensModel(t.scanAction) && t.contents.some(isPlaceableModel)), unit: "character" },
  ];
  const experiences = allExperiences.filter((experience) => experience.count > 0);
  const translated = new Set(row.targets.flatMap((t) => Object.keys((t.translations ?? {}) as Record<string, unknown>)));
  const languages = translated.size ? ["en", ...[...translated].filter((lang) => lang !== "en").sort()] : [];
  // Everything a reader can do with the book: buttons from tablets up, circles round the cover on a phone.
  const actions: CoverAction[] = open
    ? [
        ...(book.pages > 0 ? [{ key: "read" as const, href: `/read/${book.id}`, label: "Read now" }] : []),
        ...(modelPage ? [{ key: "model" as const, href: withReturnTo(`/place/${book.id}/${modelPage.id}`, `/library/${book.id}`), label: "Place a model" }] : []),
        ...(book.ar ? [{ key: "scan" as const, href: withReturnTo(`/scan/${book.id}`, `/library/${book.id}`), label: "Scan printed book" }] : []),
        ...(book.pages > 0 ? [{ key: "download" as const, href: `/print/${book.id}`, label: "Download PDF" }] : []),
      ]
    : [];
  const secondary = actions.filter((action) => action.key !== "read");

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6">
      <Link href={custom ? "/account" : "/library"} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft aria-hidden="true" className="size-4" /> {custom ? "My account" : "Library"}
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
              <SubjectIcon icon={book.category.icon} className="size-4" /> {book.category.name}
            </Link>
            {book.ages && <span className="rounded-full bg-white px-3 py-1 text-ink-600 ring-1 ring-[#eadfca]">{book.ages}</span>}
            {custom ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                <Sparkles aria-hidden="true" className="size-4" /> Made for your family
              </span>
            ) : book.visibility === "PUBLIC" ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 ring-1 ring-emerald-100">Free</span>
            ) : (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 ring-1 ring-sky-100">{book.visibility === "MEMBERS" ? "Free with an account" : VISIBILITIES.APPROVED.label}</span>
            )}
          </div>

          <h1 className="mt-4 font-display text-[34px] leading-tight font-bold tracking-tight text-balance text-ink-900 sm:text-5xl">{book.title}</h1>
          {!custom && <RatingSummary average={book.rating.average} count={book.rating.count} size="md" className="mt-3 text-sm" />}
          {book.description && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-pretty text-ink-600 sm:mt-5 sm:text-lg">{book.description}</p>}

          {!open && <AccessPanel bookId={book.id} access={access} visibility={custom ? "APPROVED" : book.visibility} />}

          {actions.length > 0 && (
            <div className="mt-7 max-w-xl sm:mt-8">
              {actions[0]?.key === "read" && (
                <ButtonLink href={actions[0].href} size="lg" className="h-14 w-full text-[17px] shadow-glow">
                  <BookOpen /> Read now
                </ButtonLink>
              )}
              {secondary.length > 0 && (
                <>
                  {/* Phones: the rest pop out of the cover. */}
                  <MoreActionsButton className={cn(buttonClasses("outline", "lg"), "mt-3 w-full md:hidden")}>
                    {secondary.map((action) => SHORT_LABEL[action.key]).join(" · ")}
                  </MoreActionsButton>
                  {/* Tablets up: one even row, however many there are. */}
                  <div className="mt-3 hidden gap-3 md:grid" style={{ gridTemplateColumns: `repeat(${secondary.length}, minmax(0, 1fr))` }}>
                    {secondary.map((action) => {
                      const Icon = ACTION_ICON[action.key];
                      return (
                        <ButtonLink key={action.key} href={action.href} size="lg" variant={action.key === "model" ? "secondary" : "outline"} className="h-12 min-w-0 gap-2 px-3 text-[15px]">
                          <Icon />
                          {/* Full names once the row is wide enough for them; short ones until then. */}
                          <span className="truncate xl:hidden">{SHORT_LABEL[action.key]}</span>
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
                <h2 className="text-xs font-bold tracking-wide text-ink-500 uppercase">In this book</h2>
                {experiences.length > 0 && (
                  <Link href="/#experiences" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                    What do these mean? <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                )}
              </div>
              <ul className="mt-2.5 flex flex-wrap gap-2">
                {experiences.map((experience) => (
                  <Experience key={experience.label} kind={experience.kind} label={experience.label} detail={plural(experience.count, experience.unit)} />
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

          <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={Download} label="Downloads" value={compactNumber(book.downloads)} />
            <Fact icon={Heart} label="Likes" value={compactNumber(book.likes)} />
            <Fact icon={FileText} label="Pages" value={String(book.pages)} />
            <Fact icon={ScanLine} label="AR pages" value={String(arPages)} />
          </dl>

          {!custom && open && (
            <div className="mt-8 flex max-w-2xl flex-col gap-5 rounded-[24px] bg-white p-5 ring-1 ring-[#eadfca] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display font-bold text-ink-900">Did you enjoy it?</p>
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
                {hasDirectExperience ? <><span className="font-semibold text-white">Reading on a phone?</span> Tap the blue badge on a page (Step inside, Look around or Place model) to open it straight away. </> : null}
                <span className="font-semibold text-white">Using a printed book?</span> Tap <span className="font-semibold text-white">Scan printed book</span> and point your phone at a page marked AR.
                {" "}{bookFormat(row.format).label} pages.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Locked books keep their pages to themselves. */}
      {open && row.targets.length > 1 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-ink-900">Inside the book</h2>
          <div className="-mx-4 mt-5 flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-none sm:mx-0 sm:px-0">
            {row.targets.slice(0, 12).map((page, i) => (
              <Link key={page.id} href={readerHref(book.id, page.id)} className="group w-28 shrink-0 sm:w-32">
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-[#eadfca]">
                  <Thumb src={page.imageUrl} width={128} height={171} className="size-full object-cover transition group-hover:scale-105" />
                  <PageBadge page={page} />
                </div>
                <p className="mt-1.5 truncate text-xs font-medium text-ink-600">
                  {i + 1}. {page.name}
                </p>
              </Link>
            ))}
          </div>
          {row.targets.length > 12 && <p className="text-sm text-ink-500">and {plural(row.targets.length - 12, "more page")}.</p>}
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 font-display text-2xl font-bold text-ink-900">More {book.category.name.toLowerCase()} stories</h2>
          <BookGrid books={related.map((b) => toBookCard(b))} />
        </section>
      )}

      {!custom && (
        <section className="mt-16 flex flex-col items-start gap-4 rounded-[28px] bg-gradient-to-br from-brand-500 to-brand-700 p-7 text-white sm:flex-row sm:items-center sm:justify-between sm:p-9">
          <div>
            <h2 className="font-display text-2xl font-bold">Want a story about your child?</h2>
            <p className="mt-2 max-w-lg text-white/90">Tell us the lesson you have in mind and we&apos;ll write a story starring your child.</p>
          </div>
          <ButtonLink href="/stories" size="lg" className="bg-white text-brand-700 shadow-none hover:bg-white/90">
            <Sparkles /> Ask for a custom story
          </ButtonLink>
        </section>
      )}
    </div>
  );
}

const ACTION_ICON: Record<CoverAction["key"], LucideIcon> = { read: BookOpen, model: Box, scan: Camera, download: Download };
const SHORT_LABEL: Record<CoverAction["key"], string> = { read: "Read", model: "Place model", scan: "Scan book", download: "Download" };

function Experience({ kind, label, detail }: { kind: PaperBadgeKind; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-2 py-1 pr-1 text-sm">
      <PaperBadge kind={kind} label={label} size="sm" tilt={-1} />
      <span className="font-medium text-ink-600">{detail}</span>
    </li>
  );
}

/** The badge a page shows in the reader, small, on its thumbnail. */
function PageBadge({ page }: { page: { ar: boolean; scanAction: string; worldUrl: string | null } }) {
  const world = worldExperienceOf(page.scanAction, page.worldUrl);
  const [kind, label]: [PaperBadgeKind, string] | [null, ""] = opensModel(page.scanAction)
    ? ["model", "Place model"]
    : world === "box"
      ? ["inside", "Step inside"]
      : world === "panorama"
        ? ["panorama", "360°"]
        : page.ar
          ? ["scan", "Scan"]
          : [null, ""];
  if (!kind) return null;
  return <PaperBadge kind={kind} label={label} size="xs" tilt={2} className="absolute right-2 bottom-2" />;
}

function Fact({ icon: Icon, label, value }: { icon: typeof Download; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-[#eadfca]">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
        <Icon aria-hidden="true" className="size-3.5" /> {label}
      </dt>
      <dd className="mt-0.5 font-display text-xl font-bold text-ink-900 tabular-nums">{value}</dd>
    </div>
  );
}
