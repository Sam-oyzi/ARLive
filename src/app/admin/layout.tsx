import { DashboardShell } from "@/components/dashboard-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["SUPER_ADMIN"]);
  const pending = await db.accessRequest.count({ where: { status: "PENDING" } });
  return (
    <DashboardShell
      area="admin"
      user={{ name: user.name, username: user.username, roleLabel: ROLE_LABEL.SUPER_ADMIN }}
      badges={{ requests: pending }}
    >
      {children}
    </DashboardShell>
  );
}
