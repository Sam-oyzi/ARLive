import { z } from "zod";

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
export const storyBlocksSchema = z.array(z.object({
  text: z.string().max(2000),
  x: z.number().min(0).max(90),
  y: z.number().min(0).max(98),
  width: z.number().min(10).max(100),
  size: z.number().min(1.5).max(12),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.enum(STORY_FONTS),
  align: z.enum(["start", "center", "end"]),
  bold: z.boolean(),
})).max(24).refine((blocks) => blocks.every((block) => block.x + block.width <= 100.001), "Keep paragraphs within the page.");

export type StoryBlock = z.infer<typeof storyBlocksSchema>[number];
export const storyLayoutsSchema = z.record(z.string(), storyBlocksSchema);

export function readStoryLayouts(value: unknown) {
  return storyLayoutsSchema.safeParse(value).data ?? {};
}

export function storyBlockText(blocks: StoryBlock[] | undefined, fallback: string | null) {
  return blocks === undefined ? fallback : blocks.map((block) => block.text.trim()).filter(Boolean).join("\n\n");
}
