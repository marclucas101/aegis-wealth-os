import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getSupabaseCookieOptions } from "./cookie-options";
import { getSupabasePublicEnv } from "./env";
import type { Database } from "./types";

/**
 * Server-side Supabase client (anon key, cookie session).
 *
 * Use in Server Components, Route Handlers, and Server Actions when you need
 * a normal, RLS-respecting client with the current user's session.
 *
 * Prefer this over client.ts for any server-rendered data fetching.
 * Use admin.ts only when RLS must be bypassed for trusted server work.
 *
 * For Route Handlers that return redirects, use route-handler.ts instead so
 * auth cookies are written onto the outgoing NextResponse.
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
        _headers: Record<string, string>,
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot mutate cookies; middleware refreshes sessions.
        }
      },
    },
  });
}
