import "server-only";

const SENSITIVE_PATTERNS = [
  /key/gi,
  /token/gi,
  /secret/gi,
  /password/gi,
  /email/gi,
  /@/,
  /\b\d{4,}\b/,
];

export function sanitizeJobError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  let sanitized = raw.replace(/key|token|secret|password/gi, "[redacted]");
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }
  return sanitized.slice(0, 200);
}

export function sanitizeJobMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const allowedKeys = ["initiatedByUserId", "triggerSource", "featureEnabled"];

  for (const key of allowedKeys) {
    if (key in metadata) {
      const value = metadata[key];
      if (typeof value === "string" || typeof value === "boolean") {
        safe[key] = value;
      }
    }
  }

  return safe;
}
