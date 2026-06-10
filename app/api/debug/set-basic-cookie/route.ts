import { NextResponse } from "next/server";

import { buildSetCookieHeader } from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * TEMPORARY DIAGNOSTIC — remove once production cookie storage is confirmed.
 *
 * Sets three plain non-sensitive first-party cookies with no Supabase
 * involvement, no redirect, and no auth, to isolate WHY the real auth cookie
 * is not stored while small cookies are:
 *
 * - aegis-basic-cookie: tiny control cookie
 * - aegis-big-cookie:   ~2700-char value, same size class as the real
 *                       sb-*-auth-token cookie (tests size-based filtering)
 * - sb-size-probe:      tiny cookie with an sb- name prefix (tests name-based
 *                       filtering; ignored by Supabase, which only reads its
 *                       own sb-<ref>-auth-token storage key)
 */
export async function GET(): Promise<NextResponse> {
  const setCookies = [
    buildSetCookieHeader("aegis-basic-cookie", "1", { maxAge: 3600 }),
    buildSetCookieHeader("aegis-big-cookie", "x".repeat(2700), {
      maxAge: 3600,
    }),
    buildSetCookieHeader("sb-size-probe", "1", { maxAge: 3600 }),
  ];

  const response = NextResponse.json(
    {
      ok: true,
      route: "set-basic-cookie",
      cookiesSet: setCookies.map((header) => ({
        name: header.slice(0, header.indexOf("=")),
        attributes: header.split(";").slice(1).join(";").trim(),
        approximateValueLength: header.split(";")[0]!.length,
      })),
      note: "Now open /api/debug/auth-cookies and check the *Present flags.",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
  for (const header of setCookies) {
    response.headers.append("Set-Cookie", header);
  }
  return response;
}
