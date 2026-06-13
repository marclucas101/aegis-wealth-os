import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import type { UserRole } from "@/lib/roles";
import { isAdminRole, isAdvisorRole } from "@/lib/roles";

import { createAdminSupabaseClient } from "./admin";
import { createServerSupabaseClient } from "./server";
import type { AppUserRow } from "./userProfile";

export type AccessDeniedReason = "unauthenticated" | "forbidden";

export type RequireAuthenticatedUserResult =
  | { authenticated: false; reason: "unauthenticated" }
  | { authenticated: true; authUser: User; user: AppUserRow };

const loadAuthenticatedUser = cache(
  async (): Promise<RequireAuthenticatedUserResult> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return { authenticated: false, reason: "unauthenticated" };
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
    if (!userRow) {
      return { authenticated: false, reason: "unauthenticated" };
    }

    return { authenticated: true, authUser, user: userRow };
  },
);

/**
 * Validates the authenticated server session and loads the authoritative
 * public.users row. Never trusts role values from the browser.
 */
export async function requireAuthenticatedUser(): Promise<RequireAuthenticatedUserResult> {
  return loadAuthenticatedUser();
}

/**
 * Returns the current user's role from the database, or null when unauthenticated.
 */
export async function getCurrentUserRole(): Promise<UserRole | null> {
  const auth = await loadAuthenticatedUser();
  return auth.authenticated ? auth.user.role : null;
}

export { isAdminRole, isAdvisorRole };
