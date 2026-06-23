import { createHash } from "node:crypto";

import type { LifecycleEventName, LifecycleSourceEntityType } from "./lifecycleNotificationTypes";

export const LIFECYCLE_IDEMPOTENCY_KEY_MAX_LENGTH = 64;

const SENSITIVE_KEY_PATTERNS = [
  /@/,
  /https?:\/\//i,
  /\$/,
  /<[^>]+>/,
  /javascript:/i,
];

export function buildLifecycleIdempotencyCanonical(input: {
  event: LifecycleEventName;
  sourceEntityType: LifecycleSourceEntityType;
  sourceEntityId: string;
  recipientClientId: string;
  sourceLifecycleVersion: string;
  channel: "in_app" | "email" | "audit";
}): string {
  return [
    input.event,
    input.sourceEntityType,
    input.sourceEntityId,
    input.recipientClientId,
    input.sourceLifecycleVersion,
    input.channel,
  ].join(":");
}

/** Deterministic SHA-256 hex digest — no PII in stored key. */
export function buildLifecycleIdempotencyKey(input: {
  event: LifecycleEventName;
  sourceEntityType: LifecycleSourceEntityType;
  sourceEntityId: string;
  recipientClientId: string;
  sourceLifecycleVersion: string;
  channel: "in_app" | "email" | "audit";
}): string {
  const canonical = buildLifecycleIdempotencyCanonical(input);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function assertIdempotencyKeyPrivacy(key: string): void {
  if (key.length > LIFECYCLE_IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw new Error("idempotency key exceeds maximum length");
  }
  for (const pattern of SENSITIVE_KEY_PATTERNS) {
    if (pattern.test(key)) {
      throw new Error("idempotency key contains sensitive pattern");
    }
  }
}
