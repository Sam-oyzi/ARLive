import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { homeFor, type Role } from "./roles";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from "./session";

export async function createSession(user: { id: string; role: string; schoolId: string | null }) {
  const token = await signSession({ uid: user.id, role: user.role as Role, schoolId: user.schoolId });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export const getSession = cache(async () => {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
});

/** The signed-in user, re-read from the database so deactivations take effect immediately. */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.uid },
    include: { school: true },
  });
  if (!user || !user.active) return null;
  if (user.school && !user.school.active && user.role !== "SUPER_ADMIN") return null;
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** For pages: redirect to login (or the user's own area) when the role doesn't match. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  // The proxy already sent visitors without a valid token to /login; reaching here means the
  // token outlived its user (deleted/disabled), so clear the cookie rather than loop.
  if (!user) redirect("/logout");
  if (roles && !roles.includes(user.role as Role)) redirect(homeFor(user.role));
  return user;
}

export class AuthError extends Error {
  constructor(message = "You are not allowed to do that.") {
    super(message);
  }
}

/** For server actions and route handlers: throw instead of redirecting. */
export async function assertRole(roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role as Role)) throw new AuthError();
  return user;
}

/** School admins may only touch their own school. */
export async function assertSchoolAdmin(): Promise<CurrentUser & { schoolId: string }> {
  const user = await assertRole(["SCHOOL_ADMIN"]);
  if (!user.schoolId) throw new AuthError("Your account is not linked to a school.");
  return user as CurrentUser & { schoolId: string };
}
