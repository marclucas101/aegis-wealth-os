import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY,
  CRM_V2_APPOINTMENTS_CLIENT_FEATURE_KEY,
  CRM_V2_GOOGLE_CALENDAR_FEATURE_KEY,
  CRM_V2_MASTER_FEATURE_KEY,
  CRM_V2_PILOT_MODE_FEATURE_KEY,
  CRM_V2_RELATIONSHIPS_FEATURE_KEY,
  CRM_V2_SERVICE_FEATURE_KEY,
  CRM_V2_CLIENT_SERVICE_FEATURE_KEY,
  CRM_V2_PROTECTION_PORTFOLIO_FEATURE_KEY,
  CRM_V2_RELATIONSHIP_MOMENTS_FEATURE_KEY,
  CRM_V2_CLIENT_PROFILE_FEATURE_KEY,
  CRM_V2_ADVOCACY_FEATURE_KEY,
  CRM_V2_COMMUNICATIONS_FEATURE_KEY,
  CRM_V2_TODAY_FEATURE_KEY,
  CRM_V2_REPORTS_FEATURE_KEY,
  CRM_V2_OPERATIONS_FEATURE_KEY,
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

export type CrmV2GoogleCalendarAccessDeniedReason = CrmV2AccessDeniedReason;

export type CrmV2GoogleCalendarAccessResult =
  | { allowed: false; reason: CrmV2GoogleCalendarAccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      appointmentsEnabled: true;
      googleCalendarEnabled: true;
    };

/**
 * Central gate for CRM V2 Google Calendar operations.
 * Requires master + pilot + adviser appointments + google calendar flags.
 */
export async function assertCrmV2GoogleCalendarAccess(): Promise<CrmV2GoogleCalendarAccessResult> {
  const appointments = await assertCrmV2AppointmentsAccess();
  if (!appointments.allowed) {
    return {
      allowed: false,
      reason: appointments.reason,
      requestId: appointments.requestId,
    };
  }

  const googleCalendarEnabled = await isFeatureEnabled(
    CRM_V2_GOOGLE_CALENDAR_FEATURE_KEY,
  );
  if (!googleCalendarEnabled) {
    return {
      allowed: false,
      reason: "feature_disabled",
      requestId: appointments.requestId,
    };
  }

  return {
    allowed: true,
    authUser: appointments.authUser,
    user: appointments.user,
    requestId: appointments.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    appointmentsEnabled: true,
    googleCalendarEnabled: true,
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

export type CrmV2ServiceAccessResult =
  | { allowed: false; reason: CrmV2AccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      serviceEnabled: true;
    };

/**
 * Central gate for CRM V2 adviser Service workspace.
 * Requires master + pilot gates; does not bypass them.
 */
export async function assertCrmV2ServiceAccess(): Promise<CrmV2ServiceAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const serviceEnabled = await isFeatureEnabled(CRM_V2_SERVICE_FEATURE_KEY);
  if (!serviceEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    serviceEnabled: true,
  };
}

export type CrmV2ClientServiceAccessResult =
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "feature_disabled"; requestId: string }
  | {
      allowed: true;
      requestId: string;
      authUserId: string;
      user: AppUserRow;
      client: AppClientRow;
      clientServiceEnabled: true;
    };

/**
 * Central gate for CRM V2 client Actions and service requests.
 * Server-derived client identity only; fail-closed on flag visibility.
 */
export async function assertCrmV2ClientServiceAccess(): Promise<CrmV2ClientServiceAccessResult> {
  const requestId = createShellRequestId();
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { allowed: false, reason: "unauthenticated", requestId };
  }

  if (session.user.role !== "client") {
    return { allowed: false, reason: "forbidden", requestId };
  }

  const controls = await loadFeatureControls();
  const row = controls.get(CRM_V2_CLIENT_SERVICE_FEATURE_KEY);
  if (!row?.enabled || !row.client_visible) {
    return { allowed: false, reason: "feature_disabled", requestId };
  }

  return {
    allowed: true,
    requestId,
    authUserId: session.authUser.id,
    user: session.user,
    client: session.client,
    clientServiceEnabled: true,
  };
}

export type CrmV2ProtectionPortfolioAccessResult =
  | { allowed: false; reason: CrmV2AccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      protectionPortfolioEnabled: true;
    };

/**
 * Central gate for CRM V2 adviser protection portfolio and verification.
 * Requires master + pilot gates; does not bypass them.
 */
export async function assertCrmV2ProtectionPortfolioAccess(): Promise<CrmV2ProtectionPortfolioAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const protectionEnabled = await isFeatureEnabled(CRM_V2_PROTECTION_PORTFOLIO_FEATURE_KEY);
  if (!protectionEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    protectionPortfolioEnabled: true,
  };
}

export type CrmV2ClientProtectionAccessResult =
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "feature_disabled"; requestId: string }
  | {
      allowed: true;
      requestId: string;
      authUserId: string;
      user: AppUserRow;
      client: AppClientRow;
      clientProtectionEnabled: true;
    };

/**
 * Central gate for CRM V2 client protection summary.
 * Server-derived client identity only; fail-closed on flag visibility.
 */
export async function assertCrmV2ClientProtectionAccess(): Promise<CrmV2ClientProtectionAccessResult> {
  const requestId = createShellRequestId();
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { allowed: false, reason: "unauthenticated", requestId };
  }

  if (session.user.role !== "client") {
    return { allowed: false, reason: "forbidden", requestId };
  }

  const controls = await loadFeatureControls();
  const row = controls.get(CRM_V2_PROTECTION_PORTFOLIO_FEATURE_KEY);
  if (!row?.enabled || !row.client_visible) {
    return { allowed: false, reason: "feature_disabled", requestId };
  }

  return {
    allowed: true,
    requestId,
    authUserId: session.authUser.id,
    user: session.user,
    client: session.client,
    clientProtectionEnabled: true,
  };
}

export type CrmV2RelationshipMomentsAccessResult =
  | { allowed: false; reason: CrmV2AccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      relationshipMomentsEnabled: true;
    };

/**
 * Central gate for CRM V2 adviser relationship moments workspace.
 * Requires master + pilot gates; does not bypass them.
 */
export async function assertCrmV2RelationshipMomentsAccess(): Promise<CrmV2RelationshipMomentsAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const momentsEnabled = await isFeatureEnabled(CRM_V2_RELATIONSHIP_MOMENTS_FEATURE_KEY);
  if (!momentsEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    relationshipMomentsEnabled: true,
  };
}

export type CrmV2ClientProfileAccessResult =
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "feature_disabled"; requestId: string }
  | {
      allowed: true;
      requestId: string;
      authUserId: string;
      user: AppUserRow;
      client: AppClientRow;
      clientProfileEnabled: true;
    };

/**
 * Central gate for CRM V2 client relationship preferences.
 * Server-derived client identity only; fail-closed on flag visibility.
 */
export async function assertCrmV2ClientProfileAccess(): Promise<CrmV2ClientProfileAccessResult> {
  const requestId = createShellRequestId();
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { allowed: false, reason: "unauthenticated", requestId };
  }

  if (session.user.role !== "client") {
    return { allowed: false, reason: "forbidden", requestId };
  }

  const controls = await loadFeatureControls();
  const row = controls.get(CRM_V2_CLIENT_PROFILE_FEATURE_KEY);
  if (!row?.enabled || !row.client_visible) {
    return { allowed: false, reason: "feature_disabled", requestId };
  }

  return {
    allowed: true,
    requestId,
    authUserId: session.authUser.id,
    user: session.user,
    client: session.client,
    clientProfileEnabled: true,
  };
}

export type CrmV2AdvocacyAccessResult =
  | { allowed: false; reason: CrmV2AccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      advocacyEnabled: true;
    };

/**
 * Central gate for CRM V2 adviser advocacy workspace.
 * Requires master + pilot gates; does not bypass them.
 */
export async function assertCrmV2AdvocacyAccess(): Promise<CrmV2AdvocacyAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const advocacyEnabled = await isFeatureEnabled(CRM_V2_ADVOCACY_FEATURE_KEY);
  if (!advocacyEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    advocacyEnabled: true,
  };
}

export type CrmV2ClientAdvocacyAccessResult =
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "feature_disabled"; requestId: string }
  | {
      allowed: true;
      requestId: string;
      authUserId: string;
      user: AppUserRow;
      client: AppClientRow;
      clientAdvocacyEnabled: true;
    };

/**
 * Central gate for CRM V2 client advocacy preferences.
 * Server-derived client identity only; fail-closed on flag visibility.
 * Client control cannot grant adviser CRM access.
 */
export async function assertCrmV2ClientAdvocacyAccess(): Promise<CrmV2ClientAdvocacyAccessResult> {
  const requestId = createShellRequestId();
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { allowed: false, reason: "unauthenticated", requestId };
  }

  if (session.user.role !== "client") {
    return { allowed: false, reason: "forbidden", requestId };
  }

  const controls = await loadFeatureControls();
  const row = controls.get(CRM_V2_ADVOCACY_FEATURE_KEY);
  if (!row?.enabled || !row.client_visible) {
    return { allowed: false, reason: "feature_disabled", requestId };
  }

  return {
    allowed: true,
    requestId,
    authUserId: session.authUser.id,
    user: session.user,
    client: session.client,
    clientAdvocacyEnabled: true,
  };
}

export type CrmV2CommunicationsAccessResult =
  | { allowed: false; reason: CrmV2AccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      communicationsEnabled: true;
    };

/**
 * Central gate for CRM V2 adviser communications workspace.
 * Requires master + pilot gates; does not bypass them.
 */
export async function assertCrmV2CommunicationsAccess(): Promise<CrmV2CommunicationsAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const communicationsEnabled = await isFeatureEnabled(CRM_V2_COMMUNICATIONS_FEATURE_KEY);
  if (!communicationsEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    communicationsEnabled: true,
  };
}

export type CrmV2ClientMessagesAccessResult =
  | { allowed: false; reason: "unauthenticated" | "forbidden" | "feature_disabled"; requestId: string }
  | {
      allowed: true;
      requestId: string;
      authUserId: string;
      user: AppUserRow;
      client: AppClientRow;
      clientMessagesEnabled: true;
    };

/**
 * Central gate for CRM V2 client messages inbox.
 * Server-derived client identity only; fail-closed on flag visibility.
 * Client control cannot grant adviser CRM access.
 */
export type CrmV2TodayAccessResult =
  | { allowed: false; reason: CrmV2AccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      todayEnabled: true;
    };

/**
 * Central gate for CRM V2 Today workspace.
 * Requires master + pilot gates; adviser-only; does not bypass them.
 */
export async function assertCrmV2TodayAccess(): Promise<CrmV2TodayAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const todayEnabled = await isFeatureEnabled(CRM_V2_TODAY_FEATURE_KEY);
  if (!todayEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    todayEnabled: true,
  };
}

export type CrmV2ReportsAccessDeniedReason = CrmV2AccessDeniedReason;

export type CrmV2ReportsAccessResult =
  | { allowed: false; reason: CrmV2ReportsAccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      reportsEnabled: true;
    };

/**
 * Central gate for CRM V2 adviser reports. Adviser-scoped; admin book-wide deferred in projection.
 */
export async function assertCrmV2ReportsAccess(): Promise<CrmV2ReportsAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const reportsEnabled = await isFeatureEnabled(CRM_V2_REPORTS_FEATURE_KEY);
  if (!reportsEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    reportsEnabled: true,
  };
}

export type CrmV2OperationsAccessDeniedReason = CrmV2AccessDeniedReason;

export type CrmV2OperationsAccessResult =
  | { allowed: false; reason: CrmV2OperationsAccessDeniedReason; requestId: string }
  | {
      allowed: true;
      authUser: User;
      user: AppUserRow;
      requestId: string;
      masterEnabled: true;
      pilotModeEnabled: true;
      operationsEnabled: true;
    };

/**
 * Central gate for CRM V2 operations diagnostics. Adviser and admin roles via requireAdvisorAccess.
 */
export async function assertCrmV2OperationsAccess(): Promise<CrmV2OperationsAccessResult> {
  const base = await assertCrmV2Access();
  if (!base.allowed) {
    return { allowed: false, reason: base.reason, requestId: base.requestId };
  }

  const operationsEnabled = await isFeatureEnabled(CRM_V2_OPERATIONS_FEATURE_KEY);
  if (!operationsEnabled) {
    return { allowed: false, reason: "feature_disabled", requestId: base.requestId };
  }

  return {
    allowed: true,
    authUser: base.authUser,
    user: base.user,
    requestId: base.requestId,
    masterEnabled: true,
    pilotModeEnabled: true,
    operationsEnabled: true,
  };
}

export async function assertCrmV2ClientMessagesAccess(): Promise<CrmV2ClientMessagesAccessResult> {
  const requestId = createShellRequestId();
  const session = await ensureUserClientProfile();
  if (!session.authenticated) {
    return { allowed: false, reason: "unauthenticated", requestId };
  }

  if (session.user.role !== "client") {
    return { allowed: false, reason: "forbidden", requestId };
  }

  const controls = await loadFeatureControls();
  const row = controls.get(CRM_V2_COMMUNICATIONS_FEATURE_KEY);
  if (!row?.enabled || !row.client_visible) {
    return { allowed: false, reason: "feature_disabled", requestId };
  }

  return {
    allowed: true,
    requestId,
    authUserId: session.authUser.id,
    user: session.user,
    client: session.client,
    clientMessagesEnabled: true,
  };
}
