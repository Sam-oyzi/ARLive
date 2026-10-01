import { NextResponse, type NextRequest } from "next/server";
import { urlOnRequestHost } from "@/lib/request-url";
import { SESSION_COOKIE } from "@/lib/session";

// Clears a session whose user was deleted or disabled (see requireUser) without looping through the proxy.
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(urlOnRequestHost("/login", request));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
