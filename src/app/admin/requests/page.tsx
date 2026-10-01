import Link from "next/link";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { timeAgo } from "@/lib/utils";
import { RequestDecision } from "../schools/[id]/school-controls";

export const metadata = { title: "Requests" };

export default async function RequestsPage() {
  await requireUser(["SUPER_ADMIN"]);
  const [pending, history] = await Promise.all([
    db.accessRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { school: true, book: { include: { subject: true } } },
    }),
    db.accessRequest.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { decidedAt: "desc" },
      take: 20,
      include: { school: true, book: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Access requests" description="Schools ask for books from the catalog. Approving grants their students access immediately." />
      {pending.length === 0 ? (
        <EmptyState icon={Inbox} title="No pending requests" description="When a school asks for a book, it shows up here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {pending.map((r) => (
            <Card key={r.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: r.book.subject.color }}>
                  <SubjectIcon icon={r.book.subject.icon} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/schools/${r.school.id}`} className="font-semibold text-ink-900 hover:text-brand-600">
                    {r.school.name}
                  </Link>
                  <div className="text-sm text-ink-600">
                    requests <Link href={`/admin/books/${r.book.id}`} className="font-semibold text-ink-800 hover:text-brand-600">{r.book.title}</Link>
                  </div>
                  <div className="mt-1 text-xs text-ink-400">
                    {r.book.subject.name} · {timeAgo(r.createdAt)}
                  </div>
                  {r.message && <p className="mt-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600">“{r.message}”</p>}
                </div>
              </div>
              <div className="flex justify-end">
                <RequestDecision requestId={r.id} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-ink-100">
              {history.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-ink-900">{r.school.name}</span> <span className="text-ink-500">→</span> {r.book.title}
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-xs text-ink-400">{r.decidedAt ? timeAgo(r.decidedAt) : ""}</span>
                    {r.status === "APPROVED" ? <Badge tone="green">Approved</Badge> : <Badge tone="red">Declined</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}
