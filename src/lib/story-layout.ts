import { z } from "zod";
import { parseStory } from "./story-text";

export const STORY_FONTS = ["book", "classic", "literary", "sans", "friendly", "display", "arabic"] as const;
export const STORY_FONT_OPTIONS = {
  book: { label: "Gelasio · storybook serif", family: "--font-story", fallback: "Georgia, serif" },
  classic: { label: "Georgia · classic read-aloud", primary: "Georgia", fallback: "serif" },
  literary: { label: "Instrument Serif · chapter titles", family: "--font-instrument", fallback: "Georgia, serif" },
  sans: { label: "System Sans · simple reading", primary: "system-ui", fallback: "sans-serif" },
  friendly: { label: "Plus Jakarta Sans · early readers", family: "--font-jakarta", fallback: "system-ui, sans-serif" },
  display: { label: "Fredoka · playful lettering", family: "--font-sound", fallback: "system-ui, sans-serif" },
  arabic: { label: "Noto Naskh Arabic · Arabic stories", family: "--font-arabic", fallback: "Georgia, serif" },
} satisfies Record<(typeof STORY_FONTS)[number], { label: string; family?: string; primary?: string; fallback: string }>;

export function storyFontFamily(font: (typeof STORY_FONTS)[number], resolve: (property: string) => string) {
  const option: { family?: string; primary?: string; fallback: string } = STORY_FONT_OPTIONS[font];
  const primary = option.family ? resolve(option.family) : option.primary;
  return [primary, font !== "arabic" && resolve("--font-arabic"), option.fallback].filter(Boolean).join(", ");
}
const runStyle = z.object({
  font: z.enum(STORY_FONTS).optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
  size: z.number().min(1.5).max(12).optional(),
  bold: z.boolean().optional(),
});
const storyRun = runStyle.extend({ text: z.string().max(2000), sound: z.boolean().optional() });
export type StoryRun = z.infer<typeof storyRun>;
export type StoryRunStyle = z.infer<typeof runStyle>;

export const storyBlocksSchema = z.array(z.object({
  text: z.string().max(2000),
  runs: z.array(storyRun).max(2000).optional(),
  x: z.number().min(0).max(90),
  y: z.number().min(0).max(98),
  width: z.number().min(10).max(100),
  size: z.number().min(1.5).max(12),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.enum(STORY_FONTS),
  align: z.enum(["start", "center", "end"]),
  bold: z.boolean(),
})).max(24)
  .refine((blocks) => blocks.every((block) => block.x + block.width <= 100.001), "Keep paragraphs within the page.")
  .refine((blocks) => blocks.every((block) => !block.runs || block.runs.map((run) => run.text).join("").length <= 2000), "Keep paragraphs under 2,000 characters.");

export type StoryBlock = z.infer<typeof storyBlocksSchema>[number];

export function storyLines(block: StoryBlock): StoryRun[][] {
  if (!block.runs) return parseStory(block.text);
  const lines: StoryRun[][] = [[]];
  for (const run of block.runs) {
    run.text.split("\n").forEach((text, index) => {
      if (index) lines.push([]);
      if (text) lines.at(-1)!.push({ ...run, text });
    });
  }
  return lines;
}

export function storyRunText(runs: StoryRun[]) {
  return runs.map((run) => run.sound ? run.text.split("\n").map((line) => line.trim() ? `*${line.replaceAll("*", "")}*` : line).join("\n") : run.text).join("");
}
export const storyLayoutsSchema = z.record(z.string(), storyBlocksSchema);

export function readStoryLayouts(value: unknown) {
  return storyLayoutsSchema.safeParse(value).data ?? {};
}

export function storyBlockText(blocks: StoryBlock[] | undefined, fallback: string | null) {
  return blocks === undefined ? fallback : blocks.map((block) => block.text.trim()).filter(Boolean).join("\n\n");
}
