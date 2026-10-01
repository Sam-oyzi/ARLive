import { Search, Users } from "lucide-react";
import { UserRowActions } from "@/components/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Avatar, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysAgo } from "@/lib/stats";
import { timeAgo } from "@/lib/utils";
import { AddStudentsDialog } from "./add-students-dialog";

export const metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser(["SCHOOL_ADMIN"]);
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
        title="Students"
        description={`${students.length} student${students.length === 1 ? "" : "s"}${school.maxStudents ? ` of ${school.maxStudents} seats` : ""}. Students can also join on their own with your join code.`}
        actions={addButton}
      />
      <form className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
        <Input name="q" defaultValue={q} placeholder="Search name, username or class" className="pl-10" />
      </form>
      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No matching students" : "No students yet"}
          description={q ? "Try another search." : "Add your class lists, or share your join code so students sign up themselves."}
          action={q ? undefined : addButton}
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Class</Th>
                <Th>Scans · 30d</Th>
                <Th>Last sign-in</Th>
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
                          {!s.active && <Badge tone="red">Disabled</Badge>}
                        </div>
                        <div className="font-mono text-xs text-ink-500">{s.username}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>{s.grade ?? <span className="text-ink-400">—</span>}</Td>
                  <Td className="tabular-nums">{scans.get(s.id) ?? 0}</Td>
                  <Td className="text-ink-500">{s.lastLoginAt ? timeAgo(s.lastLoginAt) : "Never"}</Td>
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
