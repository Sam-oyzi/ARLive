// A four-pixel sideways pull lifts the paper and finishes the turn on release.
// Returning to the starting point or a browser cancellation puts it back.
export const PAGE_PULL_PX = 4;

export function completesPageTurn(released: boolean, forwardDistance: number): boolean {
  return released && forwardDistance >= PAGE_PULL_PX;
}
