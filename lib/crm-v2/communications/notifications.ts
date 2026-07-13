import "server-only";

import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export async function notifyClientVisibleMessage(input: {
  clientId: string;
  recordId: string;
  safeSubject: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "crm_client_message",
      title: "New message from your adviser",
      summary: truncate(input.safeSubject, 200),
      referenceType: "crm_communication_record",
      referenceId: input.recordId,
    });
  } catch {
    // Notification failure must not corrupt authoritative transition
  }
}

export async function notifyAdviserClientReply(input: {
  clientId: string;
  recordId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "crm_client_reply_received",
      title: "Reply received",
      summary: truncate("Your reply has been sent to your adviser.", 200),
      referenceType: "crm_communication_record",
      referenceId: input.recordId,
    });
  } catch {
    // Non-blocking
  }
}

export async function notifyCommunicationFollowUpDue(input: {
  clientId: string;
  recordId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "crm_communication_follow_up_due",
      title: "Communication follow-up due",
      summary: truncate("A communication follow-up is due for adviser review.", 200),
      referenceType: "crm_communication_record",
      referenceId: input.recordId,
    });
  } catch {
    // Non-blocking
  }
}

export async function notifyPreferenceUpdateSubmitted(input: {
  clientId: string;
}): Promise<void> {
  try {
    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "communication_preference_updated",
      title: "Communication preferences updated",
      summary: truncate("Your communication preferences have been updated.", 200),
      referenceType: "communication_preferences",
      referenceId: input.clientId,
    });
  } catch {
    // Non-blocking
  }
}
