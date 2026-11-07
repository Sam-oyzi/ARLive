import Link from "next/link";
import { BookOpen, Camera, ChevronRight, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { Thumb } from "@/components/thumb";
import { requireUser } from "@/lib/auth";
import { playableBooksWhere, readableBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { getI18n } from "@/lib/i18n/server";
import { categoryName, type Messages } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { withReturnTo } from "@/lib/reader-navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.subjects };
}

function greeting(t: Messages["learn"]) {
  const h = new Date().getHours();
  return h < 12 ? t.morning : h < 18 ? t.afternoon : t.evening;
}

export default async function LearnHome() {
  const user = await requireUser(["STUDENT"]);
  const { locale, t } = await getI18n();
  const w = t.learn;
  const schoolId = user.schoolId!;
  const readable = readableBooksWhere(schoolId);
  const [subjects, recent] = await Promise.all([
    db.subject.findMany({
      where: { books: { some: readable } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        books: { where: readable, select: { id: true, _count: { select: { targets: true } } } },
      },
    }),
    db.scanEvent.findMany({
      where: { userId: user.id, book: playableBooksWhere(schoolId) },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { target: { select: { id: true, name: true, imageUrl: true } }, book: { select: { id: true, title: true } } },
    }),
  ]);
  // Most recent distinct pages
  const seen = new Set<string>();
  const recentPages = recent.filter((s) => !seen.has(s.targetId) && seen.add(s.targetId)).slice(0, 8);

  return (
    <div className="animate-fade-up">
      <section className="relative overflow-hidden rounded-[28px] bg-ink-950 p-6 text-white sm:p-8">
        <div className="absolute inset-0 bg-grid-dark" />
        <div className="absolute -end-16 -top-24 size-72 rounded-full bg-brand-500/50 blur-3xl" />
        <div className="absolute start-10 -bottom-24 size-56 rounded-full bg-amber-400/30 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/60">{greeting(w)}{locale === "ar" ? "،" : ","}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{user.name.split(" ")[0]} 👋</h1>
          <p className="mt-3 max-w-md text-[15px] text-white/75">{w.intro}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
            {[
              { icon: BookOpen, label: w.readOnline },
              { icon: Camera, label: w.scanPages },
            ].map((step) => (
              <span key={step.label} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
                <step.icon aria-hidden="true" className="size-4" />
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <h2 className="mt-10 mb-4 font-display text-xl font-bold text-ink-900">{w.subjects}</h2>
      {subjects.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={w.noBooks}
          description={w.noBooksText}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {subjects.map((subject, i) => {
            const pages = subject.books.reduce((n, b) => n + b._count.targets, 0);
            return (
              <Link
                key={subject.id}
                href={`/learn/${subject.slug}`}
                className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-[26px] p-4 text-white shadow-lift transition active:scale-[0.98] sm:aspect-[5/4] sm:p-5"
                style={{
                  background: `linear-gradient(150deg, color-mix(in oklab, ${subject.color} 80%, white) 0%, ${subject.color} 45%, color-mix(in oklab, ${subject.color} 60%, black) 100%)`,
                  animationDelay: `${i * 50}ms`,
                }}
              >
                <SubjectIcon
                  icon={subject.icon}
                  className="absolute -end-6 -bottom-6 size-36 rotate-[-12deg] opacity-20 transition duration-500 group-hover:scale-110 group-hover:rotate-0"
                />
                <span className="grid size-12 place-items-center rounded-2xl bg-white/20 backdrop-blur">
                  <SubjectIcon icon={subject.icon} className="size-6" />
                </span>
                <span className="mt-auto">
                  <span className="block font-display text-lg leading-tight font-bold sm:text-xl">{categoryName(t, subject.slug, subject.name)}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-white/80">
                    {w.books(subject.books.length)} · {w.pages(pages)}
                    <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {recentPages.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 font-display text-xl font-bold text-ink-900">{w.recent}</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {recentPages.map((s) => (
              <Link key={s.id} id={`scan-${s.id}`} href={withReturnTo(`/scan/${s.book.id}`, `/learn#scan-${s.id}`)} className="w-32 shrink-0">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-ink-100 shadow-soft">
                  <Thumb src={s.target.imageUrl} width={128} height={171} className="size-full object-cover" />
                </div>
                <div className="mt-2 truncate text-sm font-semibold text-ink-900">{s.target.name}</div>
                <div className="truncate text-xs text-ink-500">{s.book.title}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
