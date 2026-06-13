import { type NextRequest } from "next/server";

import { blockDebugRouteInProduction } from "@/lib/security/debugRouteGuard";
import { buildSetCookieHeader } from "@/lib/supabase/set-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY DIAGNOSTIC — remove once production cookie storage is confirmed.
 *
 * Sets the same plain cookie as /api/debug/set-basic-cookie but responds with
 * a 303 redirect (mirroring the /auth/login response shape) to verify cookies
 * survive a redirect response in the browser. No Supabase, no auth required.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const blocked = blockDebugRouteInProduction();
  if (blocked) {
    return blocked;
  }

  const headers = new Headers();
  headers.append(
    "Set-Cookie",
    buildSetCookieHeader("aegis-basic-cookie", "1", { maxAge: 3600 }),
  );
  headers.append(
    "Set-Cookie",
    buildSetCookieHeader("aegis-big-cookie", "x".repeat(2700), {
      maxAge: 3600,
    }),
  );
  headers.append(
    "Set-Cookie",
    buildSetCookieHeader("sb-size-probe", "1", { maxAge: 3600 }),
  );
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set(
    "Location",
    new URL("/api/debug/auth-cookies", request.url).toString(),
  );

  return new Response(null, { status: 303, headers });
}
