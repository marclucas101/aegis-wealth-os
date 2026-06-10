import { type NextRequest, NextResponse } from "next/server";

import { applySessionCookies, updateSession } from "@/lib/supabase/middleware";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/profile",
  "/discover",
  "/shield-diagnostic",
  "/stress-testing",
  "/roadmap",
  "/wealth-blueprint",
  "/annual-review",
  "/document-vault",
  "/advisor",
  "/admin",
] as const;

const AUTH_PAGES = ["/login", "/signup"] as const;

/** Auth handlers set cookies on their own response — skip middleware refresh. */
const AUTH_HANDLER_PREFIXES = [
  "/auth/login",
  "/auth/signup",
  "/auth/callback",
  "/logout",
] as const;

/** Debug routes must observe raw incoming cookies without mutation. */
const DEBUG_PREFIXES = ["/api/debug"] as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((page) => pathname === page);
}

function isAuthHandler(pathname: string): boolean {
  return AUTH_HANDLER_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isDebugRoute(pathname: string): boolean {
  return DEBUG_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAuthHandler(pathname) || isDebugRoute(pathname)) {
    return NextResponse.next();
  }

  const session = await updateSession(request);

  if (!session.user && isProtectedRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return applySessionCookies(
      session,
      NextResponse.redirect(loginUrl, { status: 303 }),
    );
  }

  if (session.user && isAuthPage(pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return applySessionCookies(
      session,
      NextResponse.redirect(dashboardUrl, { status: 303 }),
    );
  }

  return session.response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
