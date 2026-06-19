import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";

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

const EVENT_TO_NOTIFICATION: Partial<
  Record<DocumentEventType, { type: "document_uploaded" | "document_replaced" | "document_removed" | "document_action_required"; title: string }>
> = {
  uploaded: { type: "document_uploaded", title: "New document available" },
  published_to_client: { type: "document_uploaded", title: "New document available" },
  replaced: { type: "document_replaced", title: "Document updated" },
  removed: { type: "document_removed", title: "Document removed" },
  withdrawn: { type: "document_removed", title: "Document no longer available" },
  action_required: { type: "document_action_required", title: "Document action required" },
};

export async function emitDocumentEventNotification(input: {
  clientId: string;
  documentId: string;
  eventType: DocumentEventType;
  isClientVisible: boolean;
  actorUserId?: string | null;
}): Promise<void> {
  if (!input.isClientVisible) {
    return;
  }

  const enabled = await isFeatureEnabled("document_event_notifications");
  if (!enabled) {
    return;
  }

  const mapping = EVENT_TO_NOTIFICATION[input.eventType];
  if (!mapping) {
    return;
  }

  const inAppEnabled = await isFeatureEnabled("client_in_app_notifications");
  if (!inAppEnabled) {
    return;
  }

  await dbCreateClientNotification({
    clientId: input.clientId,
    notificationType: mapping.type,
    title: mapping.title,
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
}
