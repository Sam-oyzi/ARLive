import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ScanLine } from "lucide-react";
import { PhoneQR } from "@/components/phone-qr";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { readableBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/utils";

export default async function SubjectPage({ params }: { params: Promise<{ subject: string }> }) {
  const user = await requireUser(["STUDENT"]);
  const { subject: slug } = await params;
  const subject = await db.subject.findUnique({
    where: { slug },
    include: {
      books: {
        where: readableBooksWhere(user.schoolId!),
        orderBy: { title: "asc" },
        include: {
          targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, imageUrl: true, name: true, ar: true } },
        },
      },
    },
  });
  if (!subject || subject.books.length === 0) notFound();
  const hasAR = subject.books.some((book) => book.mindUrl && book.targets.some((target) => target.ar));

  return (
    <div className="animate-fade-up">
      <Link href="/learn" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> Subjects
      </Link>

      <section
        className="relative overflow-hidden rounded-[28px] p-6 sm:p-9"
        style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${subject.color} 14%, white), color-mix(in oklab, ${subject.color} 4%, white))` }}
      >
        <div className="absolute -top-24 -left-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: subject.color }} />
        <div className="relative flex items-center justify-between gap-5">
          <div className="max-w-xl">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ background: subject.color }}
            >
              <SubjectIcon icon={subject.icon} className="size-3.5" /> {plural(subject.books.length, "book")}
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{subject.name}</h1>
            {subject.description && <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{subject.description}</p>}
            <p className="mt-3 text-sm leading-relaxed text-ink-700">Open a book to read online.{hasAR && " Books with AR also have a camera option."}</p>
          </div>
          <span aria-hidden="true" className="hidden shrink-0 opacity-35 sm:block" style={{ color: subject.color }}>
            <SubjectIcon icon={subject.icon} className="size-24" />
          </span>
        </div>
      </section>

      <h2 className="mt-7 mb-4 font-display text-xl font-bold text-ink-900">Choose your book</h2>
      <div className="flex flex-col gap-4">
        {subject.books.map((book) => {
          const cover = book.coverUrl ?? book.targets[0]?.imageUrl;
          const arCount = book.targets.filter((target) => target.ar).length;
          const canScan = !!book.mindUrl && arCount > 0;
          return (
          <article key={book.id} className="overflow-hidden rounded-[26px] border border-ink-200/70 bg-white shadow-soft">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="flex flex-1 gap-4">
                <div
                  className="grid h-28 w-20 shrink-0 place-items-center overflow-hidden rounded-xl text-white shadow-lift"
                  style={{ background: subject.color }}
                >
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cover} alt="" className="size-full object-cover" />
                  ) : (
                    <SubjectIcon icon={subject.icon} className="size-8" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {book.gradeLevel && <div className="text-xs font-semibold" style={{ color: subject.color }}>{book.gradeLevel}</div>}
                  <h3 className="font-display text-lg leading-snug font-bold text-ink-900">{book.title}</h3>
                  {book.description && <p className="mt-1 line-clamp-2 text-sm text-ink-600">{book.description}</p>}
                  <p className="mt-2 text-xs font-semibold text-ink-600">{plural(book.targets.length, "page")}{canScan && ` · ${arCount} with AR`}</p>
                  <div className="mt-3 flex -space-x-2">
                    {book.targets.slice(0, 5).map((t) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={t.id} src={t.imageUrl} alt={t.name} title={t.name} className="h-10 w-8 rounded-md object-cover ring-2 ring-white" />
                    ))}
                    {book.targets.length > 5 && (
                      <span className="grid h-10 w-8 place-items-center rounded-md bg-ink-100 text-[10px] font-bold text-ink-600 ring-2 ring-white">
                        +{book.targets.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:w-64">
                <ButtonLink href={`/read/${book.id}`} size="lg">
                  <BookOpen className="size-4" /> Read the book
                </ButtonLink>
                {canScan && <>
                  <ButtonLink href={`/scan/${book.id}`} variant="outline" size="lg"><ScanLine /> Start scanning</ButtonLink>
                  <details className="hidden rounded-xl border border-ink-200/70 bg-ink-50 px-3 py-2 text-xs text-ink-600 lg:block">
                    <summary className="cursor-pointer rounded-sm font-semibold text-ink-700">Continue on your phone</summary>
                    <div className="mt-2"><PhoneQR path={`/scan/${book.id}`} size={64} /></div>
                  </details>
                </>}
              </div>
            </div>
          </article>
        );
        })}
      </div>
    </div>
  );
}
