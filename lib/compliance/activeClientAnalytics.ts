import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";

export type ActiveClientAnalyticsEvent =
  | "financial_overview_viewed"
  | "published_plan_viewed"
  | "roadmap_task_completed"
  | "budget_saved"
  | "goal_created"
  | "goal_updated"
  | "review_submitted"
  | "document_uploaded"
  | "document_downloaded"
  | "adviser_contact_selected"
  | "appointment_cta_selected"
  | "published_meeting_summary_viewed";

type EventMetadata = Record<string, string | number | boolean | null>;

/**
 * Privacy-conscious analytics — identifiers and event types only.
 * Never logs raw financial values, full goal text, or review answers.
 */
export async function recordActiveClientEvent(input: {
  clientId: string;
  userId: string;
  event: ActiveClientAnalyticsEvent;
  entityType?: string;
  entityId?: string | null;
  metadata?: EventMetadata;
}): Promise<void> {
  const safeMetadata: EventMetadata = {
    eventType: input.event,
    ...(input.metadata ?? {}),
  };

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.userId,
    action: input.event,
    entityType: input.entityType ?? "client_portal",
    entityId: input.entityId ?? input.clientId,
    metadata: safeMetadata,
  });
}
