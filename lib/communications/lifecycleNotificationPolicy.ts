import "server-only";

import type { ClientNotificationType } from "./types";
import type { LifecycleEventName, LifecycleSourceEntityType } from "./lifecycleNotificationTypes";
import {
  buildLifecycleIdempotencyKey as buildHashedLifecycleIdempotencyKey,
} from "./lifecycleIdempotencyKey";

export { LIFECYCLE_IDEMPOTENCY_KEY_MAX_LENGTH } from "./lifecycleIdempotencyKey";
export { buildLifecycleIdempotencyCanonical } from "./lifecycleIdempotencyKey";

export type LifecycleEventPolicy = {
  event: LifecycleEventName;
  sourceEntityTypes: readonly LifecycleSourceEntityType[];
  recipientType: "client";
  inAppEligible: boolean;
  emailEligible: boolean;
  titleKey: string;
  summaryKey: string;
  notificationType: ClientNotificationType | null;
  requiredReferences: readonly ("referenceType" | "referenceId")[];
  allowedMetadataKeys: readonly string[];
  idempotencyStrategy: "event-entity-recipient-version";
};

const GENERIC_DOCUMENT_SUMMARY =
  "A document in your vault has been updated. Sign in to Aurelis for details.";

const GENERIC_UNAVAILABLE_SUMMARY =
  "An item in your portal is no longer available. Sign in to Aurelis for details.";

const GENERIC_ACTION_SUMMARY =
  "Your adviser has requested an action in your portal. Sign in to Aurelis for details.";

const GENERIC_COMPLETE_SUMMARY =
  "Your adviser has completed a review. Sign in to Aurelis for details.";

export const LIFECYCLE_EVENT_POLICIES: Record<LifecycleEventName, LifecycleEventPolicy> = {
  available: {
    event: "available",
    sourceEntityTypes: ["document"],
    recipientType: "client",
    inAppEligible: true,
    emailEligible: false,
    titleKey: "document.available.title",
    summaryKey: "document.available.summary",
    notificationType: "document_uploaded",
    requiredReferences: ["referenceType", "referenceId"],
    allowedMetadataKeys: ["destinationRoute"],
    idempotencyStrategy: "event-entity-recipient-version",
  },
  replaced: {
    event: "replaced",
    sourceEntityTypes: ["document"],
    recipientType: "client",
    inAppEligible: true,
    emailEligible: false,
    titleKey: "document.replaced.title",
    summaryKey: "document.replaced.summary",
    notificationType: "document_replaced",
    requiredReferences: ["referenceType", "referenceId"],
    allowedMetadataKeys: ["destinationRoute"],
    idempotencyStrategy: "event-entity-recipient-version",
  },
  superseded: {
    event: "superseded",
    sourceEntityTypes: ["document", "governed_content", "published_output"],
    recipientType: "client",
    inAppEligible: true,
    emailEligible: false,
    titleKey: "publication.superseded.title",
    summaryKey: "publication.superseded.summary",
    notificationType: "document_replaced",
    requiredReferences: ["referenceType", "referenceId"],
    allowedMetadataKeys: ["destinationRoute", "successorReferenceId"],
    idempotencyStrategy: "event-entity-recipient-version",
  },
  withdrawn: {
    event: "withdrawn",
    sourceEntityTypes: ["document", "governed_content", "published_output"],
    recipientType: "client",
    inAppEligible: true,
    emailEligible: false,
    titleKey: "publication.withdrawn.title",
    summaryKey: "publication.withdrawn.summary",
    notificationType: "document_removed",
    requiredReferences: ["referenceType", "referenceId"],
    allowedMetadataKeys: ["destinationRoute"],
    idempotencyStrategy: "event-entity-recipient-version",
  },
  action_required: {
    event: "action_required",
    sourceEntityTypes: ["document", "client_review_submission"],
    recipientType: "client",
    inAppEligible: true,
    emailEligible: false,
    titleKey: "document.action_required.title",
    summaryKey: "document.action_required.summary",
    notificationType: "document_action_required",
    requiredReferences: ["referenceType", "referenceId"],
    allowedMetadataKeys: ["destinationRoute"],
    idempotencyStrategy: "event-entity-recipient-version",
  },
  action_completed: {
    event: "action_completed",
    sourceEntityTypes: ["client_review_submission"],
    recipientType: "client",
    inAppEligible: true,
    emailEligible: false,
    titleKey: "document.action_completed.title",
    summaryKey: "document.action_completed.summary",
    notificationType: "review_requested",
    requiredReferences: ["referenceType", "referenceId"],
    allowedMetadataKeys: ["destinationRoute"],
    idempotencyStrategy: "event-entity-recipient-version",
  },
  downloaded: {
    event: "downloaded",
    sourceEntityTypes: ["document"],
    recipientType: "client",
    inAppEligible: false,
    emailEligible: false,
    titleKey: "document.downloaded.title",
    summaryKey: "document.downloaded.summary",
    notificationType: null,
    requiredReferences: ["referenceType", "referenceId"],
    allowedMetadataKeys: [],
    idempotencyStrategy: "event-entity-recipient-version",
  },
};

export function resolveLifecycleCopy(policy: LifecycleEventPolicy): {
  title: string;
  summary: string;
} {
  switch (policy.event) {
    case "available":
      return { title: "New document available", summary: GENERIC_DOCUMENT_SUMMARY };
    case "replaced":
      return { title: "Document updated", summary: GENERIC_DOCUMENT_SUMMARY };
    case "superseded":
      return { title: "Update replaced", summary: GENERIC_DOCUMENT_SUMMARY };
    case "withdrawn":
      return { title: "Item no longer available", summary: GENERIC_UNAVAILABLE_SUMMARY };
    case "action_required":
      return { title: "Action required", summary: GENERIC_ACTION_SUMMARY };
    case "action_completed":
      return { title: "Review complete", summary: GENERIC_COMPLETE_SUMMARY };
    case "downloaded":
      return { title: "Document accessed", summary: "" };
    default:
      return { title: "Portal update", summary: GENERIC_DOCUMENT_SUMMARY };
  }
}

export function buildLifecycleIdempotencyKey(input: {
  event: LifecycleEventName;
  sourceEntityType: LifecycleSourceEntityType;
  sourceEntityId: string;
  recipientClientId: string;
  sourceLifecycleVersion: string;
  channel: "in_app" | "email" | "audit";
}): string {
  return buildHashedLifecycleIdempotencyKey(input);
}
