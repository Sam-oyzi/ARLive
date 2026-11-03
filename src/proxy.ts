// Optimistic route guard: bounces signed-out visitors and wrong-role users before rendering.
// Pages, server actions and route handlers still authorise every request themselves (src/lib/auth.ts).
import { NextResponse, type NextRequest } from "next/server";
import { urlOnRequestHost } from "@/lib/request-url";
import { homeFor, rolesForPath } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login" || pathname === "/join" || pathname === "/signup") {
    return session ? NextResponse.redirect(urlOnRequestHost(homeFor(session.role), request)) : NextResponse.next();
  }

  if (!session) {
    const login = urlOnRequestHost("/login", request);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  const roles = rolesForPath(pathname);
  if (roles && !roles.includes(session.role)) {
    return NextResponse.redirect(urlOnRequestHost(homeFor(session.role), request));
  }
  return NextResponse.next();
}

export const config = {
  // The library, readers, scanner and print pages are public; they check each book themselves.
  matcher: ["/admin/:path*", "/school/:path*", "/learn/:path*", "/account/:path*", "/login", "/join", "/signup"],
};
