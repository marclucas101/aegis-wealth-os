import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY,
  CRM_V2_APPOINTMENTS_CLIENT_FEATURE_KEY,
  CRM_V2_MASTER_FEATURE_KEY,
  CRM_V2_PILOT_MODE_FEATURE_KEY,
  CRM_V2_RELATIONSHIPS_FEATURE_KEY,
} from "@/lib/crm-v2/constants";
import { loadFeatureControls } from "@/lib/compliance/featureFlags";
import {
  isUserInPilotAllowlist,
  parsePilotAllowlistFromEnv,
} from "@/lib/crm-v2/pilotConfig";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { ensureUserClientProfile, type AppClientRow } from "@/lib/supabase/userProfile";
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

export type CrmV2RelationshipsAccessDeniedReason = CrmV2AccessDeniedReason;

export type CrmV2RelationshipsAccessResult =
  | { allowed: false; reason: CrmV2RelationshipsAccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      relationshipsEnabled: true;
    };

/**
 * Central gate for CRM V2 relationship list and Relationship 360.
 * Requires master + pilot gates; does not bypass them.
 */
export async function assertCrmV2RelationshipsAccess(): Promise<CrmV2RelationshipsAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const relationshipsEnabled = await isFeatureEnabled(CRM_V2_RELATIONSHIPS_FEATURE_KEY);
  if (!relationshipsEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    relationshipsEnabled: true,
  };
}

export type CrmV2AppointmentsAccessDeniedReason = CrmV2AccessDeniedReason;

export type CrmV2AppointmentsAccessResult =
  | { allowed: false; reason: CrmV2AppointmentsAccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      appointmentsEnabled: true;
    };

/**
 * Central gate for CRM V2 adviser appointment workflow.
 * Requires master + pilot gates; does not bypass them.
 */
export async function assertCrmV2AppointmentsAccess(): Promise<CrmV2AppointmentsAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const appointmentsEnabled = await isFeatureEnabled(
    CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY,
  );
  if (!appointmentsEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    appointmentsEnabled: true,
  };
}

export type CrmV2ClientAppointmentsAccessResult =
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "feature_disabled"; requestId: string }
  | {
      allowed: true;
      requestId: string;
      authUserId: string;
      user: AppUserRow;
      client: AppClientRow;
      appointmentsClientEnabled: true;
    };

/**
 * Central gate for CRM V2 client appointment collaboration.
 * Server-derived client identity only; fail-closed on flag visibility.
 */
export async function assertCrmV2ClientAppointmentsAccess(): Promise<CrmV2ClientAppointmentsAccessResult> {
  const requestId = createShellRequestId();
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { allowed: false, reason: "unauthenticated", requestId };
  }

  if (session.user.role !== "client") {
    return { allowed: false, reason: "forbidden", requestId };
  }

  const controls = await loadFeatureControls();
  const row = controls.get(CRM_V2_APPOINTMENTS_CLIENT_FEATURE_KEY);
  if (!row?.enabled || !row.client_visible) {
    return { allowed: false, reason: "feature_disabled", requestId };
  }

  return {
    allowed: true,
    requestId,
    authUserId: session.authUser.id,
    user: session.user,
    client: session.client,
    appointmentsClientEnabled: true,
  };
}
