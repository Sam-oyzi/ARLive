import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Pencil, ScanLine, Users } from "lucide-react";
import { ScansChart } from "@/components/scans-chart";
import { UserRowActions } from "@/components/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/client-bits";
import { Avatar, StatCard } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bucketByDay, daysAgo } from "@/lib/stats";
import { timeAgo } from "@/lib/utils";
import { SchoolDialog } from "../school-dialog";
import { AccessManager } from "./access-manager";
import { AddAdminDialog, RequestDecision, SchoolMenu } from "./school-controls";

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { id } = await params;
  const school = await db.school.findUnique({
    where: { id },
    include: {
      access: { select: { bookId: true } },
      users: {
        where: { role: "SCHOOL_ADMIN" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, username: true, active: true },
      },
      requests: { where: { status: "PENDING" }, include: { book: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { users: { where: { role: "STUDENT" } } } },
    },
  });
  if (!school) notFound();

  const [subjects, scans] = await Promise.all([
    db.subject.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: { books: { orderBy: { title: "asc" }, include: { _count: { select: { targets: true } } } } },
    }),
    db.scanEvent.findMany({ where: { schoolId: id, createdAt: { gte: daysAgo(13) } }, select: { createdAt: true } }),
  ]);
  const joinLink = `/join?code=${school.joinCode}`;

  return (
    <>
      <Link href="/admin/schools" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> Schools
      </Link>

      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="" className="size-16 rounded-2xl object-cover ring-1 ring-ink-200" />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl text-2xl font-bold text-white" style={{ background: school.color }}>
              {school.name[0]}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">{school.name}</h1>
              {school.active ? <Badge tone="green" dot>Active</Badge> : <Badge tone="red" dot>Paused</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-ink-500">
              {[school.city, school.country].filter(Boolean).join(", ") || "No location"} · {school.contactEmail ?? "No contact email"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <SchoolDialog
            school={{
              id: school.id,
              name: school.name,
              city: school.city,
              country: school.country,
              contactEmail: school.contactEmail,
              color: school.color,
              maxStudents: school.maxStudents,
              logoUrl: school.logoUrl,
            }}
          >
            <Button variant="outline">
              <Pencil /> Edit
            </Button>
          </SchoolDialog>
          <SchoolMenu schoolId={school.id} name={school.name} active={school.active} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Students"
          value={school._count.users}
          icon={Users}
          tone="sky"
          hint={school.maxStudents ? `${school.maxStudents - school._count.users} seats left of ${school.maxStudents}` : "Unlimited seats"}
        />
        <StatCard label="Books granted" value={school.access.length} icon={BookOpen} tone="pink" />
        <StatCard label="Scans · 14 days" value={scans.length} icon={ScanLine} tone="green" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Content access</CardTitle>
                <CardDescription>Students only see published books that are switched on here.</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <AccessManager
                schoolId={school.id}
                granted={school.access.map((a) => a.bookId)}
                subjects={subjects.map((s) => ({
                  id: s.id,
                  name: s.name,
                  icon: s.icon,
                  color: s.color,
                  books: s.books.map((b) => ({
                    id: b.id,
                    title: b.title,
                    gradeLevel: b.gradeLevel,
                    published: b.published,
                    targets: b._count.targets,
                  })),
                }))}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Scans per day</CardTitle>
                <CardDescription>Last 14 days</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              <ScansChart data={bucketByDay(scans.map((s) => s.createdAt))} height={140} />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Student join code</CardTitle>
                <CardDescription>Students enter it on the join page to create their account.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="flex items-center justify-between gap-3">
              <code className="rounded-2xl bg-brand-50 px-4 py-3 font-mono text-2xl font-bold tracking-[0.25em] text-brand-700">
                {school.joinCode}
              </code>
              <div className="flex gap-2">
                <CopyButton value={school.joinCode} />
                <Link href={joinLink} className="text-xs font-semibold text-brand-600 hover:underline" target="_blank">
                  Join page ↗
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Pending requests</CardTitle>
                <CardDescription>Books this school asked for</CardDescription>
              </div>
            </CardHeader>
            <CardBody>
              {school.requests.length === 0 ? (
                <p className="text-sm text-ink-500">No pending requests.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {school.requests.map((r) => (
                    <li key={r.id} className="flex flex-col gap-2 rounded-2xl border border-ink-200/70 p-3">
                      <div>
                        <div className="text-sm font-semibold text-ink-900">{r.book.title}</div>
                        <div className="text-xs text-ink-500">{timeAgo(r.createdAt)}{r.message ? ` · “${r.message}”` : ""}</div>
                      </div>
                      <RequestDecision requestId={r.id} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>School admins</CardTitle>
                <CardDescription>Manage students and request books</CardDescription>
              </div>
              <AddAdminDialog schoolId={school.id} />
            </CardHeader>
            <CardBody>
              {school.users.length === 0 ? (
                <p className="text-sm text-ink-500">No admins yet. Add one so the school can manage its students.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {school.users.map((admin) => (
                    <li key={admin.id} className="flex items-center gap-3 rounded-xl py-2">
                      <Avatar name={admin.name} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                          {admin.name}
                          {!admin.active && <Badge tone="red">Disabled</Badge>}
                        </div>
                        <div className="truncate text-xs text-ink-500">{admin.username}</div>
                      </div>
                      <UserRowActions user={{ id: admin.id, name: admin.name, username: admin.username, active: admin.active }} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
