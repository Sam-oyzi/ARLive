// How long a child takes with a page, for the reader's Auto read. Early readers (about 4 to 7) read
// aloud at roughly 40 to 100 words a minute, and every page also needs a moment for its picture.

/** Words a minute. */
export const READING_SPEEDS = { slow: 45, normal: 70, fast: 100 } as const;
export type ReadingSpeed = keyof typeof READING_SPEEDS;

export const READING_SPEED_LABEL: Record<ReadingSpeed, string> = {
  slow: "Slow · just starting to read",
  normal: "Normal",
  fast: "Fast · confident reader",
};

/** Looking at the picture, per page. */
const PICTURE_SECONDS = 4;
/** A breath at the end of each sentence or line. */
const PAUSE_SECONDS = 0.4;
const MIN_SECONDS = 5;
const MAX_SECONDS = 120;

export function isReadingSpeed(value: unknown): value is ReadingSpeed {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(READING_SPEEDS, value);
}

export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Seconds to read the open pages (one, or a spread of two) at this speed. */
export function readingSeconds(stories: (string | null | undefined)[], speed: ReadingSpeed): number {
  const pages = Math.max(1, stories.length);
  let words = 0;
  let pauses = 0;
  for (const story of stories) {
    if (!story) continue;
    words += countWords(story);
    pauses += story.match(/[.!?…]+|\n+/g)?.length ?? 0;
  }
  const seconds = pages * PICTURE_SECONDS + (words * 60) / READING_SPEEDS[speed] + pauses * PAUSE_SECONDS;
  return Math.round(Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, seconds)) * 10) / 10;
}
