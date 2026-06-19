import "server-only";

const SENSITIVE_KEYS = [
  "body",
  "summary",
  "title",
  "content",
  "email",
  "password",
  "secret",
  "token",
  "api_key",
  "apiKey",
  "provider_reference",
  "providerReference",
  "client_ids",
  "clientIds",
  "target_client_ids",
  "net_worth",
  "balance",
  "amount",
  "financial",
  "recommendation",
] as const;

const MAX_METADATA_VALUE_LENGTH = 200;
const MAX_METADATA_KEYS = 12;

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  let keyCount = 0;

  for (const [key, value] of Object.entries(metadata)) {
    if (keyCount >= MAX_METADATA_KEYS) {
      break;
    }

    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      continue;
    }

    if (typeof value === "string" && value.length > MAX_METADATA_VALUE_LENGTH) {
      safe[key] = `${value.slice(0, MAX_METADATA_VALUE_LENGTH)}…`;
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      safe[key] = value;
    } else if (typeof value === "string") {
      safe[key] = value;
    } else if (Array.isArray(value)) {
      safe[key] = value.slice(0, 5).map((item) =>
        typeof item === "string" ? item.slice(0, 40) : String(item).slice(0, 40),
      );
    }
    keyCount++;
  }

  return safe;
}

export function scanMetadataForSensitiveKeys(
  metadata: Record<string, unknown>,
): string[] {
  const violations: string[] = [];
  for (const key of Object.keys(metadata)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      violations.push(key);
    }
  }
  return violations;
}
