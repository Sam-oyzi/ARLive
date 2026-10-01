import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ScanLine } from "lucide-react";
import { PhoneMockup } from "@/components/phone-mockup";
import { PhoneQR } from "@/components/phone-qr";
import { requireUser } from "@/lib/auth";
import { playableBooksWhere } from "@/lib/books";
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
        where: playableBooksWhere(user.schoolId!),
        orderBy: { title: "asc" },
        include: {
          targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, imageUrl: true, name: true } },
        },
      },
    },
  });
  if (!subject || subject.books.length === 0) notFound();
  const firstPage = subject.books[0]?.targets[0];

  return (
    <div className="animate-fade-up">
      <Link href="/learn" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> Subjects
      </Link>

      <section
        className="relative overflow-hidden rounded-[30px] p-6 sm:p-10"
        style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${subject.color} 14%, white), color-mix(in oklab, ${subject.color} 4%, white))` }}
      >
        <div className="absolute -top-24 -left-24 size-72 rounded-full opacity-25 blur-3xl" style={{ background: subject.color }} />
        <div className="relative flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <div className="max-w-md text-center md:text-left">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ background: subject.color }}
            >
              <SubjectIcon icon={subject.icon} className="size-3.5" /> {plural(subject.books.length, "book")}
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">{subject.name}</h1>
            {subject.description && <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{subject.description}</p>}
            <ol className="mt-6 flex flex-col gap-2.5 text-left text-sm text-ink-700">
              {["Open your book on the desk, in good light.", "Tap Start scanning and allow the camera.", "Point at any page with the AR icon — hold steady."].map(
                (step, i) => (
                  <li key={step} className="flex items-center gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: subject.color }}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ),
              )}
            </ol>
          </div>
          <PhoneMockup
            color={subject.color}
            icon={subject.icon}
            caption={firstPage ? `Point at "${firstPage.name}"` : "Point your camera at a page"}
            className="scale-90 sm:scale-100"
          />
        </div>
      </section>

      <h2 className="mt-10 mb-4 font-display text-xl font-bold text-ink-900">Choose your book</h2>
      <div className="flex flex-col gap-4">
        {subject.books.map((book) => (
          <article key={book.id} className="overflow-hidden rounded-[26px] border border-ink-200/70 bg-white shadow-soft">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="flex flex-1 gap-4">
                <div
                  className="grid h-28 w-20 shrink-0 place-items-center overflow-hidden rounded-xl text-white shadow-lift"
                  style={{ background: subject.color }}
                >
                  {book.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={book.coverUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <SubjectIcon icon={subject.icon} className="size-8" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {book.gradeLevel && <div className="text-xs font-semibold" style={{ color: subject.color }}>{book.gradeLevel}</div>}
                  <h3 className="font-display text-lg leading-snug font-bold text-ink-900">{book.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-500">{book.description || `${plural(book.targets.length, "page")} come alive in AR.`}</p>
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
                <Link
                  href={`/scan/${book.id}`}
                  className="flex h-13 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white shadow-lift transition active:scale-[0.98]"
                  style={{ background: subject.color }}
                >
                  <ScanLine className="size-5" /> Start scanning
                </Link>
                <div className="hidden lg:block">
                  <PhoneQR path={`/scan/${book.id}`} size={64} />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
