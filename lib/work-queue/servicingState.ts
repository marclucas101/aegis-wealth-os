import type { ClientStatus, RelationshipStage } from "@/lib/supabase/userProfile";

export const CANONICAL_SERVICING_STATES = [
  "prospect",
  "onboarding",
  "active",
  "paused",
  "former",
  "unknown",
] as const;

export type CanonicalServicingState = (typeof CANONICAL_SERVICING_STATES)[number];

export type ServicingStateInput = {
  status: ClientStatus | string;
  relationshipStage: RelationshipStage | string;
};

export type ServicingStateResult = {
  canonical: CanonicalServicingState;
  conflict: boolean;
  rawStatus: string;
  rawRelationshipStage: string;
};

const PRE_ACTIVE_STAGES: readonly RelationshipStage[] = [
  "fact_find_complete",
  "adviser_review",
  "meeting_scheduled",
  "recommendation_prepared",
];

function isClientStatus(value: string): value is ClientStatus {
  return (
    value === "prospect" ||
    value === "onboarding" ||
    value === "active" ||
    value === "review_due" ||
    value === "archived"
  );
}

function isRelationshipStage(value: string): value is RelationshipStage {
  return (
    value === "prospect" ||
    value === "fact_find_complete" ||
    value === "adviser_review" ||
    value === "meeting_scheduled" ||
    value === "recommendation_prepared" ||
    value === "active_client" ||
    value === "inactive_client"
  );
}

/**
 * Maps legacy `clients.status` and `clients.relationship_stage` to one canonical
 * servicing state. Preserves raw values for diagnostics. Does not mutate source data.
 *
 * Precedence (first match wins unless conflict detected):
 * 1. archived status → former
 * 2. inactive_client stage → former (paused if status still active/review_due)
 * 3. prospect status or prospect stage → prospect (conflict if stage is active_client)
 * 4. onboarding status or pre-active stages → onboarding
 * 5. active / review_due status or active_client stage → active
 * 6. otherwise → unknown
 */
export function resolveCanonicalServicingState(
  input: ServicingStateInput,
): ServicingStateResult {
  const rawStatus = String(input.status ?? "");
  const rawRelationshipStage = String(input.relationshipStage ?? "");

  const statusKnown = isClientStatus(rawStatus);
  const stageKnown = isRelationshipStage(rawRelationshipStage);

  let conflict = false;

  if (rawStatus === "archived") {
    if (rawRelationshipStage === "active_client") conflict = true;
    return {
      canonical: "former",
      conflict,
      rawStatus,
      rawRelationshipStage,
    };
  }

  if (rawRelationshipStage === "inactive_client") {
    if (rawStatus === "active" || rawStatus === "review_due") {
      return {
        canonical: "paused",
        conflict: true,
        rawStatus,
        rawRelationshipStage,
      };
    }
    return {
      canonical: "former",
      conflict: false,
      rawStatus,
      rawRelationshipStage,
    };
  }

  const statusIsProspect = rawStatus === "prospect";
  const stageIsProspect = rawRelationshipStage === "prospect";
  if (statusIsProspect || stageIsProspect) {
    if (rawRelationshipStage === "active_client" || rawStatus === "active") {
      conflict = true;
      return {
        canonical: "unknown",
        conflict,
        rawStatus,
        rawRelationshipStage,
      };
    }
    return {
      canonical: "prospect",
      conflict: statusIsProspect !== stageIsProspect && stageKnown && statusKnown,
      rawStatus,
      rawRelationshipStage,
    };
  }

  const statusIsOnboarding = rawStatus === "onboarding";
  const stageIsPreActive =
    stageKnown && PRE_ACTIVE_STAGES.includes(rawRelationshipStage as RelationshipStage);
  if (statusIsOnboarding || stageIsPreActive) {
    if (rawRelationshipStage === "active_client" && rawStatus !== "onboarding") {
      conflict = true;
    }
    return {
      canonical: "onboarding",
      conflict,
      rawStatus,
      rawRelationshipStage,
    };
  }

  const statusIsActiveServicing =
    rawStatus === "active" || rawStatus === "review_due";
  const stageIsActive = rawRelationshipStage === "active_client";
  if (statusIsActiveServicing || stageIsActive) {
    if (
      (statusIsActiveServicing && stageKnown && !stageIsActive && rawRelationshipStage !== "prospect") ||
      (stageIsActive && statusKnown && rawStatus === "prospect")
    ) {
      conflict = true;
      return {
        canonical: "unknown",
        conflict,
        rawStatus,
        rawRelationshipStage,
      };
    }
    return {
      canonical: "active",
      conflict: false,
      rawStatus,
      rawRelationshipStage,
    };
  }

  if (!statusKnown || !stageKnown) {
    return {
      canonical: "unknown",
      conflict: true,
      rawStatus,
      rawRelationshipStage,
    };
  }

  return {
    canonical: "unknown",
    conflict: true,
    rawStatus,
    rawRelationshipStage,
  };
}

/** Whether review-due queue items may be generated for this canonical state. */
export function isReviewQueueEligible(canonical: CanonicalServicingState): boolean {
  return canonical === "active" || canonical === "onboarding";
}
