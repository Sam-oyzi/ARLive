"use server";

import { getCurrentUser } from "@/lib/auth";
import { lanAddresses } from "@/lib/network";
import { signHandoff } from "@/lib/session";

/**
 * Data for the "continue on your phone" QR code: a 5-minute sign-in token for the current user,
 * plus this machine's Wi-Fi address so a laptop on localhost can hand over to a phone on the LAN.
 */
export async function createPhoneHandoff(path: string): Promise<{ token: string | null; lanHost: string | null }> {
  const user = await getCurrentUser();
  const safePath = path.startsWith("/scan/") || path.startsWith("/learn") ? path : "/";
  const lanHost = process.env.NODE_ENV === "production" ? null : (lanAddresses()[0] ?? null);
  return { token: user ? await signHandoff(user.id, safePath) : null, lanHost };
}
