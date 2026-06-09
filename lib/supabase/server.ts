import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

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
 */
export async function createServerSupabaseClient(): Promise<
  SupabaseClient<Database>
> {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies cannot be set.
        }
      },
    },
  });
}
