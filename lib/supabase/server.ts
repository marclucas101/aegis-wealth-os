import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "./env";
import type { Database } from "./types";

/**
 * Server-side Supabase client (anon key).
 *
 * Use in Server Components, Route Handlers, and Server Actions when you need
 * a normal, RLS-respecting client on the server. Creates a fresh client per
 * call — no session persistence (auth not wired yet).
 *
 * Prefer this over client.ts for any server-rendered data fetching.
 * Use admin.ts only when RLS must be bypassed for trusted server work.
 */
export function createServerSupabaseClient(): SupabaseClient<Database> {
  const { url, anonKey } = getSupabasePublicEnv();

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
