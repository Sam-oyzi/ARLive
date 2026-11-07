import { Search, Users } from "lucide-react";
import { UserRowActions } from "@/components/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Avatar, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysAgo } from "@/lib/stats";
import { getI18n } from "@/lib/i18n/server";
import { timeAgo } from "@/lib/i18n/format";
import type { Metadata } from "next";
import { AddStudentsDialog } from "./add-students-dialog";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.meta.students };
}

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(["SCHOOL_ADMIN"]);
  const { locale, t } = await getI18n();
  const d = t.dashboard;
  const school = user.school!;
  const { q } = await searchParams;
  const [students, scanCounts] = await Promise.all([
    db.user.findMany({
      where: {
        schoolId: school.id,
        role: "STUDENT",
        ...(q ? { OR: [{ name: { contains: q } }, { username: { contains: q.toLowerCase() } }, { grade: { contains: q } }] } : {}),
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      select: { id: true, name: true, username: true, grade: true, active: true, lastLoginAt: true },
    }),
    db.scanEvent.groupBy({
      by: ["userId"],
      where: { schoolId: school.id, createdAt: { gte: daysAgo(29) } },
      _count: { _all: true },
    }),
  ]);
  const scans = new Map(scanCounts.map((s) => [s.userId, s._count._all]));
  const addButton = <AddStudentsDialog schoolName={school.name} />;

  return (
    <>
      <PageHeader
        title={d.students}
        description={d.studentsText(students.length, school.maxStudents)}
        actions={addButton}
      />
      <form className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
        <Input name="q" defaultValue={q} placeholder={d.searchStudents} aria-label={d.searchStudents} className="ps-10" />
      </form>
      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? d.noMatching : d.noStudents}
          description={q ? d.tryAnother : d.noStudentsText}
          action={q ? undefined : addButton}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>{d.colStudent}</Th>
                <Th>{d.colClass}</Th>
                <Th>{d.colScans}</Th>
                <Th>{d.colLastSignIn}</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-ink-50/70">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold text-ink-900">
                          {s.name}
                          {!s.active && <Badge tone="red">{d.disabled}</Badge>}
                        </div>
                        <div dir="ltr" className="text-start font-mono text-xs text-ink-500">{s.username}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>{s.grade ?? <span className="text-ink-400">—</span>}</Td>
                  <Td className="tabular-nums">{scans.get(s.id) ?? 0}</Td>
                  <Td className="text-ink-500">{s.lastLoginAt ? timeAgo(locale, s.lastLoginAt, t.common.justNow) : d.never}</Td>
                  <Td className="w-10">
                    <UserRowActions user={s} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
