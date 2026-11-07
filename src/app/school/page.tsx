import Link from "next/link";
import { BookOpen, Library, ScanLine, Trophy, Users } from "lucide-react";
import { JoinCodeCard } from "@/components/join-code-card";
import { ScansChart } from "@/components/scans-chart";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { playableBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { bucketByDay, daysAgo } from "@/lib/stats";
import { SubjectIcon } from "@/lib/subject-icons";
import { getI18n } from "@/lib/i18n/server";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { categoryName } from "@/lib/i18n/messages";
import type { Metadata } from "next";
import { withReturnTo } from "@/lib/reader-navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.school };
}

export default async function SchoolOverview() {
  const user = await requireUser(["SCHOOL_ADMIN"]);
  const { locale, t } = await getI18n();
  const d = t.dashboard;
  const school = user.school!;
  const since = daysAgo(13);
  const [students, activeStudents, scans, books, topStudents] = await Promise.all([
    db.user.count({ where: { schoolId: school.id, role: "STUDENT" } }),
    db.scanEvent.groupBy({ by: ["userId"], where: { schoolId: school.id, createdAt: { gte: since } } }),
    db.scanEvent.findMany({ where: { schoolId: school.id, createdAt: { gte: since } }, select: { createdAt: true } }),
    db.book.findMany({
      where: playableBooksWhere(school.id),
      include: { subject: true, _count: { select: { targets: true } } },
      orderBy: [{ subject: { order: "asc" } }, { title: "asc" }],
    }),
    db.scanEvent.groupBy({
      by: ["userId"],
      where: { schoolId: school.id, createdAt: { gte: since }, userId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
  ]);
  const topUsers = await db.user.findMany({
    where: { id: { in: topStudents.map((t) => t.userId!) } },
    select: { id: true, name: true, grade: true },
  });

  return (
    <>
      <PageHeader
        title={school.name}
        description={d.overviewText}
        actions={
          <ButtonLink href="/school/students">
            <Users /> {d.manageStudents}
          </ButtonLink>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={d.students}
          value={students}
          icon={Users}
          tone="sky"
          hint={school.maxStudents ? d.seatsLeft(Math.max(0, school.maxStudents - students)) : d.unlimited}
        />
        <StatCard label={d.active14} value={activeStudents.length} icon={Trophy} tone="amber" hint={d.activeHint} />
        <StatCard label={d.scans14} value={scans.length} icon={ScanLine} tone="green" />
        <StatCard label={d.arBooks} value={books.length} icon={BookOpen} tone="rose" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{d.scansPerDay}</CardTitle>
              <CardDescription>{d.last14}</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <ScansChart data={bucketByDay(scans.map((s) => s.createdAt), 14, INTL_LOCALE[locale])} />
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6">
          <JoinCodeCard schoolId={school.id} joinCode={school.joinCode} />
          <Card>
            <CardHeader>
              <CardTitle>{d.curious}</CardTitle>
            </CardHeader>
            <CardBody>
              {topStudents.length === 0 ? (
                <p className="text-sm text-ink-500">{d.noScans}</p>
              ) : (
                <ol className="flex flex-col gap-3">
                  {topStudents.map((row, i) => {
                    const student = topUsers.find((u) => u.id === row.userId);
                    return (
                      <li key={row.userId} className="flex items-center gap-3">
                        <span className="w-4 text-sm font-bold text-ink-400">{i + 1}</span>
                        <Avatar name={student?.name ?? "?"} className="size-8 text-[11px]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
                          {student?.name}
                          {student?.grade && <span className="font-normal text-ink-500"> · {student.grade}</span>}
                        </span>
                        <span className="text-sm font-semibold text-ink-700 tabular-nums">{row._count._all}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <h2 className="mt-10 mb-4 font-display text-lg font-bold text-ink-900">{d.booksToScan}</h2>
      {books.length === 0 ? (
        <EmptyState
          icon={Library}
          title={d.noBooks}
          description={d.noBooksText}
          action={<ButtonLink href="/school/catalog">{d.openCatalog}</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <Link
              key={book.id}
              id={`book-${book.id}`}
              href={withReturnTo(`/scan/${book.id}`, `/school#book-${book.id}`)}
              className="group flex items-center gap-4 rounded-3xl border border-ink-200/70 bg-white p-4 shadow-soft transition hover:shadow-lift"
            >
              <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl text-white" style={{ background: book.subject.color }}>
                {book.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={book.coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <SubjectIcon icon={book.subject.icon} className="size-6" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold" style={{ color: book.subject.color }}>
                  {categoryName(t, book.subject.slug, book.subject.name)}
                </span>
                <span dir="auto" className="block truncate font-semibold text-ink-900 group-hover:text-brand-600">{book.title}</span>
                <span className="block text-xs text-ink-500">{d.arPages(book._count.targets)} · {d.tapPreview}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
