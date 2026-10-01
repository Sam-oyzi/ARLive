"use client";

import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/misc";
import { uploadFile } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

/** Uploads an image immediately and stores its URL in a hidden input named `name`. */
export function ImageUploadField({
  name,
  kind,
  defaultValue,
  label = "Upload image",
  aspect = "aspect-square",
  className,
}: {
  name: string;
  kind: "logos" | "covers";
  defaultValue?: string | null;
  label?: string;
  aspect?: string;
  className?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setProgress(0);
    try {
      const result = await uploadFile(file, kind, file.name, setProgress);
      setUrl(result.url);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input type="hidden" name={name} value={url} />
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "group relative grid w-full place-items-center overflow-hidden rounded-2xl border border-dashed border-ink-300 bg-ink-50 text-ink-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-600",
          aspect,
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 p-3 text-center text-xs font-semibold">
            <ImagePlus className="size-5" />
            {label}
          </span>
        )}
        {progress !== null && (
          <span className="absolute inset-x-3 bottom-3">
            <Progress value={progress} />
          </span>
        )}
      </button>
      {url && (
        <button
          type="button"
          onClick={() => setUrl("")}
          className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-ink-900 text-white shadow"
          aria-label="Remove image"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
