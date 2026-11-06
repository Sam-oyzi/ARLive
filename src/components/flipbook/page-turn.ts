// A four-pixel sideways pull lifts the paper and finishes the turn on release.
// Returning to the starting point or a browser cancellation puts it back.
export const PAGE_PULL_PX = 4;

export function completesPageTurn(released: boolean, forwardDistance: number): boolean {
  return released && forwardDistance >= PAGE_PULL_PX;
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
