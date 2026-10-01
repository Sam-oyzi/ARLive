import Link from "next/link";
import { Search, Users } from "lucide-react";
import { UserRowActions } from "@/components/user-row-actions";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRole, ROLE_LABEL, ROLES } from "@/lib/roles";
import { timeAgo } from "@/lib/utils";
import { UserDialog } from "./user-dialog";

export const metadata = { title: "Users" };

const ROLE_TONE: Record<string, BadgeTone> = { SUPER_ADMIN: "dark", SCHOOL_ADMIN: "brand", STUDENT: "neutral" };
const PAGE_SIZE = 50;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; school?: string; page?: string }>;
}) {
  const me = await requireUser(["SUPER_ADMIN"]);
  const { q, role, school, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const where = {
    ...(q ? { OR: [{ name: { contains: q } }, { username: { contains: q.toLowerCase() } }] } : {}),
    ...(isRole(role) ? { role } : {}),
    ...(school ? { schoolId: school } : {}),
  };
  const [users, total, schools] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { name: "asc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      select: { id: true, name: true, username: true, role: true, grade: true, active: true, lastLoginAt: true, school: { select: { id: true, name: true } } },
    }),
    db.user.count({ where }),
    db.school.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (p: number) => `?${new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(school && { school }), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Users" description={`${total.toLocaleString()} account${total === 1 ? "" : "s"} across the platform.`} actions={<UserDialog schools={schools} />} />

      <form className="mb-5 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
          <Input name="q" defaultValue={q} placeholder="Search by name or username" className="pl-10" />
        </div>
        <Select name="role" defaultValue={role ?? ""} className="sm:w-44">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
        <Select name="school" defaultValue={school ?? ""} className="sm:w-56">
          <option value="">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800">Filter</button>
      </form>

      {users.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search or filter." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Role</Th>
                <Th>School</Th>
                <Th>Last sign-in</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-ink-50/70">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-semibold text-ink-900">
                          {user.name}
                          {!user.active && <Badge tone="red">Disabled</Badge>}
                        </div>
                        <div className="truncate text-xs text-ink-500">
                          {user.username}
                          {user.grade ? ` · ${user.grade}` : ""}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={ROLE_TONE[user.role]}>{isRole(user.role) ? ROLE_LABEL[user.role] : user.role}</Badge>
                  </Td>
                  <Td>
                    {user.school ? (
                      <Link href={`/admin/schools/${user.school.id}`} className="hover:text-brand-600">
                        {user.school.name}
                      </Link>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </Td>
                  <Td className="text-ink-500">{user.lastLoginAt ? timeAgo(user.lastLoginAt) : "Never"}</Td>
                  <Td className="w-10">
                    {user.id !== me.id && <UserRowActions user={{ id: user.id, name: user.name, username: user.username, active: user.active }} />}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {pages > 1 && (
            <div className="flex items-center justify-between border-t border-ink-100 px-6 py-3 text-sm text-ink-500">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && <Link href={qs(page - 1)} className="font-semibold text-ink-700 hover:text-brand-600">← Previous</Link>}
                {page < pages && <Link href={qs(page + 1)} className="font-semibold text-ink-700 hover:text-brand-600">Next →</Link>}
              </div>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
