// Draws a page's story text onto its picture, like a printed picture book: short lines of book type and
// *sound words* big, bold and in colour. The words only ever go on empty paper — light areas with no
// ink, with a margin round the drawing — and never over the sketch. When no empty area is big enough,
// the picture is made a little smaller and the words get their own paper above (or below) it.
// The result is a new image, so the words turn (and curl) with the page. Browser only.
import { emptyCells, emptyRects, joinUnits, parseStory, shrinkMask, storyUnits, type TextPosition } from "./story-text";

const INK = "#2b2118";
const PAPER = "#fbf6ea";
const SOUND_COLORS = ["#ea580c", "#0284c7", "#16a34a", "#e11d48", "#7c5a00"];
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

const images = new Map<string, Promise<HTMLImageElement>>();
function loadImage(url: string): Promise<HTMLImageElement> {
  let image = images.get(url);
  if (!image) {
    image = new Promise((resolve, reject) => {
      const img = new Image();
      // Decoded, not just loaded: Safari can otherwise draw nothing while it decodes the same picture
      // for the page underneath.
      img.onload = () => img.decode().catch(() => {}).then(() => resolve(img));
      img.onerror = () => reject(new Error(`Couldn't load ${url}`));
      img.src = url;
    });
    images.set(url, image);
    image.catch(() => images.delete(url));
  }
  return image;
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

type Token = { text: string; sound: boolean; width: number };
type Row = { tokens: Token[]; width: number; height: number; sound: boolean };
type Text = { rows: Row[]; height: number; width: number; size: number };

// Text widths by font and text: layouts are tried many times while fitting, with the same words.
const widths = new Map<string, number>();

function layout(context: CanvasRenderingContext2D, story: string, size: number, maxWidth: number, f: Fonts): Text {
  const bodyFont = `500 ${size}px ${f.story}`;
  const soundSize = size * 1.75;
  const soundFont = `700 ${soundSize}px ${f.sound}`;
  const measure = (text: string, sound: boolean) => {
    const font = sound ? soundFont : bodyFont;
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
  for (const line of parseStory(story)) {
    if (line.length === 0) {
      rows.push({ tokens: [], width: 0, height: size * 0.7, sound: false });
      height += size * 0.7;
      continue;
    }
    // A sound word stays in one piece when it fits; ordinary text wraps word by word.
    const tokens: Token[] = line.flatMap((segment) => {
      const text = segment.sound ? segment.text.toLocaleUpperCase() : segment.text;
      const whole = { text, sound: segment.sound, width: measure(text, segment.sound) };
      if (segment.sound && whole.width <= maxWidth) return [whole];
      return text.split(/(?<=\s)/).map((word) => ({ text: word, sound: segment.sound, width: measure(word, segment.sound) }));
    });
    let row: Row = { tokens: [], width: 0, height: 0, sound: false };
    const push = () => {
      if (!row.tokens.length) return;
      row.height = row.sound ? soundSize * 1.08 : size * 1.36;
      rows.push(row);
      height += row.height;
      row = { tokens: [], width: 0, height: 0, sound: false };
    };
    for (const token of tokens) {
      if (row.tokens.length && row.width + token.width > maxWidth) push();
      if (!row.tokens.length && !token.sound) token.text = token.text.trimStart();
      token.width = measure(token.text, token.sound);
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

/** The biggest type (between min and max) whose text fits a box, or null if even the smallest doesn't. */
function fit(context: CanvasRenderingContext2D, story: string, boxW: number, boxH: number, min: number, max: number, f: Fonts): Text | null {
  const fits = (text: Text) => text.height <= boxH && text.width <= boxW;
  const smallest = layout(context, story, min, boxW, f);
  if (!fits(smallest)) return null;
  let best = smallest;
  let low = min;
  let high = max;
  for (let i = 0; i < 6; i++) {
    const mid = (low + high) / 2;
    const text = layout(context, story, mid, boxW, f);
    if (fits(text)) {
      best = text;
      low = mid;
    } else high = mid;
  }
  return best;
}

function drawText(context: CanvasRenderingContext2D, text: Text, left: number, top: number, rtl: boolean, f: Fonts, paper: string) {
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
    let x = rtl ? left + text.width - row.width - step : left + step;
    const baseline = y - (row.sound ? size * 0.25 : size * 0.38);
    // Right-to-left rows are drawn from their right edge.
    for (const token of rtl ? [...row.tokens].reverse() : row.tokens) {
      if (token.sound) {
        context.save();
        context.translate(x + token.width / 2, baseline);
        context.rotate((((soundIndex + 1) % 3) - 1) * 0.05);
        context.font = `700 ${size * 1.75}px ${f.sound}`;
        context.textAlign = "center";
        context.lineJoin = "round";
        context.lineWidth = size * 0.24;
        context.strokeStyle = paper;
        context.strokeText(token.text, 0, 0);
        context.fillStyle = SOUND_COLORS[soundIndex++ % SOUND_COLORS.length]!;
        context.fillText(token.text, 0, 0);
        context.restore();
      } else {
        context.font = `500 ${size}px ${f.story}`;
        context.textAlign = "left";
        context.fillStyle = INK;
        context.fillText(token.text, x, baseline);
      }
      x += token.width;
    }
  }
}

type Box = { x: number; y: number; w: number; h: number };
type Placed = { box: Box; text: Text };
/** A block of words on the page, as fractions of its width and height. */
export type WordBox = { left: number; right: number; top: number; bottom: number };

export type StoryPage = {
  url: string;
  /** "space": the words fit in empty paper (in one or two blocks); "room": the picture was made smaller to fit them. */
  mode: "space" | "room";
  /** Where the words are, so badges drawn over the page can avoid them. */
  words: WordBox[];
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
}): Promise<StoryPage | null> {
  if (position === "off" || (cover && position === "auto") || !story?.trim()) return null;
  const [img, f] = await Promise.all([loadImage(imageUrl), storyFonts()]);
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
  const maxSize = W * 0.066;
  // Type sizes to try, biggest first: about 16px on a phone, then smaller before the picture is touched.
  const SIZES = [0.044, 0.038, 0.032, 0.028].map((share) => W * share);

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
  const fitIn = (box: Box, text: string, min: number) => fit(context, text, Math.min(box.w - pad * 2, W * 0.86), box.h - pad * 2, min, maxSize, f);
  const score = (box: Box, size: number) => size * preference((box.y + box.h / 2) / H) * roominess(box.w);
  // Cheap check before laying text out: the box must at least have the area the letters need.
  const roomFor = (box: Box, text: string, size: number) => box.w * box.h >= text.length * size * size * 0.62;
  const units = storyUnits(story);

  // The biggest type wins; at the same size one block beats a split one, then the nicer box.
  const tier = (size: number) => SIZES.findIndex((t) => size >= t * 0.999);
  type Candidate = { blocks: Placed[]; size: number; score: number };
  const better = (a: Candidate, b: Candidate | null) => {
    if (!b) return true;
    if (tier(a.size) !== tier(b.size)) return tier(a.size) < tier(b.size);
    if (a.blocks.length !== b.blocks.length) return a.blocks.length < b.blocks.length;
    return a.score > b.score;
  };
  const smallest = SIZES.at(-1)!;

  let best: Candidate | null = null;
  let usable = masks[0]!;
  for (const mask of masks) {
    usable = mask;
    // Many maximal rectangles nearly coincide; keep one of each.
    const boxes: Box[] = [];
    for (const rect of emptyRects(mask)) {
      const box = { x: rect.left * cellW, y: rect.top * cellH, w: (rect.right - rect.left) * cellW, h: (rect.bottom - rect.top) * cellH };
      const centre = (box.y + box.h / 2) / H;
      if (box.w < W * 0.24 || box.h < smallest * 2.4 || centre < zoneTop || centre > zoneBottom) continue;
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
      if (box.w < W * 0.45 || !roomFor(box, story, smallest)) continue;
      const text = fitIn(box, story, smallest);
      if (text) {
        const candidate = { blocks: [{ box, text }], size: text.size, score: score(box, text.size) };
        if (better(candidate, best)) best = candidate;
      }
    }
    // Two blocks at one size: the start of the paragraph in the first box, the rest in the second —
    // one above the other, or side by side in reading order. Only worth it for bigger type.
    const needTier = best ? tier(best.size) : SIZES.length;
    if (needTier > 0 && units.length > 1) {
      const min = SIZES[Math.min(needTier, SIZES.length) - 1]!;
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
            if (!roomFor(first, start, min) || !roomFor(second, rest, min)) continue;
            const ta = fitIn(first, start, min);
            const tb = ta && fitIn(second, rest, min);
            if (!ta || !tb) continue;
            // The same type size in both blocks, so they read as one text.
            const size = Math.min(ta.size, tb.size);
            const candidate = {
              blocks: [
                { box: first, text: ta.size === size ? ta : layout(context, start, size, Math.min(first.w - pad * 2, W * 0.86), f) },
                { box: second, text: tb.size === size ? tb : layout(context, rest, size, Math.min(second.w - pad * 2, W * 0.86), f) },
              ],
              size,
              score: size * preference((first.y + first.h / 2) / H) * roominess(Math.min(first.w, second.w)) * 0.95,
            };
            if (better(candidate, best)) best = candidate;
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
    for (const { box, text } of placed) {
      const left = box.x + (box.w - text.width) / 2;
      const top = box.y + (box.h - text.height) / 2;
      drawText(context, text, left, top, rtl, f, cells.paper);
      words.push({ left: left / W, right: (left + text.width) / W, top: top / H, bottom: (top + text.height) / H });
      if (debug) {
        context.strokeStyle = "#16a34a";
        context.lineWidth = 3;
        context.strokeRect(box.x, box.y, box.w, box.h);
      }
    }
    return finish(canvas, picture, "space", words);
  }

  // ---------- 2. No room: make the picture smaller and give the words their own paper ----------
  const margin = W * 0.06;
  let text = layout(context, story, W * 0.054, W - margin * 2, f);
  while (text.height + margin * 1.4 > H * 0.36 && text.size > SIZES.at(-1)! * 0.85) text = layout(context, story, text.size * 0.92, W - margin * 2, f);
  const band = text.height + margin * 1.4;
  const wordsBelow = position === "bottom";
  const k = (H - band - margin * 0.5) / H;
  const pw = W * k;
  const ph = H * k;
  const px = (W - pw) / 2;
  const py = wordsBelow ? margin * 0.5 : band;
  context.fillStyle = cells.paper;
  context.fillRect(0, 0, W, H);
  // The whole picture, laid on the page like a print with a soft shadow; nothing is covered or cut.
  context.save();
  context.shadowColor = "rgb(60 44 26 / 0.22)";
  context.shadowBlur = W * 0.02;
  context.shadowOffsetY = W * 0.006;
  context.beginPath();
  context.roundRect(px, py, pw, ph, W * 0.015);
  context.fillStyle = cells.paper;
  context.fill();
  context.restore();
  context.save();
  context.beginPath();
  context.roundRect(px, py, pw, ph, W * 0.015);
  context.clip();
  context.drawImage(picture, px, py, pw, ph);
  if (debug) {
    // The empty paper that was found, on the smaller picture: too little of it for the words.
    context.fillStyle = "rgb(22 163 74 / 0.3)";
    for (const [r, row] of usable.entries()) row.forEach((empty, c) => empty && context.fillRect(px + c * cellW * k, py + r * cellH * k, cellW * k, cellH * k));
  }
  context.restore();
  const textTop = wordsBelow ? py + ph + (band - text.height) / 2 : (band - text.height) / 2 + margin * 0.15;
  drawText(context, text, (W - text.width) / 2, textTop, rtl, f, cells.paper);
  if (debug) {
    context.strokeStyle = "#e11d48";
    context.lineWidth = 3;
    context.strokeRect((W - text.width) / 2, textTop, text.width, text.height);
  }
  const textLeft = (W - text.width) / 2;
  return finish(canvas, picture, "room", [{ left: textLeft / W, right: (textLeft + text.width) / W, top: textTop / H, bottom: (textTop + text.height) / H }]);
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
  const key = JSON.stringify([options.imageUrl, options.story, options.position, options.aspect, options.lang, options.width, options.cover]);
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

async function finish(canvas: HTMLCanvasElement, picture: HTMLCanvasElement, mode: StoryPage["mode"], words: StoryPage["words"]): Promise<StoryPage | null> {
  picture.width = picture.height = 0;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  canvas.width = canvas.height = 0;
  return blob ? { url: URL.createObjectURL(blob), mode, words } : null;
}
