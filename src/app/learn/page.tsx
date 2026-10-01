import Link from "next/link";
import { BookOpen, Camera, ChevronRight, Sparkles, Box } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { playableBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { plural } from "@/lib/utils";

export const metadata = { title: "My subjects" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function LearnHome() {
  const user = await requireUser(["STUDENT"]);
  const schoolId = user.schoolId!;
  const [subjects, recent] = await Promise.all([
    db.subject.findMany({
      where: { books: { some: playableBooksWhere(schoolId) } },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        books: { where: playableBooksWhere(schoolId), select: { id: true, _count: { select: { targets: true } } } },
      },
    }),
    db.scanEvent.findMany({
      where: { userId: user.id },
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
        <div className="absolute -top-24 -right-16 size-72 rounded-full bg-brand-500/50 blur-3xl" />
        <div className="absolute -bottom-24 left-10 size-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium text-white/60">{greeting()},</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">{user.name.split(" ")[0]} 👋</h1>
          <p className="mt-3 max-w-md text-[15px] text-white/70">Pick a subject, open your book, and point your camera at a page to see it come alive in 3D.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
            {[
              { icon: BookOpen, label: "Pick a subject" },
              { icon: Camera, label: "Scan a page" },
              { icon: Box, label: "Explore in 3D" },
            ].map((step, i) => (
              <span key={step.label} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur">
                <span className="grid size-5 place-items-center rounded-full bg-white text-[10px] font-bold text-ink-900">{i + 1}</span>
                {step.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <h2 className="mt-10 mb-4 font-display text-xl font-bold text-ink-900">Your subjects</h2>
      {subjects.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No AR books yet"
          description="Your school hasn't enabled any books yet. Ask your teacher — they'll appear here automatically."
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
                  className="absolute -right-6 -bottom-6 size-36 rotate-[-12deg] opacity-20 transition duration-500 group-hover:scale-110 group-hover:rotate-0"
                />
                <span className="grid size-12 place-items-center rounded-2xl bg-white/20 backdrop-blur">
                  <SubjectIcon icon={subject.icon} className="size-6" />
                </span>
                <span className="mt-auto">
                  <span className="block font-display text-lg leading-tight font-bold sm:text-xl">{subject.name}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs font-medium text-white/80">
                    {plural(subject.books.length, "book")} · {plural(pages, "page")}
                    <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {recentPages.length > 0 && (
        <>
          <h2 className="mt-10 mb-4 font-display text-xl font-bold text-ink-900">Recently explored</h2>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {recentPages.map((s) => (
              <Link key={s.id} href={`/scan/${s.book.id}`} className="w-32 shrink-0">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-ink-100 shadow-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.target.imageUrl} alt="" className="size-full object-cover" />
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
