import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabaseCookieOptions } from "./cookie-options";
import { getSupabasePublicEnv } from "./env";
import { sanitizeSupabaseCookieOptions } from "./set-cookie";
import type { Database } from "./types";

/**
 * Server-side Supabase client (anon key, cookie session).
 *
 * Use in Server Actions, Server Components, and Route Handlers that return
 * rendered output (not redirects). For redirect Route Handlers, use
 * route-handler.ts so Set-Cookie headers bind to the NextResponse.
 */
export async function createServerSupabaseClient(): Promise<
  SupabaseClient<Database>
> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookieOptions: getSupabaseCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options: CookieOptions;
        }[],
        headers: Record<string, string>,
      ) {
        void headers;
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(
              name,
              value,
              sanitizeSupabaseCookieOptions(options),
            );
          });
        } catch {
          // Server Components cannot mutate cookies; middleware handles refresh.
        }
      },
    },
  });
}
