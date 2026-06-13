import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  isAdvisorRole,
  type AccessDeniedReason,
  requireAuthenticatedUser,
} from "./authGuards";
import type { AppUserRow } from "./userProfile";

export type AdvisorAccessDeniedReason = AccessDeniedReason;

export type RequireAdvisorAccessResult =
  | { allowed: false; reason: AdvisorAccessDeniedReason }
  | { allowed: true; authUser: User; user: AppUserRow };

/**
 * Server-side gate for Advisor OS routes and APIs.
 * Identity is derived from supabase.auth.getUser() — never from browser input.
 */
export async function requireAdvisorAccess(): Promise<RequireAdvisorAccessResult> {
  const auth = await requireAuthenticatedUser();

  if (!auth.authenticated) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (!isAdvisorRole(auth.user.role)) {
    return { allowed: false, reason: "forbidden" };
  }

  return { allowed: true, authUser: auth.authUser, user: auth.user };
}
