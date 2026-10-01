// Optimistic route guard: bounces signed-out visitors and wrong-role users before rendering.
// Pages, server actions and route handlers still authorise every request themselves (src/lib/auth.ts).
import { NextResponse, type NextRequest } from "next/server";
import { homeFor, type Role } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

const AREAS: [prefix: string, roles: Role[]][] = [
  ["/admin", ["SUPER_ADMIN"]],
  ["/school", ["SCHOOL_ADMIN"]],
  ["/learn", ["STUDENT"]],
  ["/scan", ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"]],
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" || pathname === "/join") {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), request.url)) : NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  const area = AREAS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (area && !area[1].includes(session.role)) {
    return NextResponse.redirect(new URL(homeFor(session.role), request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/school/:path*", "/learn/:path*", "/scan/:path*", "/login", "/join"],
};
