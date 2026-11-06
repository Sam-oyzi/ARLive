/** Upload URLs are immutable. A private browser copy still requires authorization on revalidation. */
export function uploadEtag(key: string, size: number): string {
  return `"${key}:${size}"`;
}

export function matchesEtag(header: string | null, etag: string): boolean {
  return !!header && header.split(",").some((value) => value.trim() === "*" || value.trim().replace(/^W\//, "") === etag);
}
