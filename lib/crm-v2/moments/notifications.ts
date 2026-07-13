import "server-only";

import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function notifyReviewDueSoon(input: {
  clientId: string;
  reviewType: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "review_due_soon",
      title: "Review coming up",
      summary: truncate(`Your ${input.reviewType.replace(/_/g, " ")} is scheduled soon.`, 200),
      referenceType: "crm_review_rhythm",
      referenceId: input.clientId,
    });
  } catch {
    // Notification failure must not corrupt authoritative transition
  }
}

export async function notifyClientPreferenceUpdateSubmitted(input: {
  clientId: string;
  preferenceType: string;
  updateId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "preference_update_submitted",
      title: "Preference update received",
      summary: truncate("Your adviser will review your preference update.", 200),
      referenceType: "crm_client_preference_update",
      referenceId: input.updateId,
    });
  } catch {
    // Non-blocking
  }
}

export async function notifyImportantDateApproaching(input: {
  clientId: string;
  momentId: string;
  title: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "important_date_approaching",
      title: "Important date approaching",
      summary: truncate(input.title, 200),
      referenceType: "relationship_moment",
      referenceId: input.momentId,
    });
  } catch {
    // Non-blocking
  }
}

export async function notifyClientRequestedReview(input: {
  clientId: string;
  requestId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "review_requested",
      title: "Review request received",
      summary: truncate("Your adviser will follow up on your review request.", 200),
      referenceType: "crm_client_preference_update",
      referenceId: input.requestId,
    });
  } catch {
    // Non-blocking
  }
}

export async function notifyAdviserConfirmedPreference(input: {
  clientId: string;
  preferenceType: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "preference_confirmed",
      title: "Preference confirmed",
      summary: truncate("Your adviser confirmed a relationship preference.", 200),
      referenceType: "crm_client_preference_update",
      referenceId: input.clientId,
    });
  } catch {
    // Non-blocking
  }
}
