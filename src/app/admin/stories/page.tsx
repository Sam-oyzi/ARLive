import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { goalLabel, languageName, STORY_GOALS, STORY_STATUS, STORY_STATUSES, storyStatus, type StoryGoal, type StoryStatus } from "@/lib/stories";
import { cn, timeAgo } from "@/lib/utils";

export const metadata = { title: "Story requests" };

export default async function StoryRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { status: statusParam } = await searchParams;
  const status = (STORY_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as StoryStatus) : undefined;

  const [counts, requests] = await Promise.all([
    db.storyRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    db.storyRequest.findMany({
      where: status ? { status } : { status: { in: ["NEW", "IN_PROGRESS"] } },
      // Oldest first while they're waiting; most recent first once decided.
      orderBy: { createdAt: status === "DELIVERED" || status === "DECLINED" ? "desc" : "asc" },
      take: 100,
      include: { user: { select: { name: true, username: true } }, book: { select: { id: true, title: true, published: true } } },
    }),
  ]);
  const count = (s: StoryStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader
        title="Story requests"
        description="Parents ask for a story about their child and a lesson they care about. Start a book, build it in the studio, then deliver it to the family."
      />

      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        <Tab href="/admin/stories" active={!status} label="Open" count={count("NEW") + count("IN_PROGRESS")} />
        {STORY_STATUSES.map((s) => (
          <Tab key={s} href={`/admin/stories?status=${s}`} active={status === s} label={STORY_STATUS[s].label} count={count(s)} />
        ))}
      </nav>

      {requests.length === 0 ? (
        <EmptyState icon={Sparkles} title={status ? `No ${STORY_STATUS[status].label.toLowerCase()} requests` : "No open requests"} description="When a parent asks for a custom story, it shows up here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((r) => {
            const s = storyStatus(r.status);
            return (
              <Link
                key={r.id}
                href={`/admin/stories/${r.id}`}
                className="group flex gap-4 rounded-3xl border border-ink-200/70 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-2xl" aria-hidden="true">
                  {STORY_GOALS[r.goal as StoryGoal]?.emoji ?? "✨"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-ink-900 group-hover:text-brand-600">
                      For {r.childName}
                      {r.childAge != null && <span className="font-sans text-sm font-medium text-ink-500"> · age {r.childAge}</span>}
                    </span>
                    <Badge tone={s.tone} dot>
                      {s.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {goalLabel(r.goal)} · {languageName(r.language)} · {r.user.name} · {timeAgo(r.createdAt)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-600">“{r.message}”</p>
                  {r.book && <p className="mt-2 text-xs font-semibold text-brand-700">Book: {r.book.title}{r.book.published ? " · published" : " · draft"}</p>}
                </div>
                <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-ink-400 group-hover:text-brand-600" />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900",
      )}
    >
      {label}
      <span className={cn("text-xs", active ? "text-white/60" : "text-ink-400")}>{count}</span>
    </Link>
  );
}
