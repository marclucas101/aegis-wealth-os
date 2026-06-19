import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";

export type ProspectAnalyticsEvent =
  | "prospect_onboarding_started"
  | "prospect_section_completed"
  | "prospect_profile_submitted"
  | "prospect_profile_resumed"
  | "prospect_appointment_cta_selected"
  | "prospect_appointment_booked"
  | "prospect_meeting_preparation_viewed"
  | "prospect_published_snapshot_viewed"
  | "prospect_document_uploaded";

type ProspectEventInput = {
  clientId: string;
  userId: string;
  event: ProspectAnalyticsEvent;
  metadata?: Record<string, string | number | boolean | null>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Privacy-conscious prospect journey events — no raw financial answers in metadata. */
export async function recordProspectEvent(input: ProspectEventInput): Promise<void> {
  await writeAuditLog({
    clientId: input.clientId,
    userId: input.userId,
    action: input.event,
    entityType: "prospect_journey",
    entityId: input.clientId,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

/** Non-blocking analytics — never breaks the primary user action. */
export async function safeRecordProspectEvent(
  input: ProspectEventInput,
): Promise<void> {
  try {
    await recordProspectEvent(input);
  } catch (error) {
    console.error("[prospectAnalytics] failed to record event", input.event, error);
  }
}
