import "server-only";

import type { User } from "@supabase/supabase-js";

import { createAdminSupabaseClient } from "./admin";
import { createServerSupabaseClient } from "./server";
import type { AppUserRow, UserRole } from "./userProfile";

export type AdvisorAccessDeniedReason = "unauthenticated" | "forbidden";

export type RequireAdvisorAccessResult =
  | { allowed: false; reason: AdvisorAccessDeniedReason }
  | { allowed: true; authUser: User; user: AppUserRow };

const ADVISOR_ROLES: UserRole[] = ["advisor", "admin"];

function isAdvisorRole(role: UserRole): boolean {
  return ADVISOR_ROLES.includes(role);
}

/**
 * Server-side gate for Advisor OS routes.
 * Identity is derived from supabase.auth.getUser() — never from browser input.
 * Advisor role assignment is currently managed manually in Supabase (public.users.role).
 */
export async function requireAdvisorAccess(): Promise<RequireAdvisorAccessResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return { allowed: false, reason: "unauthenticated" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user profile: ${error.message}`);
  }

  const userRow = data as AppUserRow | null;

  if (!userRow || !isAdvisorRole(userRow.role)) {
    return { allowed: false, reason: "forbidden" };
  }

  return { allowed: true, authUser, user: userRow };
}
