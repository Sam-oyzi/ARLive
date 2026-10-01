import Link from "next/link";
import { CircleCheck, Library } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/utils";
import { RequestButton } from "./request-button";

export const metadata = { title: "Book catalog" };

export default async function CatalogPage() {
  const user = await requireUser(["SCHOOL_ADMIN"]);
  const schoolId = user.schoolId!;
  const [subjects, granted, pending] = await Promise.all([
    db.subject.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        books: {
          where: { published: true },
          orderBy: { title: "asc" },
          include: { _count: { select: { targets: true } } },
        },
      },
    }),
    db.schoolBook.findMany({ where: { schoolId }, select: { bookId: true } }),
    db.accessRequest.findMany({ where: { schoolId, status: "PENDING" }, select: { id: true, bookId: true } }),
  ]);
  const has = new Set(granted.map((g) => g.bookId));
  const requested = new Map(pending.map((p) => [p.bookId, p.id]));
  const withBooks = subjects.filter((s) => s.books.length > 0);

  return (
    <>
      <PageHeader
        title="Book catalog"
        description="Every AR book available on ARLive. Request the ones your classes use — the ARLive team will enable them for your school."
      />
      {withBooks.length === 0 ? (
        <EmptyState icon={Library} title="The catalog is empty" description="New books will appear here as soon as they're published." />
      ) : (
        <div className="flex flex-col gap-10">
          {withBooks.map((subject) => (
            <section key={subject.id}>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl text-white" style={{ background: subject.color }}>
                  <SubjectIcon icon={subject.icon} className="size-5" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-ink-900">{subject.name}</h2>
                  {subject.description && <p className="text-sm text-ink-500">{subject.description}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {subject.books.map((book) => (
                  <div key={book.id} className="flex gap-4 rounded-3xl border border-ink-200/70 bg-white p-4 shadow-soft">
                    <div className="grid h-24 w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl text-white shadow-soft" style={{ background: subject.color }}>
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={book.coverUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <SubjectIcon icon={subject.icon} className="size-7" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <h3 className="line-clamp-2 font-semibold text-ink-900">{book.title}</h3>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {[book.gradeLevel, plural(book._count.targets, "AR page")].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        {has.has(book.id) ? (
                          <>
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                              <CircleCheck className="size-4" /> Enabled
                            </span>
                            <Link href={`/scan/${book.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
                              Preview
                            </Link>
                          </>
                        ) : (
                          <RequestButton bookId={book.id} pendingRequestId={requested.get(book.id)} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
