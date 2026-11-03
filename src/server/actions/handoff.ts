"use server";

import { getCurrentUser } from "@/lib/auth";
import { lanAddresses } from "@/lib/network";
import { signHandoff } from "@/lib/session";

/**
 * Data for the "continue on your phone" QR code: a 5-minute sign-in token for the current user,
 * plus where a phone should go. `npm run dev:phone` sets ARLIVE_PHONE_ORIGIN to its HTTPS proxy;
 * otherwise a laptop on localhost hands over to its Wi-Fi address.
 */
export async function createPhoneHandoff(
  path: string,
): Promise<{ token: string | null; phoneOrigin: string | null; lanHost: string | null }> {
  const user = await getCurrentUser();
  const safePath = path.startsWith("/scan/") || path.startsWith("/learn") ? path : "/";
  const dev = process.env.NODE_ENV !== "production";
  return {
    token: user ? await signHandoff(user.id, safePath) : null,
    phoneOrigin: dev ? process.env.ARLIVE_PHONE_ORIGIN || null : null,
    lanHost: dev ? (lanAddresses()[0] ?? null) : null,
  };
}
