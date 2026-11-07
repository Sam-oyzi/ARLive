import Link from "next/link";
import { ArrowRight, BookOpen, Download, Heart, ScanLine, Sparkles, Star, Users } from "lucide-react";
import { ScansChart } from "@/components/scans-chart";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatCard } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { libraryBooksWhere } from "@/lib/books";
import { db } from "@/lib/db";
import { libraryOrderBy } from "@/lib/library";
import { bucketByDay, daysAgo } from "@/lib/stats";
import { goalLabel, storyStatus } from "@/lib/stories";
import { SubjectIcon } from "@/lib/subject-icons";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const user = await requireUser(["SUPER_ADMIN"]);
  const since = daysAgo(13);
  const [families, libraryBooks, drafts, totals, scans, recentScans, openStories, newStories, openCount, topBooks] = await Promise.all([
    db.user.count({ where: { role: "PARENT" } }),
    db.book.count({ where: libraryBooksWhere }),
    db.book.count({ where: { published: false } }),
    db.book.aggregate({ where: libraryBooksWhere, _sum: { downloads: true, likeCount: true } }),
    db.scanEvent.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.scanEvent.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { user: true, target: true, book: { include: { subject: true } } },
    }),
    db.storyRequest.findMany({
      where: { status: { in: ["NEW", "IN_PROGRESS"] } },
      take: 5,
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
    db.storyRequest.count({ where: { status: "NEW" } }),
    db.storyRequest.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
    db.book.findMany({ where: libraryBooksWhere, orderBy: libraryOrderBy("popular"), take: 5, include: { subject: true } }),
  ]);
  const days = bucketByDay(scans.map((s) => s.createdAt), 14);

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}
        title={`Hello, ${user.name.split(" ")[0]}`}
        description="Here's how families are using the PageWakes library."
        actions={
          <>
            <ButtonLink href="/admin/stories" variant="outline">
              <Sparkles /> Story requests
            </ButtonLink>
            <ButtonLink href="/admin/books">
              <BookOpen /> Manage books
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Library books" value={libraryBooks} icon={BookOpen} hint={`${drafts} draft${drafts === 1 ? "" : "s"} in the studio`} />
        <StatCard label="Families" value={families.toLocaleString()} icon={Users} tone="sky" />
        <StatCard
          label="Downloads"
          value={(totals._sum.downloads ?? 0).toLocaleString()}
          icon={Download}
          tone="green"
          hint={`${(totals._sum.likeCount ?? 0).toLocaleString()} likes · ${scans.length.toLocaleString()} AR scans in 14 days`}
        />
        <StatCard label="New story requests" value={newStories} icon={Sparkles} tone="amber" hint={`${openCount} open in total`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Scans per day</CardTitle>
              <CardDescription>AR pages recognised by readers, last 14 days</CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <ScansChart data={days} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Most loved books</CardTitle>
              <CardDescription>Downloads, likes and ratings</CardDescription>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {topBooks.length === 0 && <p className="py-8 text-center text-sm text-ink-500">Publish a book to see it here.</p>}
            {topBooks.map((book) => (
              <Link key={book.id} href={`/admin/books/${book.id}`} className="group flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: book.subject.color }}>
                  <SubjectIcon icon={book.subject.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-brand-600">{book.title}</span>
                  <span className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                    <span className="flex items-center gap-1"><Download className="size-3" /> {book.downloads}</span>
                    <span className="flex items-center gap-1"><Heart className="size-3" /> {book.likeCount}</span>
                    <span className="flex items-center gap-1"><Star className="size-3" /> {book.ratingCount ? book.ratingAvg.toFixed(1) : "–"}</span>
                  </span>
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Custom story requests</CardTitle>
              <CardDescription>Oldest first</CardDescription>
            </div>
            <ButtonLink href="/admin/stories" variant="ghost" size="sm">
              All <ArrowRight />
            </ButtonLink>
          </CardHeader>
          <CardBody>
            {openStories.length === 0 ? (
              <EmptyState icon={Sparkles} title="All caught up" description="When a parent asks for a custom story, it shows up here." className="py-8" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {openStories.map((r) => {
                  const status = storyStatus(r.status);
                  return (
                    <li key={r.id}>
                      <Link href={`/admin/stories/${r.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-brand-600">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-ink-900">For {r.childName}</div>
                          <div className="truncate text-xs text-ink-500">
                            {goalLabel(r.goal)} · {r.user.name} · {timeAgo(r.createdAt)}
                          </div>
                        </div>
                        <Badge tone={status.tone} dot>
                          {status.label}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
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
              <EmptyState icon={ScanLine} title="No scans yet" description="When someone scans an AR page, it shows up here." className="py-8" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {recentScans.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    <Avatar name={s.user?.name ?? "?"} className="size-8 text-[11px]" />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold text-ink-900">{s.user?.name ?? "A visitor"}</span>{" "}
                      <span className="text-ink-500">scanned</span>{" "}
                      <span className="font-medium text-ink-800">{s.target.name}</span>
                      <div className="truncate text-xs text-ink-500">
                        {s.book.title}
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
