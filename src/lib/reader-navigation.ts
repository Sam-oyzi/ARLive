/** Stable target IDs survive reordering; reader state travels with the experience link. */
export function readerHref(bookId: string, pageId?: string | null, language = ""): string {
  const query = new URLSearchParams();
  if (pageId) query.set("page", pageId);
  if (language) query.set("lang", language);
  return `/read/${encodeURIComponent(bookId)}${query.size ? `?${query}` : ""}`;
}

/** A return link stays in this book or a known school/subject entry point. */
export function bookReturnHref(bookId: string, candidate: unknown, fallback: string): string {
  if (typeof candidate !== "string" || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
  try {
    const url = new URL(candidate, "https://reader.invalid");
    const id = encodeURIComponent(bookId);
    const editor = url.pathname.startsWith(`/admin/books/${id}/targets/`) && /^[a-zA-Z0-9_-]+$/.test(url.pathname.slice(`/admin/books/${id}/targets/`.length));
    const channel = ["/school", "/school/catalog", "/learn"].includes(url.pathname) || /^\/learn\/[a-zA-Z0-9_-]+$/.test(url.pathname);
    if (url.origin !== "https://reader.invalid" || (!editor && !channel && ![`/read/${id}`, `/library/${id}`, `/admin/books/${id}`].includes(url.pathname))) return fallback;
    if (url.pathname !== `/read/${id}`) return `${url.pathname}${url.search}${url.hash}`;
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
