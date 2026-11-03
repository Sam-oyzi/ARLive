import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CheckCircle2, Circle, Mail, Pencil, ScanLine } from "lucide-react";
import { CompileBadge } from "@/components/compile-badge";
import { Thumb } from "@/components/thumb";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { arTargets, compileState } from "@/lib/books";
import { db } from "@/lib/db";
import { goalLabel, languageName, STORY_GOALS, storyStatus, type StoryGoal } from "@/lib/stories";
import { cn, plural, timeAgo } from "@/lib/utils";
import { DeliverButton, RequestStatusForm, StartBookButton } from "./story-controls";

export const metadata = { title: "Story request" };

export default async function StoryRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { id } = await params;
  const request = await db.storyRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, username: true, createdAt: true, _count: { select: { storyRequests: true } } } },
      child: true,
      book: { include: { targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, imageUrl: true, ar: true } } } },
    },
  });
  if (!request) notFound();
  const status = storyStatus(request.status);
  const book = request.book;
  const state = book ? compileState(book, book.targets) : "empty";
  const steps = [
    { label: "Request received", done: true },
    { label: "Book started", done: !!book },
    { label: "Pages added", done: !!book && book.targets.length > 0 },
    { label: "AR compiled", done: !!book && book.targets.length > 0 && (state === "ready" || state === "empty"), optional: true },
    { label: "Delivered", done: request.status === "DELIVERED" },
  ];

  return (
    <>
      <Link href="/admin/stories" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> Story requests
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-50 text-3xl" aria-hidden="true">
            {STORY_GOALS[request.goal as StoryGoal]?.emoji ?? "✨"}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">A story for {request.childName}</h1>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-500">
              {goalLabel(request.goal)} · {languageName(request.language)} · asked {timeAgo(request.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!book && request.status !== "DECLINED" && <StartBookButton requestId={request.id} />}
          {book && (
            <ButtonLink href={`/admin/books/${book.id}`} variant={request.status === "DELIVERED" ? "outline" : "primary"}>
              <Pencil /> Open in studio
            </ButtonLink>
          )}
          {book && book.targets.length > 0 && (
            <ButtonLink href={`/read/${book.id}`} variant="outline">
              <BookOpen /> Preview
            </ButtonLink>
          )}
          {book && request.status !== "DELIVERED" && request.status !== "DECLINED" && <DeliverButton requestId={request.id} childName={request.childName} />}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>What the parent wants</CardTitle>
                <CardDescription>Build the story around this.</CardDescription>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <blockquote className="rounded-2xl bg-ink-50 px-5 py-4 text-[15px] leading-relaxed whitespace-pre-line text-ink-800">{request.message}</blockquote>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Detail label="Hero" value={`${request.childName}${request.childAge != null ? `, age ${request.childAge}` : ""}`} />
                <Detail label="Lesson" value={goalLabel(request.goal)} />
                <Detail label="Loves" value={request.interests || "Not given"} />
                <Detail label="Language" value={languageName(request.language)} />
              </dl>
            </CardBody>
          </Card>

          {book && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{book.title}</CardTitle>
                  <CardDescription>
                    {plural(book.targets.length, "page")} · {arTargets(book.targets).length} AR · {book.published ? "published for the family" : "draft"}
                  </CardDescription>
                </div>
                <CompileBadge state={state} />
              </CardHeader>
              <CardBody>
                {book.targets.length === 0 ? (
                  <p className="text-sm text-ink-500">No pages yet. Open the studio to upload the illustrated pages.</p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {book.targets.map((t) => (
                      <div key={t.id} className="relative w-20 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                        <Thumb src={t.imageUrl} width={80} height={107} className="aspect-[3/4] w-full object-cover" />
                        {t.ar && <ScanLine className="absolute right-1 bottom-1 size-4 rounded bg-brand-500 p-0.5 text-white" />}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardBody>
              <ol className="flex flex-col gap-3">
                {steps.map((step) => (
                  <li key={step.label} className={cn("flex items-center gap-2.5 text-sm", step.done ? "font-semibold text-ink-900" : "text-ink-500")}>
                    {step.done ? <CheckCircle2 className="size-5 text-emerald-500" /> : <Circle className="size-5 text-ink-300" />}
                    {step.label}
                    {step.optional && !step.done && <span className="text-xs text-ink-400">(if the book has AR pages)</span>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Family</CardTitle>
            </CardHeader>
            <CardBody className="flex items-center gap-3">
              <Avatar name={request.user.name} />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink-900">{request.user.name}</p>
                <a href={`mailto:${request.user.username}`} className="flex items-center gap-1 text-ink-500 hover:text-brand-600">
                  <Mail className="size-3.5" /> {request.user.username}
                </a>
                <p className="mt-0.5 text-xs text-ink-400">
                  Member {timeAgo(request.user.createdAt)} · {plural(request.user._count.storyRequests, "request")}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status & note</CardTitle>
            </CardHeader>
            <CardBody>
              <RequestStatusForm id={request.id} status={request.status} adminNote={request.adminNote} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-ink-400 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink-800">{value}</dd>
    </div>
  );
}
