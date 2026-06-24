import { createHash } from "node:crypto";

/** Must match supabase migration 202606200012 namespace UUID. */
export const LEGACY_PROMOTION_MIGRATION_NAMESPACE_UUID =
  "f47ac10b-58cc-4372-a567-0e02b2c3d479";

export const LEGACY_PROMOTION_MIGRATION_SOURCE_PREFIX = "legacy_promotion:";

export type PromotionMigrationOutcome =
  | "created"
  | "reused"
  | "recovered_orphan"
  | "already_migrated"
  | "review_only"
  | "conflict"
  | "failed";

export function legacyPromotionMigrationSourceKey(promotionId: string): string {
  return `${LEGACY_PROMOTION_MIGRATION_SOURCE_PREFIX}${promotionId}`;
}

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** RFC 4122 UUID v5 — must match Postgres uuid_generate_v5 in migration 012. */
export function legacyPromotionMigrationDestinationId(promotionId: string): string {
  const namespace = uuidToBytes(LEGACY_PROMOTION_MIGRATION_NAMESPACE_UUID);
  const name = legacyPromotionMigrationSourceKey(promotionId);
  const hash = createHash("sha1")
    .update(namespace)
    .update(name)
    .digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  return bytesToUuid(bytes);
}

export function isPromotionMigrationOutcome(
  value: string,
): value is PromotionMigrationOutcome {
  return (
    value === "created" ||
    value === "reused" ||
    value === "recovered_orphan" ||
    value === "already_migrated" ||
    value === "review_only" ||
    value === "conflict" ||
    value === "failed"
  );
}

export type AtomicMigrationRpcResult = {
  ok: boolean;
  outcome: PromotionMigrationOutcome;
  content_id?: string | null;
  skipped?: boolean;
  reused?: boolean;
  reason?: string;
  expected_content_id?: string;
};

export function parseAtomicMigrationRpcResult(
  data: unknown,
): AtomicMigrationRpcResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const row = data as Record<string, unknown>;
  const outcome = typeof row.outcome === "string" ? row.outcome : "failed";

  return {
    ok: row.ok === true,
    outcome: isPromotionMigrationOutcome(outcome) ? outcome : "failed",
    content_id: typeof row.content_id === "string" ? row.content_id : null,
    skipped: row.skipped === true,
    reused: row.reused === true,
    reason: typeof row.reason === "string" ? row.reason : undefined,
    expected_content_id:
      typeof row.expected_content_id === "string" ? row.expected_content_id : undefined,
  };
}
