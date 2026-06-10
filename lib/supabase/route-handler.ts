import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";

import { getSupabaseCookieOptions } from "./cookie-options";
import { getSupabasePublicEnv } from "./env";
import { applySupabaseSetCookiesToHeaders } from "./set-cookie";
import type { Database } from "./types";

/**
 * Supabase client for auth Route Handlers.
 * Binds Set-Cookie writes to a mutable Headers bag (official @supabase/ssr pattern).
 */
export function createRouteHandlerSupabaseClient(
  request: NextRequest,
  responseHeaders: Headers,
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
        applySupabaseSetCookiesToHeaders(responseHeaders, cookiesToSet, headers);
      },
    },
  });
}
