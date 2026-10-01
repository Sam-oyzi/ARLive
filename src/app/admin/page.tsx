import Link from "next/link";
import { ArrowRight, BookOpen, Inbox, ScanLine, School, Users } from "lucide-react";
import { ScansChart } from "@/components/scans-chart";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bucketByDay, daysAgo } from "@/lib/stats";
import { SubjectIcon } from "@/lib/subject-icons";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireUser(["SUPER_ADMIN"]);
  const since = daysAgo(13);
  const [schools, students, books, publishedBooks, targets, scans, recentScans, pending, topBooks] = await Promise.all([
    db.school.count({ where: { active: true } }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.book.count(),
    db.book.count({ where: { published: true } }),
    db.target.count(),
    db.scanEvent.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.scanEvent.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { user: true, school: true, target: true, book: { include: { subject: true } } },
    }),
    db.accessRequest.findMany({
      where: { status: "PENDING" },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { school: true, book: true },
    }),
    db.scanEvent.groupBy({
      by: ["bookId"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { bookId: "desc" } },
      take: 5,
    }),
  ]);
  const topBookRows = await db.book.findMany({
    where: { id: { in: topBooks.map((t) => t.bookId) } },
    include: { subject: true },
  });
  const days = bucketByDay(scans.map((s) => s.createdAt), 14);

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Here's how ARLive is being used across your schools."
        actions={
          <>
            <ButtonLink href="/admin/schools" variant="outline">
              <School /> Schools
            </ButtonLink>
            <ButtonLink href="/admin/books">
              <BookOpen /> Manage books
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active schools" value={schools} icon={School} />
        <StatCard label="Students" value={students.toLocaleString()} icon={Users} tone="sky" />
        <StatCard label="Books" value={books} icon={BookOpen} tone="pink" hint={`${publishedBooks} published · ${targets} AR pages`} />
        <StatCard label="Scans · 14 days" value={scans.length.toLocaleString()} icon={ScanLine} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Scans per day</CardTitle>
              <CardDescription>Pages recognised by students, last 14 days</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <ScansChart data={days} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Most scanned books</CardTitle>
              <CardDescription>Last 14 days</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {topBooks.length === 0 && <p className="py-8 text-center text-sm text-ink-500">No scans yet.</p>}
            {topBooks.map((row) => {
              const book = topBookRows.find((b) => b.id === row.bookId);
              if (!book) return null;
              const share = (row._count._all / (topBooks[0]?._count._all || 1)) * 100;
              return (
                <Link key={book.id} href={`/admin/books/${book.id}`} className="group flex items-center gap-3">
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-xl text-white"
                    style={{ background: book.subject.color }}
                  >
                    <SubjectIcon icon={book.subject.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-semibold text-ink-900 group-hover:text-brand-600">{book.title}</span>
                      <span className="font-semibold text-ink-700 tabular-nums">{row._count._all}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <span className="block h-full rounded-full" style={{ width: `${share}%`, background: book.subject.color }} />
                    </span>
                  </span>
                </Link>
              );
            })}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Access requests</CardTitle>
              <CardDescription>Schools asking for new books</CardDescription>
            </div>
            <ButtonLink href="/admin/requests" variant="ghost" size="sm">
              All <ArrowRight />
            </ButtonLink>
          </CardHeader>
          <CardBody>
            {pending.length === 0 ? (
              <EmptyState icon={Inbox} title="All caught up" description="New requests from schools will appear here." className="py-8" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {pending.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-900">{r.school.name}</div>
                      <div className="truncate text-xs text-ink-500">
                        wants <span className="font-medium text-ink-700">{r.book.title}</span> · {timeAgo(r.createdAt)}
                      </div>
                    </div>
                    <Badge tone="amber" dot>
                      Pending
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Live activity</CardTitle>
              <CardDescription>Latest pages recognised</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            {recentScans.length === 0 ? (
              <EmptyState icon={ScanLine} title="No scans yet" description="When students scan a page, it shows up here." className="py-8" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {recentScans.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <Avatar name={s.user?.name ?? "?"} className="size-8 text-[11px]" />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold text-ink-900">{s.user?.name ?? "Deleted user"}</span>{" "}
                      <span className="text-ink-500">scanned</span>{" "}
                      <span className="font-medium text-ink-800">{s.target.name}</span>
                      <div className="truncate text-xs text-ink-500">
                        {s.book.title} · {s.school?.name ?? "Platform"}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(s.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
