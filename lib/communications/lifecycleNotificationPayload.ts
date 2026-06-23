import "server-only";

import type { LifecycleEventPolicy } from "./lifecycleNotificationPolicy";

/** Internal client routes only — no external redirects. */
export const ALLOWED_NOTIFICATION_DESTINATIONS = [
  "/document-vault",
  "/insights",
  "/goals-reviews",
  "/dashboard",
] as const;

export type AllowedNotificationDestination = (typeof ALLOWED_NOTIFICATION_DESTINATIONS)[number];

const REFERENCE_DESTINATION: Record<string, AllowedNotificationDestination> = {
  document: "/document-vault",
  governed_content: "/insights",
  published_output: "/dashboard",
  client_review_submission: "/goals-reviews",
};

const BLOCKED_METADATA_PATTERNS = [
  /https?:\/\//i,
  /javascript:/i,
  /<[^>]+>/,
  /@/,
  /\$[\d,]+/,
  /nric|fin|passport/i,
];

export function resolveDestinationForReference(
  referenceType: string,
): AllowedNotificationDestination | null {
  return REFERENCE_DESTINATION[referenceType] ?? null;
}

export function sanitizeLifecycleMetadata(
  policy: LifecycleEventPolicy,
  raw: Record<string, string> | undefined,
): Record<string, string> {
  if (!raw) {
    return {};
  }

  const sanitized: Record<string, string> = {};

  for (const key of policy.allowedMetadataKeys) {
    const value = raw[key];
    if (typeof value !== "string" || !value.trim()) {
      continue;
    }

    if (key === "destinationRoute") {
      if (
        !(ALLOWED_NOTIFICATION_DESTINATIONS as readonly string[]).includes(value)
      ) {
        continue;
      }
    }

    const blocked = BLOCKED_METADATA_PATTERNS.some((pattern) => pattern.test(value));
    if (blocked) {
      continue;
    }

    sanitized[key] = value.slice(0, 120);
  }

  return sanitized;
}

export function assertSafeNotificationText(text: string): string {
  const trimmed = text.trim().slice(0, 300);
  if (BLOCKED_METADATA_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return "Sign in to Aurelis for details.";
  }
  return trimmed;
}
