import "server-only";

import { CRM_V2_PILOT_USER_IDS_ENV } from "@/lib/crm-v2/constants";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PilotAllowlistParseResult =
  | { ok: true; userIds: ReadonlySet<string> }
  | { ok: false; reason: "missing" | "empty" | "malformed" };

/**
 * Parses operator-configured pilot adviser user IDs from environment.
 * Fail-closed: missing, empty, or any malformed token rejects the entire allowlist.
 */
export function parsePilotAllowlistFromEnv(): PilotAllowlistParseResult {
  const raw = process.env[CRM_V2_PILOT_USER_IDS_ENV];

  if (raw === undefined || raw.trim().length === 0) {
    return { ok: false, reason: raw === undefined ? "missing" : "empty" };
  }

  const tokens = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (tokens.length === 0) {
    return { ok: false, reason: "empty" };
  }

  for (const token of tokens) {
    if (!UUID_RE.test(token)) {
      return { ok: false, reason: "malformed" };
    }
  }

  return { ok: true, userIds: new Set(tokens.map((id) => id.toLowerCase())) };
}

export function isUserInPilotAllowlist(
  userId: string,
  allowlist: ReadonlySet<string>,
): boolean {
  return allowlist.has(userId.toLowerCase());
}
