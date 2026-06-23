import "server-only";

/** Approved lifecycle event names — not accepted from API requests. */
export const LIFECYCLE_EVENT_NAMES = [
  "available",
  "replaced",
  "superseded",
  "withdrawn",
  "action_required",
  "action_completed",
  "downloaded",
] as const;

export type LifecycleEventName = (typeof LIFECYCLE_EVENT_NAMES)[number];

export const LIFECYCLE_SOURCE_ENTITY_TYPES = [
  "document",
  "governed_content",
  "published_output",
  "client_review_submission",
] as const;

export type LifecycleSourceEntityType = (typeof LIFECYCLE_SOURCE_ENTITY_TYPES)[number];

export type LifecycleRecipientType = "client";

export function isLifecycleEventName(value: string): value is LifecycleEventName {
  return (LIFECYCLE_EVENT_NAMES as readonly string[]).includes(value);
}
