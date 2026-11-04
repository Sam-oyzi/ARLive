import { headers } from "next/headers";
import { lanAddresses } from "./network";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * The address printed into QR codes, which phones open. SITE_URL wins (set it in production);
 * otherwise the host this page was opened on, swapped in development for the `npm run dev:phone`
 * HTTPS proxy or the laptop's Wi-Fi address when it's localhost, which a phone can't reach.
 */
export async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http";
  const url = new URL(`${proto}://${host}`);
  if (process.env.NODE_ENV !== "production" && LOCAL_HOSTS.has(url.hostname)) {
    if (process.env.ARLIVE_PHONE_ORIGIN) return process.env.ARLIVE_PHONE_ORIGIN;
    const lan = lanAddresses()[0];
    if (lan) url.hostname = lan;
  }
  return url.origin;
}

/** Where a book's QR code leads: straight into AR when it has AR pages, otherwise the reader. */
export function bookQrPath(book: { id: string; mindUrl: string | null }): string {
  return book.mindUrl ? `/scan/${book.id}` : `/read/${book.id}`;
}
