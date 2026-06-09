import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "./env";
import type { Database } from "./types";

/**
 * Server-only admin Supabase client (service role key).
 *
 * Bypasses Row Level Security. Use only for trusted server-side operations
 * such as background jobs, seed scripts, or admin maintenance — never for
 * routine user-facing reads/writes once auth is enabled.
 *
 * NEVER import this module into Client Components or any code that runs in
 * the browser. The service role key must never be exposed client-side.
 */
export function createAdminSupabaseClient(): SupabaseClient<Database> {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
