import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { writeAuditLog } from "@/lib/supabase/auditLog";

import {
  buildLifecycleIdempotencyKey,
  LIFECYCLE_EVENT_POLICIES,
  resolveLifecycleCopy,
} from "./lifecycleNotificationPolicy";
import {
  persistLifecycleNotification,
  type PersistLifecycleNotificationResult,
} from "./lifecycleNotificationPersistence";
import {
  resolveDestinationForReference,
  sanitizeLifecycleMetadata,
  assertSafeNotificationText,
} from "./lifecycleNotificationPayload";
import {
  referenceTypeForSource,
  resolveClientRecipient,
  resolveGovernedContentRecipients,
  validateDocumentRecipient,
  validatePublicationRecipient,
} from "./lifecycleNotificationRecipients";
import type { GovernedContentRow } from "./types";
import type { LifecycleEventName, LifecycleSourceEntityType } from "./lifecycleNotificationTypes";

export type EmitLifecycleNotificationInput = {
  event: LifecycleEventName;
  sourceEntityType: LifecycleSourceEntityType;
  sourceEntityId: string;
  sourceLifecycleVersion: string;
  recipientClientId: string;
  referenceId?: string;
  actorUserId?: string | null;
  isClientVisible?: boolean;
  metadata?: Record<string, string>;
};

export type EmitLifecycleNotificationResult = {
  outcome: "created" | "skipped_duplicate" | "skipped_ineligible" | "skipped_policy" | "audit_only" | "failed";
  reason?: string;
};

async function isLifecycleNotificationsEnabled(): Promise<boolean> {
  try {
    const documentEvents = await isFeatureEnabled("document_event_notifications");
    if (!documentEvents) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function emitLifecycleNotification(
  input: EmitLifecycleNotificationInput,
): Promise<EmitLifecycleNotificationResult> {
  const policy = LIFECYCLE_EVENT_POLICIES[input.event];
  if (!policy.sourceEntityTypes.includes(input.sourceEntityType)) {
    return { outcome: "skipped_policy", reason: "source_entity_mismatch" };
  }

  const referenceType = referenceTypeForSource(input.sourceEntityType);
  const referenceId = input.referenceId ?? input.sourceEntityId;
  const destination =
    resolveDestinationForReference(referenceType) ?? "/dashboard";
  const metadata = sanitizeLifecycleMetadata(policy, {
    ...input.metadata,
    destinationRoute: destination,
  });

  if (input.event === "downloaded") {
    await writeAuditLog({
      clientId: input.recipientClientId,
      userId: input.actorUserId ?? null,
      action: "document_downloaded",
      entityType: "document",
      entityId: referenceId,
      metadata: {
        lifecycle_event: input.event,
        idempotency_key: buildLifecycleIdempotencyKey({
          event: input.event,
          sourceEntityType: input.sourceEntityType,
          sourceEntityId: input.sourceEntityId,
          recipientClientId: input.recipientClientId,
          sourceLifecycleVersion: input.sourceLifecycleVersion,
          channel: "audit",
        }),
      },
    });
    return { outcome: "audit_only" };
  }

  const enabled = await isLifecycleNotificationsEnabled();
  if (!enabled) {
    return { outcome: "skipped_policy", reason: "feature_disabled" };
  }

  if (!policy.inAppEligible) {
    return { outcome: "skipped_policy", reason: "in_app_not_eligible" };
  }

  const recipient = await resolveRecipientForEvent(input);
  if (!recipient.eligible) {
    await writeAuditLog({
      clientId: input.recipientClientId,
      userId: input.actorUserId ?? null,
      action: "lifecycle_notification_skipped",
      entityType: input.sourceEntityType,
      entityId: input.sourceEntityId,
      metadata: {
        lifecycle_event: input.event,
        reason: recipient.reason,
      },
    });
    return { outcome: "skipped_ineligible", reason: recipient.reason };
  }

  const inAppEnabled = await isFeatureEnabled("client_in_app_notifications");
  if (!inAppEnabled) {
    return { outcome: "skipped_policy", reason: "in_app_disabled" };
  }

  if (!policy.notificationType) {
    return { outcome: "skipped_policy", reason: "no_notification_type" };
  }

  const copy = resolveLifecycleCopy(policy);
  const idempotencyKey = buildLifecycleIdempotencyKey({
    event: input.event,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    recipientClientId: input.recipientClientId,
    sourceLifecycleVersion: input.sourceLifecycleVersion,
    channel: "in_app",
  });

  let persisted: PersistLifecycleNotificationResult;
  try {
    persisted = await persistLifecycleNotification({
      clientId: input.recipientClientId,
      notificationType: policy.notificationType,
      title: assertSafeNotificationText(copy.title),
      summary: assertSafeNotificationText(copy.summary),
      referenceType,
      referenceId,
      lifecycleEvent: input.event,
      sourceEntityType: input.sourceEntityType,
      sourceLifecycleVersion: input.sourceLifecycleVersion,
      idempotencyKey,
      metadata,
    });
  } catch {
    await writeAuditLog({
      clientId: input.recipientClientId,
      userId: input.actorUserId ?? null,
      action: "lifecycle_notification_failed",
      entityType: input.sourceEntityType,
      entityId: input.sourceEntityId,
      metadata: { lifecycle_event: input.event },
    });
    return { outcome: "failed", reason: "notification_persistence_failed" };
  }

  if (persisted.outcome === "failed") {
    await writeAuditLog({
      clientId: input.recipientClientId,
      userId: input.actorUserId ?? null,
      action: "lifecycle_notification_failed",
      entityType: input.sourceEntityType,
      entityId: input.sourceEntityId,
      metadata: { lifecycle_event: input.event, reason: persisted.reason },
    });
    return { outcome: "failed", reason: persisted.reason };
  }

  await writeAuditLog({
    clientId: input.recipientClientId,
    userId: input.actorUserId ?? null,
    action: `document_${input.event}`,
    entityType: input.sourceEntityType,
    entityId: input.sourceEntityId,
    metadata: {
      lifecycle_event: input.event,
      notification_id: persisted.notification.id,
      outcome: persisted.outcome,
    },
  });

  return {
    outcome:
      persisted.outcome === "skipped_duplicate" ? "skipped_duplicate" : "created",
  };
}

async function resolveRecipientForEvent(
  input: EmitLifecycleNotificationInput,
): Promise<{ eligible: boolean; reason?: string }> {
  if (input.sourceEntityType === "document") {
    const result = await validateDocumentRecipient({
      clientId: input.recipientClientId,
      documentId: input.referenceId ?? input.sourceEntityId,
      isClientVisible: input.isClientVisible !== false,
    });
    return result.eligible
      ? { eligible: true }
      : { eligible: false, reason: result.reason };
  }

  if (input.sourceEntityType === "client_review_submission") {
    const result = await resolveClientRecipient({ clientId: input.recipientClientId });
    return result.eligible
      ? { eligible: true }
      : { eligible: false, reason: result.reason };
  }

  if (input.sourceEntityType === "published_output") {
    return { eligible: true };
  }

  return resolveClientRecipient({ clientId: input.recipientClientId });
}

/** Notify audience clients when governed content is withdrawn or superseded. */
export async function emitGovernedContentLifecycleNotifications(input: {
  event: "withdrawn" | "superseded";
  content: GovernedContentRow;
  actorUserId: string;
  transitionAt: string;
  successorContentId?: string;
}): Promise<void> {
  if (input.content.content_type === "internal_adviser") {
    return;
  }

  const clientIds = await resolveGovernedContentRecipients(input.content);
  for (const clientId of clientIds) {
    await emitLifecycleNotification({
      event: input.event,
      sourceEntityType: "governed_content",
      sourceEntityId: input.content.id,
      sourceLifecycleVersion: input.transitionAt,
      recipientClientId: clientId,
      referenceId: input.content.id,
      actorUserId: input.actorUserId,
      isClientVisible: true,
      metadata:
        input.successorContentId
          ? { successorReferenceId: input.successorContentId }
          : undefined,
    }).catch(() => undefined);
  }
}

/** Notify client when a published output is withdrawn or superseded. */
export async function emitPublishedOutputLifecycleNotification(input: {
  event: "withdrawn" | "superseded";
  outputId: string;
  clientId: string;
  outputAudience: string;
  publicationStatus: string;
  actorUserId: string;
  transitionAt: string;
  successorOutputId?: string;
}): Promise<void> {
  const recipient = await validatePublicationRecipient({
    clientId: input.clientId,
    outputAudience: input.outputAudience,
    publicationStatus: input.publicationStatus,
  });

  if (!recipient.eligible) {
    return;
  }

  await emitLifecycleNotification({
    event: input.event,
    sourceEntityType: "published_output",
    sourceEntityId: input.outputId,
    sourceLifecycleVersion: input.transitionAt,
    recipientClientId: input.clientId,
    referenceId: input.outputId,
    actorUserId: input.actorUserId,
    isClientVisible: true,
    metadata: input.successorOutputId
      ? { successorReferenceId: input.successorOutputId }
      : undefined,
  }).catch(() => undefined);
}

/** Safe wrapper — lifecycle failure must not throw to callers. */
export async function emitLifecycleNotificationSafe(
  input: EmitLifecycleNotificationInput,
): Promise<EmitLifecycleNotificationResult> {
  try {
    return await emitLifecycleNotification(input);
  } catch {
    return { outcome: "failed", reason: "unexpected_error" };
  }
}
