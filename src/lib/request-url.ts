import type { NextRequest } from "next/server";

/**
 * Absolute URL for `path` on the host the browser actually used.
 *
 * In development `request.url` carries the server's own hostname (localhost), so redirects built
 * from it send a phone on the Wi-Fi to "localhost" — the phone itself. Use the Host header (or a
 * reverse proxy's X-Forwarded-* headers) instead.
 */
export function urlOnRequestHost(path: string, request: NextRequest): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? request.nextUrl.protocol.replace(":", "");
  if (!host) return new URL(path, request.url);
  return new URL(path, `${proto}://${host}`);
}
