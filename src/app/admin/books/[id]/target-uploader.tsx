"use client";

import { CloudUpload, FileJson } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/misc";
import { runAction } from "@/lib/action-client";
import { cropHalf, parseManifest, planPages, type PagesManifest } from "@/lib/page-import";
import { imageSize, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { addTargets } from "@/server/actions/books";

type Job = { name: string; progress: number; error?: string };
type NewPage = Parameters<typeof addTargets>[1][number];

/** Drop book pages here, optionally with the pages.json that gives them titles, stories and AR flags. */
export function TargetUploader({ bookId, compact }: { bookId: string; compact?: boolean }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const [splitSpreads, setSplitSpreads] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = jobs.some((j) => j.progress < 100 && !j.error);

  async function handle(files: File[]) {
    const images = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    const json = files.find((f) => f.name.toLowerCase().endsWith(".json"));
    if (images.length + (json ? 1 : 0) < files.length) toast.error("Only JPG, PNG, WebP images and a pages.json can be added.");
    if (images.length === 0) {
      if (json) toast.error("Add the page images together with pages.json.");
      return;
    }

    let manifest: PagesManifest | null = null;
    if (json) {
      try {
        manifest = parseManifest(await json.text());
      } catch (error) {
        toast.error((error as Error).message);
        return;
      }
    }

    const sizes = new Map<File, { width: number; height: number }>();
    try {
      await Promise.all(images.map(async (f) => sizes.set(f, await imageSize(f))));
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    const plan = planPages(images, sizes, manifest, splitSpreads);
    setJobs(plan.map((p) => ({ name: p.name, progress: 0 })));

    const uploaded: NewPage[] = [];
    // A few at a time keeps the browser responsive on 100-page books.
    let next = 0;
    async function worker() {
      while (next < plan.length) {
        const index = next++;
        const page = plan[index]!;
        const progress = (p: number) => setJobs((js) => js.map((j, i) => (i === index ? { ...j, progress: p } : j)));
        try {
          let body: Blob = page.file;
          let size = sizes.get(page.file)!;
          let filename = page.file.name;
          if (page.crop) {
            const half = await cropHalf(page.file, page.crop);
            body = half.blob;
            size = { width: half.width, height: half.height };
            filename = `${filename.replace(/\.[^.]+$/, "")}-${page.crop}.jpg`;
          }
          const { url } = await uploadFile(body, "targets", filename, progress);
          uploaded[index] = { name: page.name, imageUrl: url, ...size, description: page.description, translations: page.translations, ar: page.ar };
          progress(100);
        } catch (error) {
          setJobs((js) => js.map((j, i) => (i === index ? { ...j, error: (error as Error).message } : j)));
        }
      }
    }
    await Promise.all([worker(), worker(), worker()]);
    const ok = uploaded.filter(Boolean);
    if (ok.length) await runAction(addTargets(bookId, ok));
    setTimeout(() => setJobs((js) => js.filter((j) => j.error)), 1200);
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,.json,application/json"
        multiple
        className="hidden"
        onChange={(e) => {
          handle(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handle(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed text-center transition",
          compact ? "aspect-[3/4] gap-2 p-4" : "gap-3 px-6 py-10",
          dragging ? "border-brand-400 bg-brand-50" : "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50/40",
        )}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <CloudUpload className="size-6" />
        </span>
        <span className="text-sm font-semibold text-ink-900">{compact ? "Add pages" : "Drop book pages here"}</span>
        {!compact && (
          <span className="max-w-sm text-xs text-ink-500">
            JPG, PNG or WebP, one image per page. Pages are ordered by file name (01, 02, …).
            <span className="mt-1.5 flex items-center justify-center gap-1 font-medium text-ink-600">
              <FileJson className="size-3.5" /> Add a pages.json in the same drop for titles, stories and AR pages.
            </span>
          </span>
        )}
      </button>
      <label className={cn("mt-2 flex cursor-pointer items-start gap-2 text-ink-600", compact ? "text-[11px]" : "text-xs")}>
        <input type="checkbox" checked={splitSpreads} onChange={(e) => setSplitSpreads(e.target.checked)} className="mt-0.5 accent-brand-500" />
        <span>Landscape images are two-page spreads: split them into left and right pages (automatic with a pages.json)</span>
      </label>
      {jobs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {jobs.map((job, i) => (
            <li key={i} className="rounded-xl bg-white px-3 py-2 text-xs shadow-soft">
              <div className="mb-1.5 flex justify-between gap-2">
                <span className="truncate font-medium text-ink-700">{job.name}</span>
                <span className={job.error ? "text-rose-600" : "text-ink-400"}>{job.error ?? `${Math.round(job.progress)}%`}</span>
              </div>
              {!job.error && <Progress value={job.progress} className="h-1" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
