import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/** Untyped admin client for Phase 09 tables pending generated Database types. */
export function createCrmAdvocacyAdmin(): SupabaseClient {
  return createAdminSupabaseClient() as unknown as SupabaseClient;
}
