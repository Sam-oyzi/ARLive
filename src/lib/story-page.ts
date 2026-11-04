// Draws a page's story text onto its picture, like a printed picture book: short lines of book type and
// *sound words* big, bold and in colour. The words only ever go on empty paper — light areas with no
// ink, with a margin round the drawing — and never over the sketch. When no empty area is big enough,
// the picture is made a little smaller and the words get their own paper above (or below) it.
// The result is a new image, so the words turn (and curl) with the page. Browser only.
import { emptyCells, emptyRects, parseStory, shrinkMask, type TextPosition } from "./story-text";

const INK = "#2b2118";
const PAPER = "#fbf6ea";
const SOUND_COLORS = ["#ea580c", "#0284c7", "#16a34a", "#e11d48", "#7c5a00"];
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur"]);
// The picture is checked in cells this many columns across (rows follow the page shape), each sampled
// with CELL × CELL pixels so a thin ink line inside a cell still shows up.
const COLUMNS = 40;
const CELL = 5;

type Fonts = { story: string; sound: string };
let fonts: Promise<Fonts> | null = null;

/** The families next/font registered in the root layout (--font-story, --font-sound), loaded. */
function storyFonts(): Promise<Fonts> {
  fonts ??= (async () => {
    const css = getComputedStyle(document.documentElement);
    const found = {
      story: css.getPropertyValue("--font-story").trim() || "Georgia, serif",
      sound: css.getPropertyValue("--font-sound").trim() || "system-ui, sans-serif",
    };
    await Promise.all([document.fonts.load(`500 40px ${found.story}`), document.fonts.load(`700 40px ${found.sound}`)]).catch(() => {});
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
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Couldn't load ${url}`));
      img.src = url;
    });
    images.set(url, image);
    image.catch(() => images.delete(url));
  }
  return image;
}

type Cells = { light: number[][]; contrast: number[][]; paper: string };

/** Brightness and ink (darkest-to-lightest spread) of every cell, plus the paper's own colour. */
function sampleCells(source: HTMLCanvasElement, cols: number, rows: number): Cells {
  const small = document.createElement("canvas");
  small.width = cols * CELL;
  small.height = rows * CELL;
  const context = small.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(source, 0, 0, small.width, small.height);
  const { data } = context.getImageData(0, 0, small.width, small.height);
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
          const i = ((r * CELL + y) * small.width + c * CELL + x) * 4;
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

function layout(context: CanvasRenderingContext2D, story: string, size: number, maxWidth: number, f: Fonts): Text {
  const bodyFont = `500 ${size}px ${f.story}`;
  const soundSize = size * 1.75;
  const soundFont = `700 ${soundSize}px ${f.sound}`;
  const measure = (text: string, sound: boolean) => {
    context.font = sound ? soundFont : bodyFont;
    return context.measureText(text).width;
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
  for (let i = 0; i < 8; i++) {
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

export type StoryPage = {
  url: string;
  /** "space": the words fit in empty paper; "room": the picture was made smaller to fit them. */
  mode: "space" | "room";
  /** Where the words are, as fractions of the page, so badges drawn over the page can avoid them. */
  words: { top: number; bottom: number };
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
  picture.getContext("2d")!.drawImage(img, (W - img.naturalWidth * scale) / 2, (H - img.naturalHeight * scale) / 2, img.naturalWidth * scale, img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d")!;
  const rtl = RTL_LANGUAGES.has(lang.split("-")[0]!.toLowerCase());
  // Never smaller than about 16px on a phone: young readers need big type more than a full-size picture.
  const minSize = W * 0.044;
  const maxSize = W * 0.066;

  // ---------- 1. Words in empty paper ----------
  const rows = Math.round(COLUMNS * aspect);
  const cells = sampleCells(picture, COLUMNS, rows);
  const usable = shrinkMask(emptyCells(cells.light, cells.contrast), 1);
  const cellW = W / COLUMNS;
  const cellH = H / rows;
  // A chosen position limits where the box's centre may be; automatic prefers the top, then the bottom.
  const zone: Record<Exclude<TextPosition, "off">, [number, number]> = { auto: [0, 1], top: [0, 0.45], middle: [0.3, 0.7], bottom: [0.55, 1] };
  const [zoneTop, zoneBottom] = zone[position];
  const preference = (centre: number) => (position !== "auto" ? 1 : centre < 0.4 ? 1 : centre > 0.6 ? 0.95 : 0.85);
  // Wide boxes read like a book; a narrow column of short broken lines doesn't.
  const roominess = (w: number) => 0.8 + 0.2 * Math.min(1, w / (W * 0.75));

  let best: { text: Text; x: number; y: number; w: number; h: number; score: number } | null = null;
  for (const rect of emptyRects(usable).slice(0, 80)) {
    const x = rect.left * cellW;
    const y = rect.top * cellH;
    const w = (rect.right - rect.left) * cellW;
    const h = (rect.bottom - rect.top) * cellH;
    const centre = (y + h / 2) / H;
    if (w < W * 0.45 || h < minSize * 2.4 || centre < zoneTop || centre > zoneBottom) continue;
    const pad = W * 0.02;
    const text = fit(context, story, Math.min(w - pad * 2, W * 0.86), h - pad * 2, minSize, maxSize, f);
    if (!text) continue;
    const score = text.size * preference(centre) * roominess(w);
    if (!best || score > best.score) best = { text, x, y, w, h, score };
  }

  if (best) {
    context.drawImage(picture, 0, 0);
    if (debug) {
      context.fillStyle = "rgb(22 163 74 / 0.22)";
      for (const [r, row] of usable.entries()) row.forEach((empty, c) => empty && context.fillRect(c * cellW, r * cellH, cellW, cellH));
    }
    const left = best.x + (best.w - best.text.width) / 2;
    const top = best.y + (best.h - best.text.height) / 2;
    drawText(context, best.text, left, top, rtl, f, cells.paper);
    if (debug) {
      context.strokeStyle = "#16a34a";
      context.lineWidth = 3;
      context.strokeRect(best.x, best.y, best.w, best.h);
    }
    return finish(canvas, "space", { top: top / H, bottom: (top + best.text.height) / H });
  }

  // ---------- 2. No room: make the picture smaller and give the words their own paper ----------
  const pad = W * 0.06;
  let text = layout(context, story, W * 0.054, W - pad * 2, f);
  while (text.height + pad * 1.4 > H * 0.36 && text.size > minSize * 0.85) text = layout(context, story, text.size * 0.92, W - pad * 2, f);
  const band = text.height + pad * 1.4;
  const wordsBelow = position === "bottom";
  const k = (H - band - pad * 0.5) / H;
  const pw = W * k;
  const ph = H * k;
  const px = (W - pw) / 2;
  const py = wordsBelow ? pad * 0.5 : band;
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
  context.restore();
  const textTop = wordsBelow ? py + ph + (band - text.height) / 2 : (band - text.height) / 2 + pad * 0.15;
  drawText(context, text, (W - text.width) / 2, textTop, rtl, f, cells.paper);
  if (debug) {
    context.strokeStyle = "#e11d48";
    context.lineWidth = 3;
    context.strokeRect((W - text.width) / 2, textTop, text.width, text.height);
  }
  return finish(canvas, "room", { top: textTop / H, bottom: (textTop + text.height) / H });
}

async function finish(canvas: HTMLCanvasElement, mode: StoryPage["mode"], words: StoryPage["words"]): Promise<StoryPage | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ? { url: URL.createObjectURL(blob), mode, words } : null;
}
