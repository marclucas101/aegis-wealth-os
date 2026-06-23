import "server-only";

import {
  PROMOTION_MIGRATION_CLASSIFICATIONS,
  PROMOTION_ASSET_STATUSES,
  PROMOTION_MIGRATION_LIST_SORT_KEYS,
  PROMOTION_MIGRATION_MAX_PAGE_SIZE,
  type PromotionMigrationClassification,
  type PromotionMigrationListFilter,
} from "./promotionMigrationTypes";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseEnum<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  if (!value) {
    return undefined;
  }
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function parsePromotionMigrationListParams(
  searchParams: URLSearchParams,
): PromotionMigrationListFilter {
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);

  return {
    migrationStatus: parseEnum(searchParams.get("migrationStatus"), [
      "unmigrated",
      "migrated",
      "reviewed_no_destination",
      "all",
    ] as const),
    publicationStatus: parseEnum(searchParams.get("publicationStatus"), [
      "draft",
      "published",
      "archived",
      "all",
    ] as const),
    activeState: parseEnum(searchParams.get("activeState"), [
      "active",
      "expired",
      "scheduled",
      "all",
    ] as const),
    classification: parseEnum(
      searchParams.get("classification"),
      PROMOTION_MIGRATION_CLASSIFICATIONS,
    ),
    assetStatus: parseEnum(searchParams.get("assetStatus"), PROMOTION_ASSET_STATUSES),
    adviserUserId: searchParams.get("adviserUserId")?.trim() || undefined,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(pageSize, PROMOTION_MIGRATION_MAX_PAGE_SIZE)
        : 20,
    sortBy: parseEnum(searchParams.get("sortBy"), PROMOTION_MIGRATION_LIST_SORT_KEYS),
    sortDir: parseEnum(searchParams.get("sortDir"), ["asc", "desc"] as const),
  };
}

export function parseClassificationBody(
  body: Record<string, unknown>,
): PromotionMigrationClassification | { error: string } {
  const value = typeof body.classification === "string" ? body.classification : "";
  if (!(PROMOTION_MIGRATION_CLASSIFICATIONS as readonly string[]).includes(value)) {
    return { error: "Missing or invalid classification" };
  }
  return value as PromotionMigrationClassification;
}

export function parseOperatorNote(body: Record<string, unknown>): string | null | undefined {
  if (body.operatorNote === undefined && body.note === undefined) {
    return undefined;
  }
  const value = body.operatorNote ?? body.note;
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}

export function isValidPromotionMigrationId(id: string): boolean {
  return UUID_RE.test(id);
}
