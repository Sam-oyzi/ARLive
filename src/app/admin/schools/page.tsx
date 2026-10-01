import Link from "next/link";
import { ChevronRight, Plus, School } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysAgo } from "@/lib/stats";
import { SchoolDialog } from "./school-dialog";

export const metadata = { title: "Schools" };

export default async function SchoolsPage() {
  await requireUser(["SUPER_ADMIN"]);
  const [schools, scanCounts] = await Promise.all([
    db.school.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { access: true } },
        users: { select: { role: true } },
      },
    }),
    db.scanEvent.groupBy({ by: ["schoolId"], where: { createdAt: { gte: daysAgo(29) } }, _count: { _all: true } }),
  ]);
  const scans = new Map(scanCounts.map((s) => [s.schoolId, s._count._all]));

  const addButton = (
    <SchoolDialog>
      <Button>
        <Plus /> New school
      </Button>
    </SchoolDialog>
  );

  return (
    <>
      <PageHeader title="Schools" description="Every school, what it has access to and how its students use ARLive." actions={addButton} />
      {schools.length === 0 ? (
        <EmptyState icon={School} title="No schools yet" description="Add your first school to start granting books." action={addButton} />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>School</Th>
                <Th>Students</Th>
                <Th>Books</Th>
                <Th>Scans · 30d</Th>
                <Th>Join code</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => {
                const students = school.users.filter((u) => u.role === "STUDENT").length;
                return (
                  <tr key={school.id} className="group transition hover:bg-ink-50/70">
                    <Td>
                      <Link href={`/admin/schools/${school.id}`} className="flex items-center gap-3">
                        {school.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={school.logoUrl} alt="" className="size-10 rounded-xl object-cover ring-1 ring-ink-200" />
                        ) : (
                          <span className="grid size-10 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: school.color }}>
                            {school.name[0]}
                          </span>
                        )}
                        <span>
                          <span className="block font-semibold text-ink-900 group-hover:text-brand-600">{school.name}</span>
                          <span className="block text-xs text-ink-500">{[school.city, school.country].filter(Boolean).join(", ") || "—"}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td className="tabular-nums">
                      {students}
                      {school.maxStudents ? <span className="text-ink-400"> / {school.maxStudents}</span> : null}
                    </Td>
                    <Td className="tabular-nums">{school._count.access}</Td>
                    <Td className="tabular-nums">{scans.get(school.id) ?? 0}</Td>
                    <Td>
                      <code className="rounded-lg bg-ink-100 px-2 py-1 font-mono text-xs font-semibold tracking-wider text-ink-700">{school.joinCode}</code>
                    </Td>
                    <Td>
                      {school.active ? (
                        <Badge tone="green" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="red" dot>
                          Paused
                        </Badge>
                      )}
                    </Td>
                    <Td className="w-10">
                      <Link href={`/admin/schools/${school.id}`} aria-label={`Open ${school.name}`}>
                        <ChevronRight className="size-4 text-ink-400 group-hover:text-ink-700" />
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
