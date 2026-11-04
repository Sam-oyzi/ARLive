import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Box, Download, Mic, ExternalLink, Heart, Printer, Image as ImageIcon, Lightbulb, Pencil, ScanLine, Sparkles, Star, Type, TypeOutline, Video, Volume2, type LucideIcon } from "lucide-react";
import { ButtonLink, Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Thumb } from "@/components/thumb";
import { requireUser } from "@/lib/auth";
import { bookFormat } from "@/lib/book-format";
import { arTargets, canPublish, compileState, visibilityOf } from "@/lib/books";
import type { ContentType } from "@/lib/content";
import { db } from "@/lib/db";
import { SubjectIcon } from "@/lib/subject-icons";
import { cn, plural, timeAgo } from "@/lib/utils";
import { BookDialog } from "../book-dialog";
import { ArToggle, BookMenu, PublishSwitch, TargetMenu } from "./book-controls";
import { CompileCard } from "./compile-card";
import { ReadersCard } from "./readers-card";
import { TargetUploader } from "./target-uploader";

const TYPE_ICONS: Record<ContentType, LucideIcon> = {
  MODEL: Box,
  TEXT3D: TypeOutline,
  VIDEO: Video,
  IMAGE: ImageIcon,
  AUDIO: Volume2,
  TEXT: Type,
};

export default async function BookStudioPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { id } = await params;
  const [book, subjects] = await Promise.all([
    db.book.findUnique({
      where: { id },
      include: {
        subject: true,
        targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], include: { contents: { select: { type: true } } } },
        access: { include: { school: { select: { id: true, name: true } } } },
        owner: { select: { id: true, name: true, username: true } },
        storyRequest: { select: { id: true, childName: true, status: true } },
        readers: { orderBy: { createdAt: "desc" }, select: { id: true, email: true, status: true, message: true } },
        _count: { select: { scans: true } },
      },
    }),
    db.subject.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  if (!book) notFound();
  const state = compileState(book, book.targets);

  return (
    <>
      <Link href="/admin/books" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> Books
      </Link>

      {book.owner && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-amber-500" />
            <span>
              Custom story for <span className="font-semibold">{book.owner.name}</span> ({book.owner.username}). Only this family can open it; it never appears in the library.
            </span>
          </span>
          {book.storyRequest && (
            <Link href={`/admin/stories/${book.storyRequest.id}`} className="shrink-0 font-semibold underline underline-offset-2">
              Open the request
            </Link>
          )}
        </div>
      )}

      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-xl shadow-lift" style={{ background: book.subject.color }}>
            {book.coverUrl ? (
              <Thumb src={book.coverUrl} width={64} height={80} className="size-full object-cover" />
            ) : (
              <SubjectIcon icon={book.subject.icon} className="size-7 text-white" />
            )}
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: book.subject.color }}>
              <SubjectIcon icon={book.subject.icon} className="size-3.5" /> {book.subject.name}
              {book.gradeLevel && <span className="text-ink-400">· {book.gradeLevel}</span>}
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">{book.title}</h1>
            <p className="mt-0.5 text-sm text-ink-500">
              {plural(book.targets.length, "page")} ({arTargets(book.targets).length} AR) · {bookFormat(book.format).label} · {plural(book._count.scans, "scan")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PublishSwitch bookId={book.id} published={book.published} disabled={!canPublish(state, book.targets.length)} />
          <BookDialog
            subjects={subjects}
            book={{ id: book.id, title: book.title, description: book.description, gradeLevel: book.gradeLevel, subjectId: book.subjectId, coverUrl: book.coverUrl, format: book.format, featured: book.featured, custom: !!book.ownerId }}
          >
            <Button variant="outline">
              <Pencil /> Edit
            </Button>
          </BookDialog>
          {book.targets.length > 0 && (
            <>
              <ButtonLink href={`/read/${book.id}`} variant="outline">
                <BookOpen /> Preview book
              </ButtonLink>
              <ButtonLink href={`/admin/books/${book.id}/words`} variant="outline">
                <Type /> Words on pages
              </ButtonLink>
              <ButtonLink href={`/print/${book.id}`} variant="outline">
                <Printer /> Print
              </ButtonLink>
            </>
          )}
          {book.mindUrl && (
            <ButtonLink href={`/scan/${book.id}`} target="_blank" variant="secondary">
              <ScanLine /> Test in AR
            </ButtonLink>
          )}
          {book.published && !book.ownerId && (
            <ButtonLink href={`/library/${book.id}`} target="_blank" variant="ghost">
              <ExternalLink /> Library page
            </ButtonLink>
          )}
          <BookMenu bookId={book.id} title={book.title} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-bold text-ink-900">Pages</h2>
            <span className="text-sm text-ink-500">Click a page to place 3D content · AR pages are compiled, story pages are for reading and print</span>
          </div>
          {book.targets.length === 0 ? (
            <TargetUploader bookId={book.id} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 2xl:grid-cols-4">
              {book.targets.map((target, i) => {
                const types = [...new Set(target.contents.map((c) => c.type))] as ContentType[];
                return (
                  <div key={target.id} className="group relative">
                  <Link
                    href={`/admin/books/${book.id}/targets/${target.id}`}
                    className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-ink-200/70 bg-white shadow-soft transition group-hover:-translate-y-0.5 group-hover:shadow-lift"
                  >
                    <div className="relative aspect-[3/4] overflow-hidden bg-ink-100">
                      <Thumb
                        src={target.imageUrl}
                        width={320}
                        height={427}
                        className={cn("size-full object-cover transition duration-500 group-hover:scale-105", !target.ar && "opacity-75 saturate-50")}
                      />
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-ink-950/75 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
                        #{i + 1}
                      </span>
                      {target.ar && types.length === 0 && (
                        <span className="absolute inset-x-2.5 bottom-2.5 rounded-xl bg-white/90 px-2.5 py-1.5 text-center text-[11px] font-semibold text-ink-600 backdrop-blur">
                          No AR content yet
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-3.5 py-3">
                      <span className="truncate text-sm font-semibold text-ink-900">{target.name}</span>
                      <span className="flex shrink-0 gap-1">
                        {target.narrationUrl && (
                          <span className="grid size-6 place-items-center rounded-lg bg-sky-50 text-sky-600" title="Voice narration">
                            <Mic className="size-3.5" />
                          </span>
                        )}
                        {types.map((t) => {
                          const Icon = TYPE_ICONS[t];
                          return (
                            <span key={t} className="grid size-6 place-items-center rounded-lg bg-brand-50 text-brand-600" title={t}>
                              <Icon className="size-3.5" />
                            </span>
                          );
                        })}
                      </span>
                    </div>
                  </Link>
                  <span className="absolute top-10 left-2.5">
                    <ArToggle targetId={target.id} ar={target.ar} />
                  </span>
                  <span className="absolute top-2.5 right-2.5 opacity-0 transition group-hover:-translate-y-0.5 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    <TargetMenu targetId={target.id} name={target.name} first={i === 0} last={i === book.targets.length - 1} />
                  </span>
                  </div>
                );
              })}
              <TargetUploader bookId={book.id} compact />
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-6">
          <ReadersCard bookId={book.id} visibility={visibilityOf(book.visibility)} custom={!!book.ownerId} readers={book.readers} />

          <CompileCard
            bookId={book.id}
            state={state}
            published={book.published}
            compiledLabel={book.compiledAt ? `Last compiled ${timeAgo(book.compiledAt)}` : "Not compiled yet"}
            targets={arTargets(book.targets).map((t) => ({ id: t.id, imageUrl: t.imageUrl }))}
          />

          {!book.ownerId && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>In the library</CardTitle>
                  <CardDescription>{book.published ? (book.featured ? "Published and featured on the home page" : "Published, free for everyone") : "Not visible until published"}</CardDescription>
                </div>
              </CardHeader>
              <CardBody className="grid grid-cols-3 gap-3 text-center">
                {[
                  { icon: Star, label: "Rating", value: book.ratingCount ? book.ratingAvg.toFixed(1) : "–", hint: plural(book.ratingCount, "rating") },
                  { icon: Download, label: "Downloads", value: book.downloads.toLocaleString(), hint: "PDF / print" },
                  { icon: Heart, label: "Likes", value: book.likeCount.toLocaleString(), hint: "families" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-2xl bg-ink-50 px-2 py-3">
                    <stat.icon className="mx-auto size-4 text-ink-400" />
                    <div className="mt-1 font-display text-xl font-bold text-ink-900 tabular-nums">{stat.value}</div>
                    <div className="text-[11px] font-medium text-ink-500">{stat.label}</div>
                    <div className="text-[10px] text-ink-400">{stat.hint}</div>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}

          {!book.ownerId && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Schools with access</CardTitle>
                  <CardDescription>Grant access from each school&apos;s page.</CardDescription>
                </div>
              </CardHeader>
              <CardBody>
                {book.access.length === 0 ? (
                  <p className="text-sm text-ink-500">No school has this book yet.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {book.access.map(({ school }) => (
                      <li key={school.id}>
                        <Link
                          href={`/admin/schools/${school.id}`}
                          className="inline-block rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:border-brand-300 hover:text-brand-700"
                        >
                          {school.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}

          <Card className="bg-amber-50/60">
            <CardBody className="flex gap-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-500" />
              <div className="text-sm text-ink-700">
                <p className="font-semibold text-ink-900">Pages that track well</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-ink-600">
                  <li>Rich detail and contrast: illustrations, photos, diagrams.</li>
                  <li>Avoid plain text-only pages and repeating patterns.</li>
                  <li>Use flat, straight scans (not photos taken at an angle).</li>
                  <li>Keep a book under ~30 pages; split long stories into parts.</li>
                </ul>
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
