// Printed page sizes for books. The reader shows pages at the same proportions as the paper.
export const BOOK_FORMATS = {
  A5: { label: "A5 · 148 × 210 mm", widthMm: 148, heightMm: 210 },
  // 3:4 pages: exactly half of a 1536×1024 ChatGPT spread, so split spreads fill the page uncropped.
  SKETCH: { label: "Sketchbook 3:4 · 150 × 200 mm", widthMm: 150, heightMm: 200 },
  A4: { label: "A4 · 210 × 297 mm", widthMm: 210, heightMm: 297 },
  LETTER: { label: "US Letter · 8.5 × 11 in", widthMm: 215.9, heightMm: 279.4 },
  SQUARE: { label: "Square · 210 × 210 mm", widthMm: 210, heightMm: 210 },
} as const;

export type BookFormat = keyof typeof BOOK_FORMATS;

export function bookFormat(format: string | null | undefined) {
  return BOOK_FORMATS[(format ?? "A5") as BookFormat] ?? BOOK_FORMATS.A5;
}

/** Page height / width */
export function pageAspect(format: string | null | undefined) {
  const f = bookFormat(format);
  return f.heightMm / f.widthMm;
}
