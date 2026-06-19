import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";
import { dbLoadClientRelationshipStage, dbUpdateClientRelationshipStage } from "@/lib/supabase/compliancePublication";

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

const MEETING_SCHEDULED_STAGE: RelationshipStage = "meeting_scheduled";

function stageIndex(stage: RelationshipStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function shouldAdvanceToMeetingScheduled(
  currentStage: RelationshipStage,
): boolean {
  if (currentStage === "inactive_client" || currentStage === "active_client") {
    return false;
  }
  return stageIndex(currentStage) < stageIndex(MEETING_SCHEDULED_STAGE);
}

export type MeetingStageAdvanceResult = {
  advanced: boolean;
  previousStage: RelationshipStage;
  newStage: RelationshipStage;
};

/**
 * Server-side only. Advances prospect workflow to meeting_scheduled when an
 * upcoming appointment is created. Never regresses later stages.
 */
export async function maybeAdvanceRelationshipStageForAppointment(input: {
  clientId: string;
  actorUserId: string;
  trigger: "client_booking" | "adviser_created_appointment";
  appointmentId?: string | null;
}): Promise<MeetingStageAdvanceResult> {
  const currentStage = await dbLoadClientRelationshipStage(input.clientId);
  if (!currentStage) {
    throw new Error("Client not found");
  }

  if (!shouldAdvanceToMeetingScheduled(currentStage)) {
    return {
      advanced: false,
      previousStage: currentStage,
      newStage: currentStage,
    };
  }

  await dbUpdateClientRelationshipStage(input.clientId, MEETING_SCHEDULED_STAGE);

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.actorUserId,
    action: "relationship_stage_changed",
    entityType: "client",
    entityId: input.clientId,
    metadata: {
      oldStage: currentStage,
      newStage: MEETING_SCHEDULED_STAGE,
      actorRole: "system",
      trigger: input.trigger,
      appointmentId: input.appointmentId ?? null,
    },
  });

  return {
    advanced: true,
    previousStage: currentStage,
    newStage: MEETING_SCHEDULED_STAGE,
  };
}
