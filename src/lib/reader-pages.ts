/** The pages actually on screen, including a closed front or back cover. */
export function visibleReaderPages(index: number, count: number, single = false): number[] {
  if (index < 0 || index >= count) return [];
  if (single) return [index];
  const spread = Math.floor((index + 1) / 2);
  return [spread * 2 - 1, spread * 2].filter((page) => page >= 0 && page < count);
}

/** Load both visible pages first, then a small neighbourhood; never the whole book. */
export function nearbyReaderPages(visible: number[], count: number, radius = 2): number[] {
  if (!visible.length) return [];
  const distance = (page: number) => Math.min(...visible.map((open) => Math.abs(open - page)));
  return Array.from({ length: count }, (_, i) => i)
    .filter((i) => distance(i) <= radius)
    .sort((a, b) => distance(a) - distance(b) || a - b);
}
