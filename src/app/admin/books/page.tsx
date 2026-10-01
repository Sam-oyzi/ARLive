import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { CompileBadge } from "@/components/compile-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { compileState } from "@/lib/books";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn, plural } from "@/lib/utils";
import { BookDialog } from "./book-dialog";

export const metadata = { title: "Books & targets" };

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { subject: subjectFilter } = await searchParams;
  const [subjects, books] = await Promise.all([
    db.subject.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], include: { _count: { select: { books: true } } } }),
    db.book.findMany({
      where: subjectFilter ? { subject: { slug: subjectFilter } } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        subject: true,
        targets: { select: { id: true, imageUrl: true, _count: { select: { contents: true } } } },
        _count: { select: { access: true } },
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
        title="Books & targets"
        description="Upload book pages as image targets, attach 3D models and media, then compile and publish."
        actions={addButton}
      />

      <div className="mb-6 flex gap-2 overflow-x-auto scrollbar-none">
        <FilterChip href="/admin/books" active={!subjectFilter} label="All" count={subjects.reduce((n, s) => n + s._count.books, 0)} />
        {subjects.map((s) => (
          <FilterChip key={s.id} href={`/admin/books?subject=${s.slug}`} active={s.slug === subjectFilter} label={s.name} count={s._count.books} color={s.color} />
        ))}
      </div>

      {books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={activeSubject ? `No ${activeSubject.name} books yet` : "No books yet"}
          description="Create a book, upload its pages and attach 3D content to each page."
          action={addButton}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {books.map((book) => {
            const state = compileState(book, book.targets);
            const withContent = book.targets.filter((t) => t._count.contents > 0).length;
            return (
              <Link
                key={book.id}
                href={`/admin/books/${book.id}`}
                className="group flex flex-col overflow-hidden rounded-3xl border border-ink-200/70 bg-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="relative aspect-[4/3] overflow-hidden" style={{ background: `${book.subject.color}1a` }}>
                  {book.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.coverUrl} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="grid size-full place-items-center">
                      <div className="flex -space-x-8">
                        {book.targets.slice(0, 3).map((t, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={t.id}
                            src={t.imageUrl}
                            alt=""
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
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color: book.subject.color }}>
                    <SubjectIcon icon={book.subject.icon} className="size-3.5" />
                    {book.subject.name}
                    {book.gradeLevel && <span className="text-ink-400">· {book.gradeLevel}</span>}
                  </div>
                  <h3 className="line-clamp-2 font-display font-bold text-ink-900 group-hover:text-brand-600">{book.title}</h3>
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                    <span className="text-xs text-ink-500">
                      {plural(book.targets.length, "page")} · {withContent} with AR · {plural(book._count.access, "school")}
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

function FilterChip({ href, active, label, count, color }: { href: string; active: boolean; label: string; count: number; color?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {label}
      <span className={cn("text-xs", active ? "text-white/60" : "text-ink-400")}>{count}</span>
    </Link>
  );
}
