import { NextResponse } from "next/server";

import { buildSetCookieHeader } from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * TEMPORARY DIAGNOSTIC — remove once production cookie storage is confirmed.
 *
 * Sets a plain non-sensitive first-party cookie with no Supabase involvement
 * and no redirect, to isolate browser/platform cookie storage from the
 * Supabase auth cookie flow. No auth required.
 */
export async function GET(): Promise<NextResponse> {
  const setCookie = buildSetCookieHeader("aegis-basic-cookie", "1", {
    maxAge: 3600,
  });

  const response = NextResponse.json(
    {
      ok: true,
      route: "set-basic-cookie",
      cookieName: "aegis-basic-cookie",
      cookieAttributes: setCookie.split(";").slice(1).join(";").trim(),
      note: "Now open /api/debug/auth-cookies and check basicCookiePresent.",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
  response.headers.append("Set-Cookie", setCookie);
  return response;
}
