// Draws a page's story text onto its picture, like a printed picture book: short lines of book type and
// *sound words* big, bold and in colour. The words only ever go on empty paper — light areas with no
// ink, with a margin round the drawing — and never over the sketch. When no empty area is big enough,
// the picture is made a little smaller and the words get their own paper above (or below) it.
// The result is a new image, so the words turn (and curl) with the page. Browser only.
import { emptyCells, emptyRects, joinUnits, parseStory, shrinkMask, storyUnits, STORY_SOUND_COLORS, type TextPosition } from "./story-text";
import { storyFontFamily, storyLines, type StoryBlock, type StoryRun } from "./story-layout";
import { loadPageImage } from "./page-images";

const INK = "#2b2118";
const PAPER = "#fbf6ea";
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);
// The picture is checked in cells this many columns across (rows follow the page shape), each sampled
// with CELL × CELL pixels so a thin ink line inside a cell still shows up.
const COLUMNS = 40;
const CELL = 5;

type Fonts = { story: string; sound: string };
/** A sample of Arabic, so the Arabic face is fetched before a page in Arabic is drawn. */
const ARABIC_SAMPLE = "سارة";
let fonts: Promise<Fonts> | null = null;

/** The families next/font registered in the root layout (--font-story, --font-sound), loaded. */
function storyFonts(): Promise<Fonts> {
  fonts ??= (async () => {
    const css = getComputedStyle(document.documentElement);
    // The book faces have no Arabic letters: those come from the Arabic face, letter by letter.
    const arabic = css.getPropertyValue("--font-arabic").trim();
    const withArabic = (family: string) => (arabic ? `${family}, ${arabic}` : family);
    const found = {
      story: withArabic(css.getPropertyValue("--font-story").trim() || "Georgia, serif"),
      sound: withArabic(css.getPropertyValue("--font-sound").trim() || "system-ui, sans-serif"),
    };
    await Promise.all([
      document.fonts.load(`500 40px ${found.story}`),
      document.fonts.load(`700 40px ${found.sound}`),
      arabic && document.fonts.load(`600 40px ${arabic}`, ARABIC_SAMPLE),
    ]).catch(() => {});
    return found;
  })();
  return fonts;
}


/** True when nothing at all was drawn on the canvas. */
function isBlank(source: HTMLCanvasElement): boolean {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 8;
  const context = probe.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, 8, 8);
  const { data } = context.getImageData(0, 0, 8, 8);
  probe.width = probe.height = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]) return false;
  return true;
}

type Cells = { light: number[][]; contrast: number[][]; paper: string };

/** Brightness and ink (darkest-to-lightest spread) of every cell, plus the paper's own colour. */
function sampleCells(source: HTMLCanvasElement, cols: number, rows: number): Cells {
  const small = document.createElement("canvas");
  small.width = cols * CELL;
  small.height = rows * CELL;
  const context = small.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, small.width, small.height);
  const { data, width } = context.getImageData(0, 0, small.width, small.height);
  // Phones (Safari above all) keep canvas memory until a canvas is shrunk.
  small.width = small.height = 0;
  const light: number[][] = [];
  const contrast: number[][] = [];
  const paper = [0, 0, 0, 0];
  for (let r = 0; r < rows; r++) {
    light.push([]);
    contrast.push([]);
    for (let c = 0; c < cols; c++) {
      let min = 1;
      let max = 0;
      let sum = 0;
      const rgb = [0, 0, 0];
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          const i = ((r * CELL + y) * width + c * CELL + x) * 4;
          const value = (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
          min = Math.min(min, value);
          max = Math.max(max, value);
          sum += value;
          rgb[0]! += data[i]!;
          rgb[1]! += data[i + 1]!;
          rgb[2]! += data[i + 2]!;
        }
      }
      const mean = sum / (CELL * CELL);
      light[r]!.push(mean);
      contrast[r]!.push(max - min);
      // Plain, bright cells tell us the colour of the paper.
      if (mean > 0.72 && max - min < 0.08) {
        paper[0]! += rgb[0]!;
        paper[1]! += rgb[1]!;
        paper[2]! += rgb[2]!;
        paper[3]! += CELL * CELL;
      }
    }
  }
  const tone = paper[3] ? `rgb(${paper.slice(0, 3).map((v) => Math.round(v / paper[3]!)).join(" ")})` : PAPER;
  return { light, contrast, paper: tone };
}

type Token = { text: string; sound: boolean; width: number; font: string; size: number; color?: string };
type Row = { tokens: Token[]; width: number; height: number; sound: boolean };
type Text = { rows: Row[]; height: number; width: number; size: number };

// Text widths by font and text: layouts are tried many times while fitting, with the same words.
const widths = new Map<string, number>();

function layout(context: CanvasRenderingContext2D, story: string, size: number, maxWidth: number, f: Fonts, weight = 500, rich?: {
  lines: StoryRun[][];
  pageWidth: number;
  family: (font: StoryBlock["font"]) => string;
}): Text {
  const soundSize = size * 1.75;
  const measure = (text: string, font: string) => {
    const key = `${font}|${text}`;
    let width = widths.get(key);
    if (width === undefined) {
      context.font = font;
      width = context.measureText(text).width;
      if (widths.size > 20_000) widths.clear();
      widths.set(key, width);
    }
    return width;
  };
  const rows: Row[] = [];
  let height = 0;
  for (const line of rich?.lines ?? parseStory(story) as StoryRun[][]) {
    if (line.length === 0) {
      rows.push({ tokens: [], width: 0, height: size * 0.7, sound: false });
      height += size * 0.7;
      continue;
    }
    // A sound word stays in one piece when it fits; ordinary text wraps word by word.
    const tokens: Token[] = line.flatMap((segment) => {
      const sound = !!segment.sound;
      const text = sound ? segment.text.toLocaleUpperCase() : segment.text;
      const tokenSize = rich && segment.size !== undefined ? rich.pageWidth * segment.size / 100 : sound ? soundSize : size;
      const family = rich && segment.font ? rich.family(segment.font) : sound ? f.sound : f.story;
      const font = `${segment.bold === undefined ? (sound ? 700 : weight) : segment.bold ? 700 : 500} ${tokenSize}px ${family}`;
      const whole = { text, sound, font, size: tokenSize, color: segment.color, width: measure(text, font) };
      if (segment.sound && whole.width <= maxWidth) return [whole];
      return text.split(/(?<=\s)/).map((word) => ({ ...whole, text: word, width: measure(word, font) }));
    });
    let row: Row = { tokens: [], width: 0, height: 0, sound: false };
    const push = () => {
      if (!row.tokens.length) return;
      row.height = Math.max(row.sound ? soundSize * 1.08 : size * 1.36, ...row.tokens.map((token) => token.size * (token.sound ? 1.08 : 1.36)));
      rows.push(row);
      height += row.height;
      row = { tokens: [], width: 0, height: 0, sound: false };
    };
    for (const token of tokens) {
      if (row.tokens.length && row.width + token.width > maxWidth) push();
      if (!row.tokens.length && !token.sound) token.text = token.text.trimStart();
      token.width = measure(token.text, token.font);
      row.tokens.push(token);
      row.width += token.width;
      row.sound ||= token.sound;
    }
    push();
  }
  // Rows of sound words step in by this much, so leave room for it.
  const width = Math.max(0, ...rows.map((r) => r.width + (stepsIn(r) ? size * 0.6 : 0)));
  return { rows, height, width, size };
}

const stepsIn = (row: Row) => row.tokens.length > 0 && row.tokens.every((t) => t.sound);

function drawText(context: CanvasRenderingContext2D, text: Text, left: number, top: number, rtl: boolean, f: Fonts, paper: string, outline = false, style?: StoryBlock, blockWidth = text.width) {
  const { size } = text;
  context.textBaseline = "alphabetic";
  context.direction = rtl ? "rtl" : "ltr";
  let y = top;
  let soundIndex = 0;
  let soundRows = 0;
  for (const row of text.rows) {
    y += row.height;
    if (!row.tokens.length) continue;
    // Lines start on the same edge, like a typeset poem; rows of sound words step in and out.
    const step = stepsIn(row) && soundRows++ % 2 ? size * 0.6 : 0;
    const align = style?.align ?? "start";
    const offset = align === "center" ? (blockWidth - row.width) / 2
      : (align === "start" ? rtl : !rtl) ? blockWidth - row.width : 0;
    let x = left + offset + (rtl ? -step : step);
    const baseline = y - (row.sound ? size * 0.25 : size * 0.38);
    // Right-to-left rows are drawn from their right edge.
    for (const token of rtl ? [...row.tokens].reverse() : row.tokens) {
      if (token.sound) {
        context.save();
        context.translate(x + token.width / 2, baseline);
        context.rotate((((soundIndex + 1) % 3) - 1) * 0.05);
        context.font = token.font;
        context.textAlign = "center";
        context.lineJoin = "round";
        context.lineWidth = size * 0.24;
        context.strokeStyle = paper;
        context.strokeText(token.text, 0, 0);
        const soundColor = STORY_SOUND_COLORS[soundIndex++ % STORY_SOUND_COLORS.length]!;
        context.fillStyle = token.color ?? soundColor;
        context.fillText(token.text, 0, 0);
        context.restore();
      } else {
        context.font = token.font;
        context.textAlign = "left";
        if (outline) {
          context.save();
          context.lineJoin = "round";
          context.lineWidth = size * 0.12;
          context.strokeStyle = paper;
          context.strokeText(token.text, x, baseline);
          context.restore();
        }
        context.fillStyle = token.color ?? style?.color ?? INK;
        context.fillText(token.text, x, baseline);
      }
      x += token.width;
    }
  }
}

type Box = { x: number; y: number; w: number; h: number };
type Placed = { box: Box; text: Text; source: string; wrapWidth: number };
/** A block of words on the page, as fractions of its width and height. */
export type WordBox = { left: number; right: number; top: number; bottom: number };

export type StoryPage = {
  url: string;
  /** "space": the words fit in empty paper; "room": the words are outlined over the full-page artwork. */
  mode: "space" | "room" | "manual";
  /** Where the words are, so badges drawn over the page can avoid them. */
  words: WordBox[];
  /** Editable starting positions for the blocks chosen by the automatic layout. */
  automaticBlocks?: StoryBlock[];
};

/**
 * The page's picture with its story drawn in, as an object URL (the caller revokes it), or null when
 * there's nothing to draw. `aspect` is the book's page height / width, so the words stay inside the
 * part of the picture the page shows. `debug` shades where words may go and outlines where they went.
 */
export async function composeStoryPage({
  imageUrl,
  story,
  position,
  aspect,
  lang = "en",
  width: requestedWidth,
  cover = false,
  debug = false,
  blocks,
  beforeDraw,
}: {
  imageUrl: string;
  story: string | null;
  position: TextPosition;
  aspect: number;
  lang?: string;
  /** Output width in pixels; defaults to the picture's own width (capped for phones). */
  width?: number;
  /** Covers carry their title in the art, so they only get words when a position is chosen. */
  cover?: boolean;
  debug?: boolean;
  blocks?: StoryBlock[];
  /** The reader waits for an active page turn before starting canvas work. */
  beforeDraw?: () => Promise<void>;
}): Promise<StoryPage | null> {
  if (blocks !== undefined ? !blocks.some((block) => block.text.trim()) : position === "off" || (cover && position === "auto") || !story?.trim()) return null;
  const [img, f] = await Promise.all([loadPageImage(imageUrl), storyFonts()]);
  await beforeDraw?.();
  const W = Math.round(requestedWidth ?? Math.min(img.naturalWidth, 1200));
  const H = Math.round(W * aspect);

  // The picture, cropped like the page shows it (object-fit: cover).
  const picture = document.createElement("canvas");
  picture.width = W;
  picture.height = H;
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const paint = () =>
    picture.getContext("2d")!.drawImage(img, (W - img.naturalWidth * scale) / 2, (H - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);
  paint();
  // If the picture still came out empty, give the browser a moment and draw it again: words laid out
  // on an empty picture would end up on top of the real one.
  for (let attempt = 0; attempt < 4 && isBlank(picture); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    paint();
  }
  if (isBlank(picture)) throw new Error(`Couldn't draw ${imageUrl}`);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d")!;
  const rtl = RTL_LANGUAGES.has(lang.split("-")[0]!.toLowerCase());
  if (blocks) {
    const css = getComputedStyle(document.documentElement);
    const family = (font: StoryBlock["font"]) => storyFontFamily(font, (property) => css.getPropertyValue(property).trim());
    await Promise.all(blocks.flatMap((block) => [block, ...(block.runs ?? [])].map((run) =>
      document.fonts.load(`${(run.bold ?? block.bold) ? 700 : 500} 40px ${family(run.font ?? block.font)}`, run.text).catch(() => []))));
    await beforeDraw?.();
    context.drawImage(picture, 0, 0);
    const words: WordBox[] = [];
    for (const block of blocks) {
      if (!block.text.trim()) continue;
      const left = W * block.x / 100;
      const top = H * block.y / 100;
      const width = W * block.width / 100;
      const size = W * block.size / 100;
      const blockFonts = { ...f, story: family(block.font) };
      const rich = block.runs ? { lines: storyLines(block), pageWidth: W, family } : undefined;
      const text = layout(context, block.text, size, width, blockFonts, block.bold ? 700 : 500, rich);
      drawText(context, text, left, top, rtl, blockFonts, PAPER, false, block, width);
      words.push({ left: left / W, right: Math.min(1, (left + width) / W), top: top / H, bottom: Math.min(1, (top + text.height) / H) });
    }
    return finish(canvas, picture, "manual", words);
  }
  if (!story || position === "off") return null;
  // Size relative to the page so the reader and print agree at different render resolutions.
  const bodySize = W * 0.036;

  // ---------- 1. Words in empty paper: one block, or the paragraph split between two ----------
  const rows = Math.round(COLUMNS * aspect);
  const cells = sampleCells(picture, COLUMNS, rows);
  // Strict first (clean paper, a margin round every line); then a gentler test that still never
  // accepts ink, for pictures painted edge to edge with light washes.
  const masks = [
    shrinkMask(emptyCells(cells.light, cells.contrast), 1),
    shrinkMask(emptyCells(cells.light, cells.contrast, { minLight: 0.56, maxContrast: 0.14 }), 1),
  ];
  const cellW = W / COLUMNS;
  const cellH = H / rows;
  // A chosen position limits where a box's centre may be; automatic prefers the top, then the bottom.
  const zone: Record<Exclude<TextPosition, "off">, [number, number]> = { auto: [0, 1], top: [0, 0.45], middle: [0.3, 0.7], bottom: [0.55, 1] };
  const [zoneTop, zoneBottom] = zone[position];
  const preference = (centre: number) => (position !== "auto" ? 1 : centre < 0.4 ? 1 : centre > 0.6 ? 0.95 : 0.85);
  // Wide boxes read like a book; a narrow column of short broken lines doesn't.
  const roominess = (w: number) => 0.8 + 0.2 * Math.min(1, w / (W * 0.75));
  const pad = W * 0.02;
  const fitIn = (box: Box, source: string): Placed | null => {
    const wrapWidth = Math.min(box.w - pad * 2, W * 0.86);
    const text = layout(context, source, bodySize, wrapWidth, f);
    return text.width <= wrapWidth && text.height <= box.h - pad * 2 ? { box, text, source, wrapWidth } : null;
  };
  const editableBlock = (source: string, text: Text, left: number, top: number, wrapWidth: number): StoryBlock => {
    // Keep the edge the original text was aligned to, including right-to-left blocks.
    const anchor = rtl ? left + text.width : left;
    const space = rtl ? anchor : W - anchor;
    const width = Math.max(10, Math.min(wrapWidth, space) * 100 / W);
    const x = (rtl ? anchor * 100 / W - width : anchor * 100 / W);
    return {
      text: source, x: Math.max(0, Math.min(x, 100 - width)), y: Math.max(0, Math.min(98, top * 100 / H)),
      width, size: 3.6, font: "book", color: INK, align: "start", bold: false,
    };
  };
  const score = (box: Box) => preference((box.y + box.h / 2) / H) * roominess(box.w);
  // Cheap check before laying text out: the box must at least have the area the letters need.
  const roomFor = (box: Box, text: string) => box.w * box.h >= text.length * bodySize * bodySize * 0.62;
  const units = storyUnits(story);

  type Candidate = { blocks: Placed[]; score: number };

  let best: Candidate | null = null;
  let usable = masks[0]!;
  for (const mask of masks) {
    usable = mask;
    // Many maximal rectangles nearly coincide; keep one of each.
    const boxes: Box[] = [];
    for (const rect of emptyRects(mask)) {
      const box = { x: rect.left * cellW, y: rect.top * cellH, w: (rect.right - rect.left) * cellW, h: (rect.bottom - rect.top) * cellH };
      const centre = (box.y + box.h / 2) / H;
      if (box.w < W * 0.24 || box.h < bodySize * 1.36 + pad * 2 || centre < zoneTop || centre > zoneBottom) continue;
      const overlaps = boxes.some((kept) => {
        const ix = Math.max(0, Math.min(kept.x + kept.w, box.x + box.w) - Math.max(kept.x, box.x));
        const iy = Math.max(0, Math.min(kept.y + kept.h, box.y + box.h) - Math.max(kept.y, box.y));
        return ix * iy > 0.85 * Math.min(kept.w * kept.h, box.w * box.h);
      });
      if (!overlaps) boxes.push(box);
      if (boxes.length >= 30) break;
    }

    // One block of words, in the best wide box.
    for (const box of boxes) {
      if (box.w < W * 0.45 || !roomFor(box, story)) continue;
      const block = fitIn(box, story);
      if (block) {
        const candidate = { blocks: [block], score: score(box) };
        if (!best || candidate.score > best.score) best = candidate;
      }
    }
    // When one block cannot fit, try two boxes in reading order.
    if (!best && units.length > 1) {
      const pairBoxes = boxes.slice(0, 12);
      for (const a of pairBoxes) {
        for (const b of pairBoxes) {
          const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
          const stacked = b.y >= a.y + a.h;
          const beside = b.x >= a.x + a.w && overlap >= Math.min(a.h, b.h) * 0.5;
          if (!stacked && !beside) continue;
          const [first, second] = beside && rtl ? [b, a] : [a, b];
          for (let k = 1; k < units.length; k++) {
            const start = joinUnits(units.slice(0, k));
            const rest = joinUnits(units.slice(k));
            if (!roomFor(first, start) || !roomFor(second, rest)) continue;
            const ta = fitIn(first, start);
            const tb = ta && fitIn(second, rest);
            if (!ta || !tb) continue;
            const candidate = {
              blocks: [ta, tb],
              score: preference((first.y + first.h / 2) / H) * roominess(Math.min(first.w, second.w)),
            };
            if (!best || candidate.score > best.score) best = candidate;
          }
        }
      }
    }
    // The gentler test is only for pages where the strict one found nothing at all.
    if (best) break;
  }
  const placed = best?.blocks ?? null;

  if (placed) {
    context.drawImage(picture, 0, 0);
    if (debug) {
      context.fillStyle = "rgb(22 163 74 / 0.22)";
      for (const [r, row] of usable.entries()) row.forEach((empty, c) => empty && context.fillRect(c * cellW, r * cellH, cellW, cellH));
    }
    const words: WordBox[] = [];
    const automaticBlocks: StoryBlock[] = [];
    for (const { box, text, source, wrapWidth } of placed) {
      const left = box.x + (box.w - text.width) / 2;
      const top = box.y + (box.h - text.height) / 2;
      drawText(context, text, left, top, rtl, f, cells.paper);
      words.push({ left: left / W, right: (left + text.width) / W, top: top / H, bottom: (top + text.height) / H });
      automaticBlocks.push(editableBlock(source, text, left, top, wrapWidth));
      if (debug) {
        context.strokeStyle = "#16a34a";
        context.lineWidth = 3;
        context.strokeRect(box.x, box.y, box.w, box.h);
      }
    }
    return finish(canvas, picture, "space", words, automaticBlocks);
  }

  // ---------- 2. No room: keep the full page and outline only the letters ----------
  const margin = W * 0.06;
  const text = layout(context, story, bodySize, W - margin * 2, f);
  const band = text.height + margin * 1.4;
  const wordsBelow = position === "bottom";
  if (band >= H || text.width > W - margin * 2) {
    canvas.width = canvas.height = picture.width = picture.height = 0;
    return null;
  }
  context.drawImage(picture, 0, 0);
  if (debug) {
    context.fillStyle = "rgb(22 163 74 / 0.3)";
    for (const [r, row] of usable.entries()) row.forEach((empty, c) => empty && context.fillRect(c * cellW, r * cellH, cellW, cellH));
  }
  const textTop = (wordsBelow ? H - band : 0) + (band - text.height) / 2;
  drawText(context, text, (W - text.width) / 2, textTop, rtl, f, cells.paper, true);
  if (debug) {
    context.strokeStyle = "#e11d48";
    context.lineWidth = 3;
    context.strokeRect((W - text.width) / 2, textTop, text.width, text.height);
  }
  const textLeft = (W - text.width) / 2;
  return finish(canvas, picture, "room", [{ left: textLeft / W, right: (textLeft + text.width) / W, top: textTop / H, bottom: (textTop + text.height) / H }],
    [editableBlock(story, text, textLeft, textTop, W - margin * 2)]);
}

/** Which end of the page a corner badge can use without landing on the words: `prefer` unless they're there. */
export function freeCorner(words: WordBox[] | undefined, side: "left" | "right", prefer: "top" | "bottom" = "top"): "top" | "bottom" {
  const [left, right] = side === "left" ? [0, 0.42] : [0.58, 1];
  const hits = (end: "top" | "bottom") =>
    (words ?? []).some((w) => w.left < right && w.right > left && (end === "top" ? w.top < 0.1 : w.bottom > 0.9));
  const other = prefer === "top" ? "bottom" : "top";
  return hits(prefer) && !hits(other) ? other : prefer;
}

// Pages already drawn for the reader, by what went into them. The URLs live as long as the page does,
// so turning back or switching language back is instant.
const drawn = new Map<string, Promise<StoryPage | null>>();

/** composeStoryPage, remembered: callers must not revoke the URLs it returns. */
export function composeStoryPageCached(options: Parameters<typeof composeStoryPage>[0]): Promise<StoryPage | null> {
  const key = JSON.stringify([options.imageUrl, options.story, options.position, options.aspect, options.lang, options.width, options.cover, options.blocks]);
  let page = drawn.get(key);
  if (!page) {
    page = composeStoryPage(options);
    drawn.set(key, page);
    page.catch(() => drawn.delete(key));
  }
  return page;
}

/** Waits until the browser has a quiet moment, so drawing pages never stalls a page turn. */
export function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 600 });
    // Safari has no idle callback: let a frame paint, then leave taps and turns some room.
    else requestAnimationFrame(() => setTimeout(resolve, 120));
  });
}

async function finish(canvas: HTMLCanvasElement, picture: HTMLCanvasElement, mode: StoryPage["mode"], words: StoryPage["words"], automaticBlocks?: StoryBlock[]): Promise<StoryPage | null> {
  picture.width = picture.height = 0;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  canvas.width = canvas.height = 0;
  return blob ? { url: URL.createObjectURL(blob), mode, words, automaticBlocks } : null;
}
