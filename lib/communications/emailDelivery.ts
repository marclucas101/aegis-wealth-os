import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { sendTransactionalEmail } from "@/lib/email/emailProvider";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  dbCreateDeliveryRecord,
  dbFindDeliveryRecord,
  dbUpdateDeliveryStatus,
} from "@/lib/supabase/communicationDeliveryPersistence";
import { dbLoadCommunicationPreferences } from "@/lib/supabase/communicationPreferencesPersistence";

import type { GovernedContentRow } from "./types";

function sanitizeProviderError(error: string): string {
  return error.replace(/key|token|secret|password/gi, "[redacted]").slice(0, 200);
}

async function loadClientEmail(clientId: string): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data: client, error: clientError } = await admin
    .from("clients")
    .select("user_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    return null;
  }

  const clientRow = client as { user_id: string };
  const { data: user, error: userError } = await admin
    .from("users")
    .select("email")
    .eq("id", clientRow.user_id)
    .maybeSingle();

  if (userError || !user) {
    return null;
  }

  return (user as { email: string }).email ?? null;
}

export async function queueInsightEmailDelivery(input: {
  content: GovernedContentRow;
  clientId: string;
}): Promise<void> {
  const emailEnabled = await isFeatureEnabled("client_email_notifications");
  if (!emailEnabled) {
    return;
  }

  const prefs = await dbLoadCommunicationPreferences(input.clientId);

  const categoryPref =
    input.content.category === "market_update"
      ? prefs.market_updates
      : input.content.category === "event"
        ? prefs.event_announcements
        : input.content.content_type === "adviser_message"
          ? prefs.adviser_messages
          : prefs.educational_insights;

  if (!prefs.email_operational || !categoryPref) {
    const delivery = await dbCreateDeliveryRecord({
      communicationId: input.content.id,
      clientId: input.clientId,
      channel: "email",
    });
    await dbUpdateDeliveryStatus(delivery.id, {
      delivery_status: "suppressed_by_preference",
    });
    return;
  }

  const email = await loadClientEmail(input.clientId);
  if (!email) {
    const delivery = await dbCreateDeliveryRecord({
      communicationId: input.content.id,
      clientId: input.clientId,
      channel: "email",
    });
    await dbUpdateDeliveryStatus(delivery.id, {
      delivery_status: "skipped_no_email",
    });
    return;
  }

  const existing = await dbFindDeliveryRecord({
    communicationId: input.content.id,
    clientId: input.clientId,
    channel: "email",
  });

  if (existing?.delivery_status === "sent") {
    return;
  }

  const delivery =
    existing ??
    (await dbCreateDeliveryRecord({
      communicationId: input.content.id,
      clientId: input.clientId,
      channel: "email",
    }));

  await attemptEmailDelivery({
    deliveryId: delivery.id,
    to: email,
    subject: `New update: ${input.content.title}`,
    text: `${input.content.summary}\n\nView in Aurelis for full details.`,
    clientId: input.clientId,
  });
}

export async function attemptEmailDelivery(input: {
  deliveryId: string;
  to: string;
  subject: string;
  text: string;
  clientId: string;
  attemptCount?: number;
}): Promise<void> {
  const attemptCount = (input.attemptCount ?? 0) + 1;

  await dbUpdateDeliveryStatus(input.deliveryId, {
    delivery_status: attemptCount > 1 ? "retrying" : "pending",
    attempt_count: attemptCount,
    last_attempt_at: new Date().toISOString(),
  });

  await writeAuditLog({
    clientId: input.clientId,
    action: attemptCount > 1 ? "delivery_retried" : "delivery_attempted",
    entityType: "communication_delivery",
    entityId: input.deliveryId,
    metadata: { attemptCount },
  });

  const result = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if (result.ok) {
    await dbUpdateDeliveryStatus(input.deliveryId, {
      delivery_status: "sent",
      sent_at: new Date().toISOString(),
      provider_reference: result.messageId ?? null,
    });
    return;
  }

  await dbUpdateDeliveryStatus(input.deliveryId, {
    delivery_status: "failed",
    failed_at: new Date().toISOString(),
    error_code: sanitizeProviderError(result.error),
  });

  await writeAuditLog({
    clientId: input.clientId,
    action: "delivery_failed",
    entityType: "communication_delivery",
    entityId: input.deliveryId,
    metadata: { errorCode: sanitizeProviderError(result.error) },
  });
}

export async function retryFailedDelivery(deliveryId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("communication_deliveries")
    .select("*, governed_content(title, summary)")
    .eq("id", deliveryId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Delivery record not found");
  }

  const row = data as {
    id: string;
    client_id: string;
    delivery_status: string;
    attempt_count: number;
    communication_id: string | null;
    governed_content: { title: string; summary: string } | null;
  };

  if (row.delivery_status === "sent") {
    return;
  }

  const email = await loadClientEmail(row.client_id);
  if (!email) {
    await dbUpdateDeliveryStatus(deliveryId, { delivery_status: "skipped_no_email" });
    return;
  }

  const title = row.governed_content?.title ?? "Update from your adviser";
  const summary = row.governed_content?.summary ?? "Sign in to Aurelis for details.";

  await attemptEmailDelivery({
    deliveryId: row.id,
    to: email,
    subject: `New update: ${title}`,
    text: `${summary}\n\nView in Aurelis for full details.`,
    clientId: row.client_id,
    attemptCount: row.attempt_count,
  });
}
