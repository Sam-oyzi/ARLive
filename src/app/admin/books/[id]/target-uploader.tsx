"use client";

import { CloudUpload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/misc";
import { runAction } from "@/lib/action-client";
import { imageSize, uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { addTargets } from "@/server/actions/books";

type Job = { name: string; progress: number; error?: string };

/** Drop book pages here: each image becomes an AR target. */
export function TargetUploader({ bookId, compact }: { bookId: string; compact?: boolean }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const busy = jobs.some((j) => j.progress < 100 && !j.error);

  async function handle(files: File[]) {
    const images = files.filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (images.length < files.length) toast.error("Only JPG, PNG and WebP images can be targets.");
    if (images.length === 0) return;
    setJobs(images.map((f) => ({ name: f.name, progress: 0 })));

    const uploaded: { name: string; imageUrl: string; width: number; height: number }[] = [];
    // A few at a time keeps the browser responsive on 100-page books.
    let next = 0;
    async function worker() {
      while (next < images.length) {
        const index = next++;
        const file = images[index]!;
        try {
          const size = await imageSize(file);
          const { url } = await uploadFile(file, "targets", file.name, (p) =>
            setJobs((js) => js.map((j, i) => (i === index ? { ...j, progress: p } : j))),
          );
          uploaded[index] = { name: file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), imageUrl: url, ...size };
          setJobs((js) => js.map((j, i) => (i === index ? { ...j, progress: 100 } : j)));
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
        accept="image/jpeg,image/png,image/webp"
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
        {!compact && <span className="max-w-xs text-xs text-ink-500">JPG, PNG or WebP — one image per page or illustration. You can select many at once.</span>}
      </button>
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
