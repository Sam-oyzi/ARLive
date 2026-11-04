import Link from "next/link";
import { UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";
import { ReaderDecision } from "../books/[id]/readers-card";

export const metadata = { title: "Reader access" };

export default async function ReaderAccessPage() {
  await requireUser(["SUPER_ADMIN"]);
  const [waiting, decided] = await Promise.all([
    db.bookReader.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { book: { select: { id: true, title: true, ownerId: true } } },
    }),
    db.bookReader.findMany({
      where: { status: { not: "PENDING" }, decidedAt: { not: null } },
      orderBy: { decidedAt: "desc" },
      take: 20,
      include: { book: { select: { id: true, title: true } } },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Reader access"
        description="Readers asking to open books that are only for approved emails. Approve buyers of a printed book, or add emails up front from each book's page."
      />
      {waiting.length === 0 ? (
        <EmptyState icon={UserCheck} title="No one is waiting" description="When someone asks to read a locked book, they show up here." />
      ) : (
        <Card>
          <CardBody>
            <ul className="divide-y divide-ink-100">
              {waiting.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink-900">{r.email}</div>
                    <div className="truncate text-xs text-ink-500">
                      wants{" "}
                      <Link href={`/admin/books/${r.book.id}`} className="font-medium text-ink-700 hover:text-brand-600">
                        {r.book.title}
                      </Link>
                      {r.book.ownerId && " (custom story)"} · {timeAgo(r.createdAt)}
                    </div>
                    {r.message && <p className="mt-1 text-sm text-ink-600">“{r.message}”</p>}
                  </div>
                  <ReaderDecision readerId={r.id} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {decided.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="divide-y divide-ink-100">
              {decided.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-ink-900">{r.email}</span> <span className="text-ink-500">→</span> {r.book.title}
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
