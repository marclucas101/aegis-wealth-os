import "server-only";

import type { DashboardSnapshot } from "@/lib/supabase/dashboardQueries";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";
import { writeAuditLog } from "@/lib/supabase/auditLog";

import {
  wrapClientSafeResponse,
  type ClientSafeEnvelope,
  type ClientSafeFinancialReadinessSnapshot,
} from "./clientSafeDtos";
import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "./entitlements";
import { resolveFallbackState } from "./fallbackStates";
import { isFeatureEnabled } from "./featureFlags";
import {
  loadCurrentPublishedOutput,
  parsePublishedSafePayload,
} from "./publicationWorkflow";
import { resolveRelationshipStage } from "./relationshipStage";

export type ClientFinancialAccessResult =
  | {
      allowed: false;
      status: 403 | 503;
      reason: string;
    }
  | {
      allowed: true;
      envelope: ClientSafeEnvelope<ClientSafeFinancialReadinessSnapshot | null>;
    };

/**
 * Resolves client-facing dashboard / financial readiness access.
 * Never returns raw DashboardSnapshot to client role.
 */
export async function resolveClientFinancialReadinessAccess(input: {
  user: AppUserRow;
  client: AppClientRow;
}): Promise<ClientFinancialAccessResult> {
  const ctx = await getUserExperienceContext(input);

  if (input.user.role !== "client") {
    return {
      allowed: false,
      status: 403,
      reason: "Use adviser APIs for internal client analysis",
    };
  }

  const stage = resolveRelationshipStage(
    input.client as AppClientRow & { relationship_stage?: string },
  );
  const isProspect =
    stage === "prospect" ||
    stage === "fact_find_complete" ||
    stage === "adviser_review" ||
    stage === "meeting_scheduled" ||
    stage === "recommendation_prepared";

  const featureKey = isProspect
    ? "prospect_readiness_snapshot"
    : "client_published_financial_overview";

  const featureEnabled = await isFeatureEnabled(featureKey);
  if (!featureEnabled) {
    const fallback = resolveFallbackState({
      stage,
      hasDiscoverData: false,
      hasAssignedAdviser: Boolean(input.client.advisor_user_id),
      hasPublishedSummary: false,
      featureDisabled: true,
    });
    return {
      allowed: true,
      envelope: wrapClientSafeResponse("financial_readiness_snapshot", null, {
        accessMode: "fallback",
        fallbackReason: fallback.reason,
        fallbackMessage: fallback.message,
      }),
    };
  }

  const canAccess = await canAccessClientFeature(
    ctx,
    isProspect ? "financial_readiness_snapshot" : "financial_overview",
  );

  if (!canAccess) {
    return {
      allowed: false,
      status: 403,
      reason: "Feature not entitled for current relationship stage",
    };
  }

  const discover = await loadCurrentDiscoverProfile(input.client.id);
  const hasDiscoverData = Boolean(discover?.formData);

  const outputType = isProspect
    ? "financial_readiness_snapshot"
    : "financial_overview";

  const published = await loadCurrentPublishedOutput(
    input.client.id,
    outputType,
    "client_published",
  );

  if (published) {
    await writeAuditLog({
      clientId: input.client.id,
      userId: input.user.id,
      action: "client_viewed_published_output",
      entityType: "published_output",
      entityId: published.id,
      metadata: { outputType },
    });

    return {
      allowed: true,
      envelope: wrapClientSafeResponse(
        outputType,
        parsePublishedSafePayload(published),
        {
          accessMode: "published",
          publishedAt: published.published_at,
        },
      ),
    };
  }

  const fallback = resolveFallbackState({
    stage,
    hasDiscoverData,
    hasAssignedAdviser: Boolean(input.client.advisor_user_id),
    hasPublishedSummary: false,
  });

  return {
    allowed: true,
    envelope: wrapClientSafeResponse(outputType, null, {
      accessMode: "fallback",
      fallbackReason: fallback.reason,
      fallbackMessage: fallback.message,
    }),
  };
}

/** Guard for red-tier client APIs (shield, stress, roadmap, etc.). */
export async function resolveRestrictedClientModuleAccess(input: {
  user: AppUserRow;
  client: AppClientRow;
  feature:
    | "shield_diagnostic"
    | "stress_testing"
    | "roadmap"
    | "goals_and_reviews"
    | "wealth_blueprint";
}): Promise<{ allowed: boolean; reason?: string }> {
  if (input.user.role !== "client") {
    return { allowed: false, reason: "Use adviser APIs for internal analysis" };
  }

  const rawEnabled = await isFeatureEnabled("raw_client_financial_views");
  if (!rawEnabled) {
    return {
      allowed: false,
      reason: "Module requires adviser-reviewed publication",
    };
  }

  const ctx = await getUserExperienceContext(input);
  const map: Record<string, "shield_diagnostic" | "stress_testing" | "roadmap" | "goals_and_reviews" | "my_plan"> = {
    shield_diagnostic: "shield_diagnostic",
    stress_testing: "stress_testing",
    roadmap: "roadmap",
    goals_and_reviews: "goals_and_reviews",
    wealth_blueprint: "my_plan",
  };

  const feature = map[input.feature];
  const allowed = await canAccessClientFeature(ctx, feature);
  return allowed
    ? { allowed: true }
    : { allowed: false, reason: "Feature not entitled" };
}

export type InternalAnalysisAuditContext = {
  clientId: string;
  adviserUserId: string;
  action: "adviser_viewed_internal_analysis";
  module: string;
};

export async function auditAdviserInternalAnalysisView(
  ctx: InternalAnalysisAuditContext,
): Promise<void> {
  await writeAuditLog({
    clientId: ctx.clientId,
    userId: ctx.adviserUserId,
    action: ctx.action,
    entityType: "client_analysis",
    entityId: ctx.clientId,
    metadata: { module: ctx.module },
  });
}

/** Type guard — ensures response never contains raw dashboard fields. */
export function assertNotRawDashboardPayload(
  payload: Record<string, unknown>,
): void {
  const forbidden = [
    "shield",
    "stressTests",
    "roadmap",
    "protectionCore",
    "awri",
    "benchmark",
    "projected",
    "client",
    "discoverScore",
  ];
  for (const key of forbidden) {
    if (key in payload) {
      throw new Error(
        `Raw internal field "${key}" must not be exposed on client API`,
      );
    }
  }
}

export type { DashboardSnapshot };
