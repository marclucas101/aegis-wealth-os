import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  CRM_V2_MASTER_FEATURE_KEY,
  CRM_V2_PILOT_MODE_FEATURE_KEY,
} from "@/lib/crm-v2/constants";
import {
  isUserInPilotAllowlist,
  parsePilotAllowlistFromEnv,
} from "@/lib/crm-v2/pilotConfig";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import type { AppUserRow } from "@/lib/supabase/userProfile";

export type CrmV2AccessDeniedReason =
  | "unauthenticated"
  | "forbidden"
  | "feature_disabled"
  | "pilot_mode_disabled"
  | "pilot_not_eligible";

export type CrmV2AccessResult =
  | { allowed: false; reason: CrmV2AccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
    };

function createShellRequestId(): string {
  return `crm2_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Central server-side gate for all Adviser CRM V2 routes and shell APIs.
 * Fail-closed; does not disclose pilot configuration or allowlist contents.
 */
export async function assertCrmV2Access(): Promise<CrmV2AccessResult> {
  const requestId = createShellRequestId();

  const adviserAccess = await requireAdvisorAccess();
  if (!adviserAccess.allowed) {
    return {
      allowed: false,
      reason:
        adviserAccess.reason === "unauthenticated"
          ? "unauthenticated"
          : "forbidden",
      requestId,
    };
  }

  const masterEnabled = await isFeatureEnabled(CRM_V2_MASTER_FEATURE_KEY);
  if (!masterEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId };
  }

  const pilotModeEnabled = await isFeatureEnabled(CRM_V2_PILOT_MODE_FEATURE_KEY);
  if (!pilotModeEnabled) {
    return { allowed: false, reason: "pilot_mode_disabled", requestId };
  }

  const allowlist = parsePilotAllowlistFromEnv();
  if (!allowlist.ok) {
    return { allowed: false, reason: "pilot_not_eligible", requestId };
  }

  if (!isUserInPilotAllowlist(adviserAccess.authUser.id, allowlist.userIds)) {
    return { allowed: false, reason: "pilot_not_eligible", requestId };
  }

  return {
    allowed: true,
    authUser: adviserAccess.authUser,
    user: adviserAccess.user,
    requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
  };
}
