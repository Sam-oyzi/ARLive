import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["SCHOOL_ADMIN"]);
  const school = user.school!;
  const [pending, { t }] = await Promise.all([db.accessRequest.count({ where: { schoolId: school.id, status: "PENDING" } }), getI18n()]);
  return (
    <DashboardShell
      area="school"
      user={{ name: user.name, username: user.username, roleLabel: t.dashboard.role }}
      badges={{ requests: pending }}
      header={
        <div className="flex items-center gap-3 rounded-2xl border border-ink-200/70 bg-white p-3 shadow-soft">
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="" className="size-10 rounded-xl object-cover" />
          ) : (
            <span className="grid size-10 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: school.color }}>
              {school.name[0]}
            </span>
          )}
          <div className="min-w-0">
            <div dir="auto" className="truncate text-sm font-semibold text-ink-900">{school.name}</div>
            <div className="truncate text-xs text-ink-500">{school.city ?? t.dashboard.workspace}</div>
          </div>
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
