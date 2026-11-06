// A page's sounds as stored and as the viewers play them. No React here, so server pages and actions
// can use it (the player is src/lib/page-sound.ts).

/**
 * `scene`: plays on its own in the page's experience (MindAR, 8th Wall, the story box, the 360° view).
 * `reading`: the reader's soundtrack, from this page until a later page sets its own.
 */
export const SOUND_KINDS = ["scene", "reading"] as const;
export type SoundKind = (typeof SOUND_KINDS)[number];

export const SOUND_LIMIT: Record<SoundKind, number> = { scene: 4, reading: 2 };
export const MAX_PAGE_SOUNDS = SOUND_LIMIT.scene;

export function soundKindOf(value: unknown): SoundKind {
  return value === "reading" ? "reading" : "scene";
}

/** One sound of a page, as Studio sets it up. */
export type SoundLayer = { url: string; volume: number; loop: boolean; delay: number };

/** A sound as Studio edits it. */
export type PageSoundRow = SoundLayer & { id: string; name: string; kind: SoundKind };

export function pageSoundRow({ id, name, url, volume, loop, delay, kind }: Omit<PageSoundRow, "kind"> & { kind: string }): PageSoundRow {
  return { id, name, url, volume, loop, delay, kind: soundKindOf(kind) };
}

/** The fields the viewers need, from database rows in Studio's order. */
export function soundLayers(rows: { url: string; volume: number; loop: boolean; delay: number }[]): SoundLayer[] {
  return rows.map(({ url, volume, loop, delay }) => ({ url, volume, loop, delay }));
}

/**
 * The soundtrack while these pages are open: the nearest page at or before the last open one that has
 * one, so a soundtrack set on the first page plays through the book.
 */
export function soundtrackFor<T>(pages: { soundtrack: T[] }[], open: number[]): T[] {
  for (let i = Math.min(Math.max(-1, ...open), pages.length - 1); i >= 0; i--) {
    if (pages[i]!.soundtrack.length) return pages[i]!.soundtrack;
  }
  return [];
}
