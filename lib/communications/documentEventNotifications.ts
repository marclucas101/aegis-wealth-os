import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";

import { emitLifecycleNotificationSafe } from "./lifecycleNotificationService";

/** Phase 9E/9F.2: `replaced` lifecycle events map to `document_replaced` (see lifecycleNotificationPolicy). */

export type DocumentEventType =
  | "uploaded"
  | "published_to_client"
  | "replaced"
  | "superseded"
  | "withdrawn"
  | "removed"
  | "action_required"
  | "action_completed"
  | "downloaded";

export async function emitDocumentEventNotification(input: {
  clientId: string;
  documentId: string;
  eventType: DocumentEventType;
  isClientVisible: boolean;
  actorUserId?: string | null;
  sourceLifecycleVersion?: string;
}): Promise<void> {
  const version = input.sourceLifecycleVersion ?? "v1";

  if (input.eventType === "uploaded" || input.eventType === "published_to_client") {
    if (!input.isClientVisible) {
      return;
    }

    const enabled = await isFeatureEnabled("document_event_notifications");
    if (!enabled) {
      return;
    }

    const inAppEnabled = await isFeatureEnabled("client_in_app_notifications");
    if (!inAppEnabled) {
      return;
    }

    await dbCreateClientNotification({
      clientId: input.clientId,
      notificationType: "document_uploaded",
      title: "New document available",
      summary: "A document in your vault has been updated. Sign in to Aurelis for details.",
      referenceType: "document",
      referenceId: input.documentId,
    });

    await writeAuditLog({
      clientId: input.clientId,
      userId: input.actorUserId ?? null,
      action: `document_${input.eventType}`,
      entityType: "document",
      entityId: input.documentId,
      metadata: { eventType: input.eventType },
    });
    return;
  }

  if (input.eventType === "removed") {
    await emitLifecycleNotificationSafe({
      event: "withdrawn",
      sourceEntityType: "document",
      sourceEntityId: input.documentId,
      sourceLifecycleVersion: version,
      recipientClientId: input.clientId,
      referenceId: input.documentId,
      actorUserId: input.actorUserId,
      isClientVisible: input.isClientVisible,
    });
    return;
  }

  if (!input.isClientVisible && input.eventType !== "downloaded") {
    return;
  }

  const documentLifecycleEvents = new Set<DocumentEventType>([
    "replaced",
    "superseded",
    "withdrawn",
    "action_required",
    "downloaded",
  ]);

  if (documentLifecycleEvents.has(input.eventType)) {
    await emitLifecycleNotificationSafe({
      event: input.eventType as "replaced" | "superseded" | "withdrawn" | "action_required" | "downloaded",
      sourceEntityType: "document",
      sourceEntityId: input.documentId,
      sourceLifecycleVersion: version,
      recipientClientId: input.clientId,
      referenceId: input.documentId,
      actorUserId: input.actorUserId,
      isClientVisible: input.isClientVisible,
    });
    return;
  }

  if (input.eventType === "action_completed") {
    await emitLifecycleNotificationSafe({
      event: "action_completed",
      sourceEntityType: "client_review_submission",
      sourceEntityId: input.documentId,
      sourceLifecycleVersion: version,
      recipientClientId: input.clientId,
      referenceId: input.documentId,
      actorUserId: input.actorUserId,
      isClientVisible: true,
    });
  }
}
