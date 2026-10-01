import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ScanLine } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import type { ContentData } from "@/lib/content";
import { db } from "@/lib/db";
import { TargetEditor } from "./target-editor";

export default async function TargetEditorPage({ params }: { params: Promise<{ id: string; targetId: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { id, targetId } = await params;
  const target = await db.target.findFirst({
    where: { id: targetId, bookId: id },
    include: {
      contents: { orderBy: { order: "asc" } },
      book: { include: { targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } } } },
    },
  });
  if (!target) notFound();

  const siblings = target.book.targets;
  const index = siblings.findIndex((t) => t.id === target.id);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href={`/admin/books/${id}`} className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900">
            <ArrowLeft className="size-4" /> {target.book.title}
          </Link>
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-ink-900">
            <span className="text-ink-400">#{index + 1}</span> {target.name}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-ink-200 bg-white shadow-soft">
            {prev ? (
              <Link href={`/admin/books/${id}/targets/${prev.id}`} className="grid size-9 place-items-center text-ink-600 hover:text-ink-900" aria-label="Previous page">
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span className="grid size-9 place-items-center text-ink-300"><ChevronLeft className="size-4" /></span>
            )}
            <span className="grid place-items-center border-x border-ink-200 px-3 text-xs font-semibold text-ink-600 tabular-nums">
              {index + 1} / {siblings.length}
            </span>
            {next ? (
              <Link href={`/admin/books/${id}/targets/${next.id}`} className="grid size-9 place-items-center text-ink-600 hover:text-ink-900" aria-label="Next page">
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className="grid size-9 place-items-center text-ink-300"><ChevronRight className="size-4" /></span>
            )}
          </div>
          {target.book.mindUrl && (
            <ButtonLink href={`/scan/${id}`} target="_blank" variant="secondary">
              <ScanLine /> Test in AR
            </ButtonLink>
          )}
        </div>
      </div>
      <TargetEditor
        key={target.id}
        target={{ id: target.id, name: target.name, description: target.description, imageUrl: target.imageUrl, width: target.width, height: target.height }}
        initialContents={target.contents as ContentData[]}
      />
    </>
  );
}
