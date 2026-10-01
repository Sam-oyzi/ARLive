import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { urlOnRequestHost } from "@/lib/request-url";
import type { Role } from "@/lib/roles";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifyHandoff } from "@/lib/session";

// Landing point of the "continue on your phone" QR code: signs the phone in, then opens the page.
export async function GET(request: NextRequest) {
  const handoff = await verifyHandoff(request.nextUrl.searchParams.get("t"));
  if (!handoff) return NextResponse.redirect(urlOnRequestHost("/login", request));

  const user = await db.user.findUnique({ where: { id: handoff.uid }, include: { school: true } });
  if (!user?.active || (user.school && !user.school.active && user.role !== "SUPER_ADMIN")) {
    return NextResponse.redirect(urlOnRequestHost("/login", request));
  }

  const path = handoff.path.startsWith("/") && !handoff.path.startsWith("//") ? handoff.path : "/";
  const response = NextResponse.redirect(urlOnRequestHost(path, request));
  response.cookies.set(SESSION_COOKIE, await signSession({ uid: user.id, role: user.role as Role, schoolId: user.schoolId }), {
    httpOnly: true,
    secure: urlOnRequestHost("/", request).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
