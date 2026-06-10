import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabaseCookieOptions } from "./cookie-options";
import { getSupabasePublicEnv } from "./env";
import { applySupabaseSetCookies } from "./set-cookie";
import type { Database } from "./types";

/**
 * Supabase client for Route Handlers that mutate auth cookies on a concrete
 * NextResponse (redirects). Required so Set-Cookie headers are not dropped
 * when returning NextResponse.redirect() on Vercel.
 */
export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  response: NextResponse,
): SupabaseClient<Database> {
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        headers: Record<string, string>,
      ) {
        applySupabaseSetCookies(response, cookiesToSet, headers);
      },
    },
  });
}
