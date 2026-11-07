// A four-pixel sideways pull lifts the paper, and once lifted it carries on over when let go, like a
// real page: a short pull is enough, and a finger slipping back a little as it lifts doesn't matter.
// Only bringing the page most of the way back to where it started puts it back. If the browser takes
// the gesture away mid-pull (a phone's own swipe, a link starting to drag), a clear pull still turns.
export const PAGE_PULL_PX = 4;
/** A pull this long is a deliberate turn, even when the browser cancels the gesture. */
export const SURE_PULL_PX = 24;
/** Letting go further back than this share of the furthest pull means "not this page after all". */
const TAKEN_BACK = 0.4;

export function completesPageTurn(released: boolean, forwardDistance: number, furthest = forwardDistance): boolean {
  const kept = forwardDistance >= Math.max(PAGE_PULL_PX, furthest * TAKEN_BACK);
  return kept && (released || furthest >= SURE_PULL_PX);
}

/** The same spring sampled by elapsed wall time, even after an expensive or dropped frame. */
export function pageTurnSpring(from: number, to: 0 | 1, elapsedMs: number) {
  const stiffness = to === 1 ? 170 : 150;
  const damping = to === 1 ? 26 : 24;
  const decay = damping / 2;
  const frequency = Math.sqrt(stiffness - decay * decay);
  const seconds = Math.max(0, elapsedMs) / 1000;
  const envelope = (from - to) * Math.exp(-decay * seconds);
  const position = to + envelope * (Math.cos(frequency * seconds) + decay / frequency * Math.sin(frequency * seconds));
  const velocity = -envelope * stiffness / frequency * Math.sin(frequency * seconds);
  return { position: Math.max(0, Math.min(1, position)), finished: Math.abs(position - to) < 0.002 && Math.abs(velocity) < 0.02 };
}
