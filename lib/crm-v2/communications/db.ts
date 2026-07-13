import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/** Untyped admin client for Phase 10 tables pending generated Database types. */
export function createCrmCommunicationsAdmin(): SupabaseClient {
  return createAdminSupabaseClient() as unknown as SupabaseClient;
}
