// Turns a drop of images (+ optional pages.json) into an ordered list of pages to upload.
// pages.json is what the "arlive-book" skill produces alongside the ChatGPT image prompts:
//   { "pages": [ { "file": "01.png", "title": "…", "story": "…", "ar": true, "textPosition": "top" }, … ] }
// For two-page spreads, an entry may add "side": "left" | "right"; without it, both halves share it.
import { z } from "zod";
import { pageTranslationsSchema, type PageTranslations } from "./page-translations";
import { TEXT_POSITION_KEYS, type TextPosition } from "./story-text";

const manifestSchema = z.object({
  pages: z
    .array(
      z.object({
        file: z.string().min(1),
        side: z.enum(["left", "right"]).optional(),
        title: z.string().max(120).optional(),
        story: z.string().max(1000).optional(),
        translations: pageTranslationsSchema.optional(),
        ar: z.boolean().optional(),
        /** Where the story text goes on the page; "off" when the words are in the picture. */
        textPosition: z.enum(TEXT_POSITION_KEYS).optional(),
      }),
    )
    .max(500),
});

export type PagesManifest = z.infer<typeof manifestSchema>;

export function parseManifest(text: string): PagesManifest {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("pages.json isn't valid JSON.");
  }
  const result = manifestSchema.safeParse(json);
  if (!result.success) throw new Error(`pages.json: ${result.error.issues[0]?.message ?? "unexpected format"}`);
  return result.data;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const baseName = (name: string) => name.replace(/\.[^.]+$/, "");
const prettify = (name: string) => baseName(name).replace(/[_-]+/g, " ").trim();

export type PlannedPage = {
  file: File;
  /** Half of a two-page spread to keep, if any */
  crop?: "left" | "right";
  name: string;
  description?: string;
  translations?: PageTranslations;
  ar?: boolean;
  textPosition?: TextPosition;
};

export function planPages(
  images: File[],
  sizes: Map<File, { width: number; height: number }>,
  manifest: PagesManifest | null,
  splitSpreads: boolean,
): PlannedPage[] {
  // What pages.json says about each file: entries with a side mean "this is a spread", an entry
  // without one means "keep it whole" (e.g. a cover that came out landscape).
  const declared = new Map<string, "spread" | "whole">();
  for (const entry of manifest?.pages ?? []) {
    const key = baseName(entry.file).toLowerCase();
    if (entry.side) declared.set(key, "spread");
    else if (!declared.has(key)) declared.set(key, "whole");
  }

  // Every page the drop produces, in filename order (01, 02 … 10 sorts naturally).
  const all: PlannedPage[] = [];
  for (const file of [...images].sort((a, b) => collator.compare(a.name, b.name))) {
    const size = sizes.get(file);
    const landscape = !!size && size.width > size.height;
    const rule = declared.get(baseName(file.name).toLowerCase());
    // pages.json decides when it mentions the file; otherwise the "two-page spreads" checkbox does.
    const spread = landscape && (rule ? rule === "spread" : splitSpreads);
    if (spread) {
      all.push({ file, crop: "left", name: `${prettify(file.name)} (left)` }, { file, crop: "right", name: `${prettify(file.name)} (right)` });
    } else {
      all.push({ file, name: prettify(file.name) });
    }
  }
  if (!manifest) return all;

  // Apply pages.json: its order first, then anything it didn't mention.
  const ordered: PlannedPage[] = [];
  const used = new Set<PlannedPage>();
  for (const entry of manifest.pages) {
    const key = entry.file.toLowerCase();
    const matches = all.filter(
      (p) => !used.has(p) && (p.file.name.toLowerCase() === key || baseName(p.file.name).toLowerCase() === baseName(key)) && (!entry.side || p.crop === entry.side),
    );
    for (const page of matches) {
      used.add(page);
      const suffix = page.crop && !entry.side && matches.length > 1 ? ` (${page.crop})` : "";
      ordered.push({
        ...page,
        name: entry.title ? `${entry.title}${suffix}`.slice(0, 120) : page.name,
        description: entry.story,
        translations: entry.translations,
        ar: entry.ar,
        textPosition: entry.textPosition,
      });
    }
  }
  return [...ordered, ...all.filter((p) => !used.has(p))];
}

/** Cut one half out of a spread, as a JPEG. */
export async function cropHalf(file: File, side: "left" | "right"): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const half = Math.floor(bitmap.width / 2);
  const canvas = document.createElement("canvas");
  canvas.width = half;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, side === "left" ? 0 : bitmap.width - half, 0, half, bitmap.height, 0, 0, half, bitmap.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't split the spread."))), "image/jpeg", 0.92),
  );
  return { blob, width: half, height: canvas.height };
}
