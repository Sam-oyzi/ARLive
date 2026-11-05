/** Stable target IDs survive reordering; reader state travels with the experience link. */
export function readerHref(bookId: string, pageId?: string | null, language = ""): string {
  const query = new URLSearchParams();
  if (pageId) query.set("page", pageId);
  if (language) query.set("lang", language);
  return `/read/${encodeURIComponent(bookId)}${query.size ? `?${query}` : ""}`;
}

/** A return link can only lead to this book's reader, library page, or Studio. */
export function bookReturnHref(bookId: string, candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const url = new URL(candidate, "https://reader.invalid");
    const id = encodeURIComponent(bookId);
    const editor = url.pathname.startsWith(`/admin/books/${id}/targets/`) && /^[a-zA-Z0-9_-]+$/.test(url.pathname.slice(`/admin/books/${id}/targets/`.length));
    if (url.origin !== "https://reader.invalid" || (!editor && ![`/read/${id}`, `/library/${id}`, `/admin/books/${id}`].includes(url.pathname))) return fallback;
    if (url.pathname !== `/read/${id}`) return url.pathname;
    return readerHref(bookId, url.searchParams.get("page"), url.searchParams.get("lang") ?? "");
  } catch {
    return fallback;
  }
}

export function readerPageIndex(pageIds: string[], requested: unknown): number {
  if (requested === "back-cover") return pageIds.length;
  const index = typeof requested === "string" ? pageIds.indexOf(requested) : -1;
  return index < 0 ? 0 : index;
}

export function withReturnTo(href: string, returnTo: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(returnTo)}`;
}
