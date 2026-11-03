import Link from "next/link";
import { ArrowUpRight, BookOpen, Download, Heart, Plus, Search, Star } from "lucide-react";
import { CompileBadge } from "@/components/compile-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Thumb } from "@/components/thumb";
import { requireUser } from "@/lib/auth";
import { compileState } from "@/lib/books";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn, plural } from "@/lib/utils";
import { BookDialog } from "./book-dialog";

export const metadata = { title: "Books & AR pages" };

const AUDIENCES = { library: "Library", custom: "Custom stories" } as const;
type Audience = keyof typeof AUDIENCES;

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ subject?: string; q?: string; audience?: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const params = await searchParams;
  const subjectFilter = typeof params.subject === "string" ? params.subject : undefined;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const audience = params.audience === "library" || params.audience === "custom" ? (params.audience as Audience) : undefined;
  function filterHref(subject?: string, search = query, show: Audience | undefined = audience) {
    const next = new URLSearchParams();
    if (subject) next.set("subject", subject);
    if (search) next.set("q", search);
    if (show) next.set("audience", show);
    return `/admin/books${next.size ? `?${next}` : ""}`;
  }
  const [subjects, books] = await Promise.all([
    db.subject.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { books: true } } } }),
    db.book.findMany({
      where: {
        ...(subjectFilter && { subject: { slug: subjectFilter } }),
        ...(query && { OR: [{ title: { contains: query } }, { description: { contains: query } }] }),
        ...(audience && { ownerId: audience === "custom" ? { not: null } : null }),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        subject: true,
        owner: { select: { name: true } },
        targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, imageUrl: true, ar: true } },

      },
    }),
  ]);
  const activeSubject = subjects.find((s) => s.slug === subjectFilter);

  const addButton = (
    <BookDialog subjects={subjects} defaultSubjectId={activeSubject?.id}>
      <Button>
        <Plus /> New book
      </Button>
    </BookDialog>
  );

  return (
    <>
      <PageHeader
        title="Books & AR pages"
        description="Create library books and custom stories: upload the pages, place 3D content on the AR pages, compile, then publish."
        actions={addButton}
      />

      <section aria-label="Book filters" className="mb-6 space-y-3 rounded-2xl border border-ink-200/70 bg-white p-3 shadow-soft sm:p-4">
        <form action="/admin/books" className="flex flex-wrap items-center gap-2">
          {subjectFilter && <input type="hidden" name="subject" value={subjectFilter} />}
          <div className="relative min-w-32 flex-1 sm:max-w-xs">
            <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-ink-500" />
            <Input type="search" name="q" key={query} defaultValue={query} maxLength={120} aria-label="Search books" placeholder="Search books" className="pl-9" />
          </div>
          <Button type="submit" variant="outline">Search</Button>
          {query && <Link href={filterHref(subjectFilter, "")} className="rounded-lg px-2 py-1 text-sm font-medium text-brand-700 underline-offset-2 hover:underline">Clear search</Link>}
          <p className="ml-auto text-xs font-medium text-ink-500">{plural(books.length, "book")}</p>
        </form>
        <nav aria-label="Filter by audience" className="flex flex-wrap gap-2 border-b border-ink-100 pb-3">
          <FilterChip href={filterHref(subjectFilter, query, undefined)} active={!audience} label="All books" />
          {(Object.keys(AUDIENCES) as Audience[]).map((key) => (
            <FilterChip key={key} href={filterHref(subjectFilter, query, key)} active={audience === key} label={AUDIENCES[key]} />
          ))}
        </nav>
        <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
          <FilterChip href={filterHref()} active={!subjectFilter} label="All categories" count={subjects.reduce((n, s) => n + s._count.books, 0)} />
          {subjects.map((s) => (
            <FilterChip key={s.id} href={filterHref(s.slug)} active={s.slug === subjectFilter} label={s.name} count={s._count.books} color={s.color} />
          ))}
        </nav>
      </section>

      {books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={query ? "No matching books" : activeSubject ? `No ${activeSubject.name} books yet` : "No books yet"}
          description={query ? "Try a different title or clear the search." : "Create a book, upload its pages and attach 3D content to each page."}
          action={query ? <Link className="text-sm font-semibold text-brand-700 underline" href={filterHref(subjectFilter, "")}>Clear search</Link> : addButton}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {books.map((book) => {
            const state = compileState(book, book.targets);
            const arPages = book.targets.filter((t) => t.ar).length;
            return (
              <Link
                key={book.id}
                href={`/admin/books/${book.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-ink-200/70 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="relative grid aspect-[4/3] place-items-center overflow-hidden" style={{ background: `radial-gradient(ellipse at 50% 35%, white, ${book.subject.color}22)` }}>
                  {book.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.coverUrl} alt="" className="absolute inset-0 m-auto h-[82%] max-w-[85%] rounded-lg object-contain shadow-lift transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="grid size-full place-items-center">
                      <div className="flex -space-x-8">
                        {book.targets.slice(0, 3).map((t, i) => (
                          <Thumb
                            key={t.id}
                            src={t.imageUrl}
                            width={80}
                            height={112}
                            className="h-28 w-20 rounded-lg object-cover shadow-lift ring-2 ring-white"
                            style={{ transform: `rotate(${(i - 1) * 8}deg)` }}
                          />
                        ))}
                        {book.targets.length === 0 && <SubjectIcon icon={book.subject.icon} className="size-12 opacity-40" />}
                      </div>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-1.5">
                    {book.published ? <Badge tone="dark">Published</Badge> : <Badge className="bg-white/90">Draft</Badge>}
                    {book.owner ? <Badge tone="amber">For {book.owner.name.split(" ")[0]}</Badge> : book.featured && <Badge tone="brand">Featured</Badge>}
                  </div>
                  <span aria-hidden="true" className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-white/90 text-ink-600 shadow-soft transition group-hover:text-brand-700"><ArrowUpRight className="size-4" /></span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: book.subject.color }}>
                    <SubjectIcon icon={book.subject.icon} className="size-3.5" />
                    {book.subject.name}
                    {book.gradeLevel && <span className="text-ink-400">· {book.gradeLevel}</span>}
                  </div>
                  <h3 className="line-clamp-2 font-display font-bold text-ink-900 group-hover:text-brand-600">{book.title}</h3>
                  {!book.owner && (
                    <div className="mt-2 flex items-center gap-3 text-xs font-medium text-ink-500">
                      <span className="flex items-center gap-1"><Star className="size-3.5 text-amber-400" fill="currentColor" strokeWidth={0} /> {book.ratingCount ? `${book.ratingAvg.toFixed(1)} (${book.ratingCount})` : "–"}</span>
                      <span className="flex items-center gap-1"><Download className="size-3.5" /> {book.downloads}</span>
                      <span className="flex items-center gap-1"><Heart className="size-3.5" /> {book.likeCount}</span>
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <span className="text-xs text-ink-500">
                      {plural(book.targets.length, "page")} · {arPages} with AR
                    </span>
                    <CompileBadge state={state} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterChip({ href, active, label, count, color }: { href: string; active: boolean; label: string; count?: number; color?: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {label}
      {count !== undefined && <span className={cn("text-xs", active ? "text-white/60" : "text-ink-400")}>{count}</span>}
    </Link>
  );
}
