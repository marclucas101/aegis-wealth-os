import "server-only";

import { emitLifecycleNotificationSafe } from "@/lib/communications/lifecycleNotificationService";
import { auditBinderEvent } from "./binderAudit";

export async function emitBinderAvailableNotification(input: {
  clientId: string;
  documentId: string;
  binderExportId: string;
  version: number;
  actorUserId: string;
}): Promise<void> {
  const result = await emitLifecycleNotificationSafe({
    event: "available",
    sourceEntityType: "document",
    sourceEntityId: input.documentId,
    sourceLifecycleVersion: `binder-v${input.version}`,
    recipientClientId: input.clientId,
    referenceId: input.documentId,
    actorUserId: input.actorUserId,
    metadata: { destinationRoute: "/document-vault" },
  });

  if (result.outcome === "failed") {
    await auditBinderEvent({
      action: "binder_lifecycle_notification_failed",
      clientId: input.clientId,
      userId: input.actorUserId,
      binderExportId: input.binderExportId,
      metadata: {
        version: input.version,
        outcome: "available_failed",
      },
    });
  }
}

export async function emitBinderSupersededNotification(input: {
  clientId: string;
  priorDocumentId: string;
  successorDocumentId: string;
  priorBinderId: string;
  actorUserId: string;
  version: number;
}): Promise<void> {
  const result = await emitLifecycleNotificationSafe({
    event: "superseded",
    sourceEntityType: "document",
    sourceEntityId: input.priorDocumentId,
    sourceLifecycleVersion: `binder-v${input.version}`,
    recipientClientId: input.clientId,
    referenceId: input.priorDocumentId,
    actorUserId: input.actorUserId,
    metadata: {
      destinationRoute: "/document-vault",
      successorReferenceId: input.successorDocumentId,
    },
  });

  if (result.outcome === "failed") {
    await auditBinderEvent({
      action: "binder_lifecycle_notification_failed",
      clientId: input.clientId,
      userId: input.actorUserId,
      binderExportId: input.priorBinderId,
      metadata: {
        version: input.version,
        outcome: "superseded_failed",
      },
    });
  }
}

export async function emitBinderWithdrawnNotification(input: {
  clientId: string;
  documentId: string;
  binderExportId: string;
  version: number;
  actorUserId: string;
}): Promise<void> {
  const result = await emitLifecycleNotificationSafe({
    event: "withdrawn",
    sourceEntityType: "document",
    sourceEntityId: input.documentId,
    sourceLifecycleVersion: `binder-v${input.version}-withdrawn`,
    recipientClientId: input.clientId,
    referenceId: input.documentId,
    actorUserId: input.actorUserId,
    metadata: { destinationRoute: "/document-vault" },
  });

  if (result.outcome === "failed") {
    await auditBinderEvent({
      action: "binder_lifecycle_notification_failed",
      clientId: input.clientId,
      userId: input.actorUserId,
      binderExportId: input.binderExportId,
      metadata: {
        version: input.version,
        outcome: "withdrawn_failed",
      },
    });
  }
}
