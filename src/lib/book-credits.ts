import { pageAspect } from "./book-format";

// Preserve the spelling already printed in the original Water Drop book.
export const DEFAULT_BOOK_AUTHOR = "Iassam Houzi";

export function defaultBookQuote(title: string): string {
  if (/little lost roar/i.test(title)) return "Even the smallest voice deserves a listening heart.";
  if (/water drop/i.test(title)) return "Every little drop belongs to a bigger journey.";
  if (/lina/i.test(title)) return "Kindness grows when we make room to share.";
  return `A curious heart opens a new world in ${title}.`;
}

export type CreditBook = {
  title: string;
  authorName?: string | null;
  copyrightYear?: number | null;
  bookQuote?: string | null;
  createdAt: Date | string;
  format?: string;
};

export function bookCredits(book: CreditBook) {
  const author = book.authorName?.trim() || DEFAULT_BOOK_AUTHOR;
  const year = book.copyrightYear ?? new Date(book.createdAt).getUTCFullYear();
  return { author, year, quote: book.bookQuote?.trim() || defaultBookQuote(book.title), copyright: `© ${year} ${author}. All rights reserved.` };
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

/** Bound line lengths even when an administrator enters a long unbroken word. */
export function creditLines(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const chunks = Array.from(word).reduce<string[]>((parts, character, index) => {
        const part = Math.floor(index / width);
        parts[part] = (parts[part] ?? "") + character;
        return parts;
      }, []);
      for (const chunk of chunks) {
        if (line && Array.from(`${line} ${chunk}`).length > width) { lines.push(line); line = ""; }
        line = line ? `${line} ${chunk}` : chunk;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** One source for the reader's back cover and the printed PDF: no baked-in shared quote or name. */
export function backCoverSvg(book: CreditBook): string {
  const { author, quote, copyright } = bookCredits(book);
  const width = 768;
  const height = Math.round(width * pageAspect(book.format));
  const quoteLines = creditLines(quote.replace(/^[“"]|[”"]$/g, ""), 40);
  const quoteSize = quoteLines.length <= 4 ? 38 : quoteLines.length <= 7 ? 30 : 23;
  const quoteLeading = quoteSize * 1.35;
  const quoteTop = height * 0.49 - (quoteLines.length - 1) * quoteLeading / 2;
  const nameLines = creditLines(author, 35);
  const nameSize = nameLines.length === 1 ? 52 : 30;
  const nameLeading = nameSize * 1.2;
  const nameTop = height * 0.81 - (nameLines.length - 1) * nameLeading / 2;
  const rights = creditLines(copyright, 76);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${escapeXml(book.title)} — quote and credits</title>
  <defs><radialGradient id="paper" cx="48%" cy="41%" r="75%"><stop stop-color="#f7efdf"/><stop offset="1" stop-color="#e6d9be"/></radialGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#paper)"/>
  <g text-anchor="middle" fill="#624631" font-family="Georgia, serif">
    ${quoteLines.map((line, index) => `<text x="384" y="${quoteTop + index * quoteLeading}" font-style="italic" font-size="${quoteSize}">${index === 0 ? "“" : ""}${escapeXml(line)}${index === quoteLines.length - 1 ? "”" : ""}</text>`).join("\n    ")}
    <text x="384" y="${height * 0.73}" font-size="18" letter-spacing="3">WRITTEN AND CREATED BY</text>
    ${nameLines.map((line, index) => `<text x="384" y="${nameTop + index * nameLeading}" font-family="Segoe Script, Brush Script MT, Georgia, serif" font-style="italic" font-size="${nameSize}">${escapeXml(line)}</text>`).join("\n    ")}
    <path d="M267 ${height * 0.84} Q378 ${height * 0.855} 501 ${height * 0.835}" fill="none" stroke="#9c7758" stroke-width="1.6" stroke-linecap="round"/>
    ${rights.map((line, index) => `<text x="384" y="${height * 0.91 + index * 24}" font-size="18">${escapeXml(line)}</text>`).join("\n    ")}
  </g>
</svg>`;
}
