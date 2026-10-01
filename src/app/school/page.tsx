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
import { plural } from "@/lib/utils";

export const metadata = { title: "My school" };

export default async function SchoolOverview() {
  const user = await requireUser(["SCHOOL_ADMIN"]);
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
        description="See how your students use AR and invite new ones with your join code."
        actions={
          <ButtonLink href="/school/students">
            <Users /> Manage students
          </ButtonLink>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Students"
          value={students}
          icon={Users}
          tone="sky"
          hint={school.maxStudents ? `${Math.max(0, school.maxStudents - students)} seats left` : "Unlimited seats"}
        />
        <StatCard label="Active · 14 days" value={activeStudents.length} icon={Trophy} tone="amber" hint="Students who scanned at least once" />
        <StatCard label="Scans · 14 days" value={scans.length} icon={ScanLine} tone="green" />
        <StatCard label="AR books" value={books.length} icon={BookOpen} tone="pink" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Scans per day</CardTitle>
              <CardDescription>Your students, last 14 days</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <ScansChart data={bucketByDay(scans.map((s) => s.createdAt))} />
          </CardBody>
        </Card>
        <div className="flex flex-col gap-6">
          <JoinCodeCard schoolId={school.id} joinCode={school.joinCode} />
          <Card>
            <CardHeader>
              <CardTitle>Most curious students</CardTitle>
            </CardHeader>
            <CardBody>
              {topStudents.length === 0 ? (
                <p className="text-sm text-ink-500">No scans in the last 14 days.</p>
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

      <h2 className="mt-10 mb-4 font-display text-lg font-bold text-ink-900">Books your students can scan</h2>
      {books.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No books yet"
          description="Browse the catalog and request the books your classes use."
          action={<ButtonLink href="/school/catalog">Open catalog</ButtonLink>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/scan/${book.id}`}
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
                  {book.subject.name}
                </span>
                <span className="block truncate font-semibold text-ink-900 group-hover:text-brand-600">{book.title}</span>
                <span className="block text-xs text-ink-500">{plural(book._count.targets, "AR page")} · tap to preview</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
