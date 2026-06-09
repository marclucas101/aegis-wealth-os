import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "./env";
import type { Database } from "./types";

/**
 * Browser / Client Component Supabase client.
 *
 * Use in files marked `'use client'` when you need to query Supabase from the
 * browser. Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * so it is safe to bundle for the client. All queries are subject to RLS.
 *
 * Do not use for privileged operations — use server.ts or admin.ts instead.
 */
let browserClient: SupabaseClient<Database> | undefined;

export function createBrowserSupabaseClient(): SupabaseClient<Database> {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabasePublicEnv();
  browserClient = createClient<Database>(url, anonKey);
  return browserClient;
}
