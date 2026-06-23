export {
  LIFECYCLE_EVENT_NAMES,
  LIFECYCLE_SOURCE_ENTITY_TYPES,
  isLifecycleEventName,
  type LifecycleEventName,
  type LifecycleSourceEntityType,
  type LifecycleRecipientType,
} from "./lifecycleNotificationTypes";

export {
  LIFECYCLE_EVENT_POLICIES,
  buildLifecycleIdempotencyKey,
  resolveLifecycleCopy,
  type LifecycleEventPolicy,
} from "./lifecycleNotificationPolicy";

export {
  ALLOWED_NOTIFICATION_DESTINATIONS,
  resolveDestinationForReference,
  sanitizeLifecycleMetadata,
  assertSafeNotificationText,
  type AllowedNotificationDestination,
} from "./lifecycleNotificationPayload";

export {
  emitLifecycleNotification,
  emitLifecycleNotificationSafe,
  emitGovernedContentLifecycleNotifications,
  emitPublishedOutputLifecycleNotification,
  type EmitLifecycleNotificationInput,
  type EmitLifecycleNotificationResult,
} from "./lifecycleNotificationService";

export {
  resolveClientRecipient,
  resolveGovernedContentRecipients,
  validatePublicationRecipient,
  validateDocumentRecipient,
} from "./lifecycleNotificationRecipients";

export { emitDocumentEventNotification, type DocumentEventType } from "./documentEventNotifications";

export { deliverPublicationNotifications, resolvePublishTargets } from "./publicationDelivery";
