import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ScanLine } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PageExperienceSelect, ExperiencePreviewLink } from "@/components/page-experience-select";
import { requireUser } from "@/lib/auth";
import type { ContentData } from "@/lib/content";
import { pageAspect } from "@/lib/book-format";
import { db } from "@/lib/db";
import { pageSoundRow } from "@/lib/sound-layers";
import { pageTranslationsSchema } from "@/lib/page-translations";
import { textPositionOf } from "@/lib/story-text";
import { scanActionOf, worldExperienceOf, placementModel, opensModel } from "@/lib/scan-actions";
import { worldEffectOf } from "@/lib/world-effects";
import { withReturnTo } from "@/lib/reader-navigation";
import { TargetEditor } from "./target-editor";

export default async function TargetEditorPage({ params }: { params: Promise<{ id: string; targetId: string }> }) {
  await requireUser(["SUPER_ADMIN"]);
  const { id, targetId } = await params;
  const target = await db.target.findFirst({
    where: { id: targetId, bookId: id },
    include: {
      contents: { orderBy: { order: "asc" } },
      sounds: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      book: { include: { targets: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } } } },
    },
  });
  if (!target) notFound();

  const siblings = target.book.targets;
  const index = siblings.findIndex((t) => t.id === target.id);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const model = placementModel(target.contents);
  const experience = worldExperienceOf(target.scanAction, target.worldUrl);

  return (
    // On wide screens the editor is a full-height workspace: compact header, then the editor fills
    // the rest of the viewport (main has 1rem padding top and bottom).
    <div className="flex flex-col xl:h-[calc(100dvh-2rem)]">
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/admin/books/${id}`}
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white text-ink-600 shadow-soft hover:text-ink-900"
            aria-label={`Back to ${target.book.title}`}
            title={target.book.title}
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-ink-500">{target.book.title}</div>
            <h1 className="truncate font-display text-lg font-bold tracking-tight text-ink-900">
              <span className="text-ink-400">#{index + 1}</span> {target.name}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex w-56 flex-col gap-1">
            <span className="text-[11px] font-semibold text-ink-500">Page experience</span>
            <PageExperienceSelect targetId={target.id} action={scanActionOf(target.scanAction)} hasWorld={!!target.worldUrl} hasModel={!!placementModel(target.contents)} compact />
          </label>
          {opensModel(target.scanAction) && <ExperiencePreviewLink href={withReturnTo(`/place/${id}/${target.id}`, `/admin/books/${id}/targets/${target.id}`)} withMotion={target.scanAction === "eighthwall"} />}
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
            <ButtonLink href={withReturnTo(`/scan/${id}`, `/admin/books/${id}/targets/${targetId}`)} target="_blank" variant="secondary">
              <ScanLine /> Test in AR
            </ButtonLink>
          )}
        </div>
      </div>
      {experience && (
        <p className="mb-3 shrink-0 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Scanning opens {experience === "panorama" ? "only the 360° view" : "the Step Inside story box"}.
          {" "}3D models stay editable here; readers won’t see them or AR Quick Look in this mode.
        </p>
      )}
      {opensModel(target.scanAction) && (
        <p className="mb-3 shrink-0 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Scanning automatically opens {model?.name ?? "the first 3D item in Layers"} with {target.scanAction === "quicklook" ? "Apple AR Quick Look (Safari on iPhone/iPad)" : "8th Wall room tracking"}.
          {" "}No engine picker appears. Put the model you want first in Layers.
        </p>
      )}
      <TargetEditor
        key={target.id}
        target={{
          id: target.id,
          name: target.name,
          description: target.description,
          imageUrl: target.imageUrl,
          width: target.width,
          height: target.height,
          narrationUrl: target.narrationUrl,
          sounds: target.sounds.map(pageSoundRow),
          note: target.note,
          textPosition: textPositionOf(target.textPosition),
          pageAspect: pageAspect(target.book.format),
          isCover: index === 0,
          translations: pageTranslationsSchema.safeParse(target.translations).data ?? {},
          worldUrl: target.worldUrl,
          worldEffect: worldEffectOf(target.worldEffect),
          scanAction: scanActionOf(target.scanAction),
          ar: target.ar,
          bookId: id,
        }}
        initialContents={target.contents as ContentData[]}
      />
    </div>
  );
}
