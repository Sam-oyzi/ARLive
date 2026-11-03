// Session token helpers. No database or Node APIs here so proxy.ts can use it too.
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./roles";

export const SESSION_COOKIE = "arlive_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  uid: string;
  role: Role;
  schoolId: string | null;
};

/** True when a token predates the user's last password change, which signs out older sessions. */
export function isRevoked(issuedAt: number, passwordChangedAt: Date | null): boolean {
  return !!passwordChangedAt && issuedAt < Math.floor(passwordChangedAt.getTime() / 1000);
}

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is missing or too short");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export const HANDOFF_TTL = 5 * 60; // seconds

/** Short-lived token in a QR code that signs the same user in on their phone. */
export async function signHandoff(uid: string, path: string): Promise<string> {
  return new SignJWT({ uid, path, purpose: "handoff" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${HANDOFF_TTL}s`)
    .sign(key());
}

export async function verifyHandoff(token: string | null): Promise<{ uid: string; path: string; issuedAt: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.purpose !== "handoff" || typeof payload.uid !== "string" || typeof payload.path !== "string") return null;
    return { uid: payload.uid, path: payload.path, issuedAt: payload.iat ?? 0 };
  } catch {
    return null;
  }
}

export async function verifySession(token: string | undefined): Promise<(SessionPayload & { issuedAt: number }) | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    // Handoff tokens share the signing key but must never work as a session.
    if (payload.purpose !== undefined) return null;
    if (typeof payload.uid !== "string" || typeof payload.role !== "string") return null;
    return {
      uid: payload.uid,
      role: payload.role as Role,
      schoolId: typeof payload.schoolId === "string" ? payload.schoolId : null,
      issuedAt: payload.iat ?? 0,
    };
  } catch {
    return null;
  }
}
