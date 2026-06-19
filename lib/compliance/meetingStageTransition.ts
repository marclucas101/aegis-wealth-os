import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  dbLoadClientRelationshipStage,
  dbUpdateClientRelationshipStage,
} from "@/lib/supabase/compliancePublication";

import type { RelationshipStage } from "./types";

const STAGE_ORDER: RelationshipStage[] = [
  "prospect",
  "fact_find_complete",
  "adviser_review",
  "meeting_scheduled",
  "recommendation_prepared",
  "active_client",
  "inactive_client",
];

function stageIndex(stage: RelationshipStage): number {
  return STAGE_ORDER.indexOf(stage);
}

const ADVISER_REVIEW_STAGE: RelationshipStage = "adviser_review";

/**
 * On meeting completion, optionally advance meeting_scheduled or earlier
 * stages to adviser_review. Never regresses later stages or activates client.
 */
export async function maybeAdvanceStageOnMeetingCompletion(input: {
  clientId: string;
  actorUserId: string;
  currentStageAtStart: RelationshipStage | null;
}): Promise<{
  advanced: boolean;
  previousStage: RelationshipStage;
  newStage: RelationshipStage;
}> {
  const currentStage =
    input.currentStageAtStart ??
    (await dbLoadClientRelationshipStage(input.clientId));

  if (!currentStage) {
    throw new Error("Client not found");
  }

  if (
    currentStage === "active_client" ||
    currentStage === "inactive_client" ||
    currentStage === "recommendation_prepared"
  ) {
    return { advanced: false, previousStage: currentStage, newStage: currentStage };
  }

  const currentIdx = stageIndex(currentStage);
  const targetIdx = stageIndex(ADVISER_REVIEW_STAGE);

  if (currentIdx >= targetIdx) {
    return { advanced: false, previousStage: currentStage, newStage: currentStage };
  }

  await dbUpdateClientRelationshipStage(input.clientId, ADVISER_REVIEW_STAGE);

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.actorUserId,
    action: "relationship_stage_changed",
    entityType: "client",
    entityId: input.clientId,
    metadata: {
      oldStage: currentStage,
      newStage: ADVISER_REVIEW_STAGE,
      actorRole: "advisor",
      trigger: "meeting_completed",
    },
  });

  return {
    advanced: true,
    previousStage: currentStage,
    newStage: ADVISER_REVIEW_STAGE,
  };
}
