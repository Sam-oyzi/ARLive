// A page's story text, laid out like a picture book (src/lib/story-page.ts draws it onto the page):
//   - every line of the text is a line on the page, so authors write short lines with rhythm;
//   - *Buzz buzz* marks a sound word (or a word to shout): drawn big, bold and in colour;
//   - a blank line leaves a small gap, e.g. before the question that ends the page.
// Safe to import anywhere: no DOM, no database.

export const TEXT_POSITIONS = {
  auto: "Automatic (the calmest part of the picture)",
  top: "Top",
  middle: "Middle",
  bottom: "Bottom",
  off: "Off (the words are already in the picture)",
} as const;

export type TextPosition = keyof typeof TEXT_POSITIONS;
export const TEXT_POSITION_KEYS = Object.keys(TEXT_POSITIONS) as [TextPosition, ...TextPosition[]];

export function textPositionOf(value: string | null | undefined): TextPosition {
  return value && Object.hasOwn(TEXT_POSITIONS, value) ? (value as TextPosition) : "auto";
}

export type StorySegment = { text: string; sound: boolean };
/** One line as the author wrote it; an empty line is a gap. */
export type StoryLine = StorySegment[];

export function parseStory(text: string): StoryLine[] {
  const lines = text.replace(/\r\n?/g, "\n").trim().split("\n");
  const parsed: StoryLine[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      // Collapse runs of blank lines into one gap.
      if (parsed.length && parsed.at(-1)!.length) parsed.push([]);
      continue;
    }
    const segments: StorySegment[] = [];
    // *word* is a sound word; a lone * stays as it is.
    for (const [index, part] of line.split(/\*([^*]+)\*/).entries()) {
      const text = index % 2 ? part.trim() : part;
      if (text) segments.push({ text, sound: index % 2 === 1 });
    }
    parsed.push(segments);
  }
  return parsed;
}

/**
 * A piece of the story that can start a new block of words: a line, or a sentence inside a long line.
 * `before` is what joined it to the previous piece, so pieces put back together read as written.
 */
export type StoryUnit = { text: string; before: "" | " " | "\n" | "\n\n" };

/** Sentence ends inside a line, never inside a *sound word*. */
function sentences(line: string): string[] {
  const parts: string[] = [];
  let stars = 0;
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === "*") stars++;
    if (stars % 2 === 0 && /[.!?…]/.test(char) && /\s/.test(line[i + 1] ?? "") && !/[.!?…]/.test(line[i + 1] ?? "")) {
      parts.push(line.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  parts.push(line.slice(start).trim());
  return parts.filter(Boolean);
}

/** The story in pieces that can be split between two empty areas of a page. */
export function storyUnits(text: string): StoryUnit[] {
  const units: StoryUnit[] = [];
  let gap = false;
  for (const raw of text.replace(/\r\n?/g, "\n").trim().split("\n")) {
    const line = raw.trim();
    if (!line) {
      gap = units.length > 0;
      continue;
    }
    for (const [i, sentence] of sentences(line).entries()) {
      units.push({ text: sentence, before: units.length === 0 ? "" : i > 0 ? " " : gap ? "\n\n" : "\n" });
    }
    gap = false;
  }
  return units;
}

/** Pieces back into story text (the first piece's join is dropped: it starts a block). */
export function joinUnits(units: StoryUnit[]): string {
  return units.map((unit, i) => (i ? unit.before : "") + unit.text).join("");
}

/** The story without markup, for captions, screen readers and the AR info card. */
export function plainStory(text: string): string {
  return text.replace(/\*([^*]+)\*/g, "$1");
}

// ---------- finding empty paper ----------
// The picture is sampled as a grid of cells. Words only ever go on cells that are light and have no
// ink in them, with a margin of empty cells round the drawing, so the text never covers the sketch.

/** Cells that can carry words: light enough for dark type and free of lines, edges and detail. */
export function emptyCells(light: number[][], contrast: number[][], { minLight = 0.62, maxContrast = 0.1 } = {}): boolean[][] {
  return light.map((row, r) => row.map((value, c) => value >= minLight && contrast[r]![c]! <= maxContrast));
}

/** Keeps a margin round the drawing: a cell stays empty only if every cell within `steps` is empty. */
export function shrinkMask(mask: boolean[][], steps = 1): boolean[][] {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  return mask.map((row, r) =>
    row.map((empty, c) => {
      if (!empty) return false;
      for (let dr = -steps; dr <= steps; dr++) {
        for (let dc = -steps; dc <= steps; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          // The page edge is paper too, so cells there can stay empty.
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          if (!mask[rr]![cc]) return false;
        }
      }
      return true;
    }),
  );
}

/** A block of cells: top/left inclusive, bottom/right exclusive. */
export type CellRect = { top: number; left: number; bottom: number; right: number };

/** Every maximal all-empty rectangle (as wide as it can be for its height), largest first. */
export function emptyRects(mask: boolean[][]): CellRect[] {
  const cols = mask[0]?.length ?? 0;
  const heights = new Array<number>(cols).fill(0);
  const found = new Map<string, CellRect>();
  for (const [r, row] of mask.entries()) {
    for (let c = 0; c < cols; c++) heights[c] = row[c] ? heights[c]! + 1 : 0;
    // Largest rectangle under the histogram of empty-cell runs ending on this row.
    const stack: number[] = [];
    for (let c = 0; c <= cols; c++) {
      const h = c < cols ? heights[c]! : 0;
      while (stack.length && heights[stack.at(-1)!]! >= h) {
        const height = heights[stack.pop()!]!;
        if (!height) continue;
        const rect = { top: r - height + 1, bottom: r + 1, left: stack.length ? stack.at(-1)! + 1 : 0, right: c };
        found.set(`${rect.top},${rect.left},${rect.bottom},${rect.right}`, rect);
      }
      stack.push(c);
    }
  }
  const area = (rect: CellRect) => (rect.bottom - rect.top) * (rect.right - rect.left);
  return [...found.values()].sort((a, b) => area(b) - area(a));
}
