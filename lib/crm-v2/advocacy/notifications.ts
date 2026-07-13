import "server-only";

import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function notifyAdvocacyConsentWithdrawn(input: {
  clientId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "advocacy_consent_withdrawn",
      title: "Advocacy consent updated",
      summary: truncate("Your testimonial permission withdrawal has been recorded.", 200),
      referenceType: "crm_client_advocacy_preferences",
      referenceId: input.clientId,
    });
  } catch {
    // Notification failure must not corrupt authoritative transition
  }
}

export async function notifyAdvocacyReferralFollowUpDue(input: {
  clientId: string;
  eventId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "advocacy_referral_follow_up_due",
      title: "Referral follow-up due",
      summary: truncate("An advocacy referral follow-up is due for adviser review.", 200),
      referenceType: "advocacy_event",
      referenceId: input.eventId,
    });
  } catch {
    // Non-blocking
  }
}

export async function notifyClientAdvocacyFeedbackSubmitted(input: {
  clientId: string;
  eventId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "advocacy_feedback_submitted",
      title: "Feedback received",
      summary: truncate("Your feedback has been received by your adviser.", 200),
      referenceType: "advocacy_event",
      referenceId: input.eventId,
    });
  } catch {
    // Non-blocking
  }
}

export async function notifyTestimonialPermissionUpdated(input: {
  clientId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "testimonial_permission_updated",
      title: "Testimonial permission updated",
      summary: truncate("Your testimonial permission preference has been updated.", 200),
      referenceType: "crm_client_advocacy_preferences",
      referenceId: input.clientId,
    });
  } catch {
    // Non-blocking
  }
}
