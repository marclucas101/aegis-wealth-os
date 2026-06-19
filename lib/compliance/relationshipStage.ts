import "server-only";

import type { ClientStatus } from "@/lib/supabase/userProfile";

import type { RelationshipStage } from "./types";

/** Stages an assigned adviser may advance (not promote to active_client). */
export const ADVISER_ADVANCEABLE_STAGES: readonly RelationshipStage[] = [
  "fact_find_complete",
  "adviser_review",
  "meeting_scheduled",
  "recommendation_prepared",
] as const;

/** Stages only admin may set directly. */
export const ADMIN_ONLY_STAGES: readonly RelationshipStage[] = [
  "active_client",
  "inactive_client",
] as const;

/**
 * Derives relationship stage from DB row.
 * Never trust browser-provided stages — always read from clients.relationship_stage.
 */
export function resolveRelationshipStage(client: {
  relationship_stage?: RelationshipStage | null;
  status?: ClientStatus;
}): RelationshipStage {
  if (client.relationship_stage) {
    return client.relationship_stage;
  }

  return mapLegacyClientStatus(client.status ?? "prospect");
}

export function mapLegacyClientStatus(status: ClientStatus): RelationshipStage {
  switch (status) {
    case "prospect":
      return "prospect";
    case "onboarding":
      return "fact_find_complete";
    case "active":
    case "review_due":
      return "active_client";
    case "archived":
      return "inactive_client";
    default:
      return "prospect";
  }
}

export function isProspectStage(stage: RelationshipStage): boolean {
  return (
    stage === "prospect" ||
    stage === "fact_find_complete" ||
    stage === "adviser_review" ||
    stage === "meeting_scheduled" ||
    stage === "recommendation_prepared"
  );
}

export function isActiveClientStage(stage: RelationshipStage): boolean {
  return stage === "active_client";
}

export function canAdviserSetStage(
  currentStage: RelationshipStage,
  nextStage: RelationshipStage,
): boolean {
  if (ADMIN_ONLY_STAGES.includes(nextStage)) {
    return false;
  }

  if (!ADVISER_ADVANCEABLE_STAGES.includes(nextStage)) {
    return false;
  }

  const order: RelationshipStage[] = [
    "prospect",
    "fact_find_complete",
    "adviser_review",
    "meeting_scheduled",
    "recommendation_prepared",
    "active_client",
    "inactive_client",
  ];

  const currentIdx = order.indexOf(currentStage);
  const nextIdx = order.indexOf(nextStage);

  return nextIdx >= currentIdx && nextIdx <= order.indexOf("recommendation_prepared");
}

export function canClientSelfPromote(_stage: RelationshipStage): boolean {
  void _stage;
  return false;
}
