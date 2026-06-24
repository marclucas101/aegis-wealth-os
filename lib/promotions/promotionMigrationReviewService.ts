import "server-only";

import { classifyPromotion } from "@/lib/communications/legacyPromotionsMigration";
import type { PromotionMigrationClassification } from "@/lib/communications/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { dbLoadGovernedContentById } from "@/lib/supabase/governedContentPersistence";

import { assetBlockMessage } from "./promotionAssetPolicy";
import {
  transformLegacyPromotionToGovernedDraft,
  toMigrationPreviewDto,
  type LegacyPromotionSourceRecord,
} from "./legacyPromotionTransform";
import { executeAtomicLegacyPromotionMigration } from "./promotionMigrationPersistence";
import type { PromotionMigrationOutcome } from "./promotionMigrationIdempotency";
import {
  isMigrationDraftClassification,
  PROMOTION_MIGRATION_DEFAULT_PAGE_SIZE,
  PROMOTION_MIGRATION_MAX_PAGE_SIZE,
  sanitizeOperatorNote,
  type PromotionMigrationListFilter,
  type PromotionMigrationSortKey,
} from "./promotionMigrationTypes";

type ReviewRow = {
  promotion_id: string;
  classification: string;
  migrated_content_id: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  notes: string | null;
};

function isPromotionActive(row: LegacyPromotionSourceRecord, now = new Date()): boolean {
  if (row.status !== "published") {
    return false;
  }
  const starts = row.starts_at ? new Date(row.starts_at) : null;
  const ends = row.ends_at ? new Date(row.ends_at) : null;
  if (starts && starts > now) {
    return false;
  }
  if (ends && ends < now) {
    return false;
  }
  return true;
}

function isPromotionExpired(row: LegacyPromotionSourceRecord, now = new Date()): boolean {
  if (row.status === "archived") {
    return true;
  }
  if (row.ends_at) {
    const ends = new Date(row.ends_at);
    return !Number.isNaN(ends.getTime()) && ends < now;
  }
  return false;
}

function isPromotionScheduled(row: LegacyPromotionSourceRecord, now = new Date()): boolean {
  if (!row.starts_at) {
    return false;
  }
  const starts = new Date(row.starts_at);
  return !Number.isNaN(starts.getTime()) && starts > now;
}

function sortPromotions(
  rows: LegacyPromotionSourceRecord[],
  sortBy: PromotionMigrationSortKey,
  sortDir: "asc" | "desc",
): LegacyPromotionSourceRecord[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sortBy === "title") {
      return a.title.localeCompare(b.title) * dir;
    }
    if (sortBy === "priority") {
      return (a.priority - b.priority) * dir;
    }
    const aVal = sortBy === "updated_at" ? a.updated_at : a.created_at;
    const bVal = sortBy === "updated_at" ? b.updated_at : b.created_at;
    return aVal.localeCompare(bVal) * dir;
  });
}

function toListItemDto(row: LegacyPromotionSourceRecord, review: ReviewRow | null) {
  const transform = transformLegacyPromotionToGovernedDraft({
    source: row,
    classification:
      (review?.classification as PromotionMigrationClassification) ?? classifyPromotion(row),
  });

  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerAdviserUserId: row.created_by,
    publicationStatus: row.status,
    isActive: isPromotionActive(row),
    isExpired: isPromotionExpired(row),
    isScheduled: isPromotionScheduled(row),
    hasAssets: Boolean(row.image_url?.trim() || row.attachment_url?.trim()),
    assetStatus: transform.assetStatus,
    migrationStatus: review?.migrated_content_id
      ? "migrated"
      : review
        ? "reviewed_no_destination"
        : "unmigrated",
    classification: review?.classification ?? null,
    suggestedClassification: classifyPromotion(row),
    migratedContentId: review?.migrated_content_id ?? null,
    reviewedAt: review?.reviewed_at ?? null,
  };
}

export async function loadLegacyPromotionSource(
  promotionId: string,
): Promise<LegacyPromotionSourceRecord | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("promotions")
    .select("*")
    .eq("id", promotionId)
    .maybeSingle();

  if (error) {
    throw new Error("Failed to load promotion");
  }

  return data ? (data as LegacyPromotionSourceRecord) : null;
}

async function loadReviewMap(): Promise<Map<string, ReviewRow>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.from("promotion_migration_reviews").select("*");

  if (error) {
    throw new Error("Failed to load migration reviews");
  }

  const map = new Map<string, ReviewRow>();
  for (const row of data ?? []) {
    const review = row as ReviewRow;
    map.set(review.promotion_id, review);
  }
  return map;
}

export async function getPromotionMigrationQueueOverview(): Promise<{
  sourceRowCount: number;
  unmigratedQueueCount: number;
}> {
  const admin = createAdminSupabaseClient();
  const { count: sourceRowCount, error } = await admin
    .from("promotions")
    .select("id", { count: "exact", head: true });

  if (error) {
    throw new Error("Failed to count legacy promotions");
  }

  const total = sourceRowCount ?? 0;
  if (total === 0) {
    return { sourceRowCount: 0, unmigratedQueueCount: 0 };
  }

  const [reviewMap, { data: promotionRows, error: listError }] = await Promise.all([
    loadReviewMap(),
    admin.from("promotions").select("id"),
  ]);

  if (listError) {
    throw new Error("Failed to list legacy promotions for queue overview");
  }

  let unmigratedQueueCount = 0;
  for (const row of promotionRows ?? []) {
    const review = reviewMap.get((row as { id: string }).id);
    if (!review?.migrated_content_id) {
      unmigratedQueueCount += 1;
    }
  }

  return { sourceRowCount: total, unmigratedQueueCount };
}

export async function listPromotionMigrationRecords(filter: PromotionMigrationListFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(
    PROMOTION_MIGRATION_MAX_PAGE_SIZE,
    Math.max(1, filter.pageSize ?? PROMOTION_MIGRATION_DEFAULT_PAGE_SIZE),
  );
  const sortBy = filter.sortBy ?? "created_at";
  const sortDir = filter.sortDir ?? "desc";

  const admin = createAdminSupabaseClient();
  const [{ data: promotions, error }, reviewMap] = await Promise.all([
    admin.from("promotions").select("*"),
    loadReviewMap(),
  ]);

  if (error) {
    throw new Error("Failed to list promotions");
  }

  let rows = (promotions ?? []) as LegacyPromotionSourceRecord[];

  if (filter.publicationStatus && filter.publicationStatus !== "all") {
    rows = rows.filter((row) => row.status === filter.publicationStatus);
  }

  if (filter.activeState && filter.activeState !== "all") {
    rows = rows.filter((row) => {
      if (filter.activeState === "active") return isPromotionActive(row);
      if (filter.activeState === "expired") return isPromotionExpired(row);
      if (filter.activeState === "scheduled") return isPromotionScheduled(row);
      return true;
    });
  }

  if (filter.adviserUserId) {
    rows = rows.filter((row) => row.created_by === filter.adviserUserId);
  }

  if (filter.classification) {
    rows = rows.filter((row) => {
      const review = reviewMap.get(row.id);
      const classification =
        (review?.classification as PromotionMigrationClassification | undefined) ??
        classifyPromotion(row);
      return classification === filter.classification;
    });
  }

  if (filter.migrationStatus && filter.migrationStatus !== "all") {
    rows = rows.filter((row) => {
      const review = reviewMap.get(row.id);
      const status = review?.migrated_content_id
        ? "migrated"
        : review
          ? "reviewed_no_destination"
          : "unmigrated";
      return status === filter.migrationStatus;
    });
  }

  if (filter.assetStatus) {
    rows = rows.filter((row) => {
      const transform = transformLegacyPromotionToGovernedDraft({
        source: row,
        classification: classifyPromotion(row),
      });
      return transform.assetStatus === filter.assetStatus;
    });
  }

  const totalCount = rows.length;
  const sorted = sortPromotions(rows, sortBy, sortDir);
  const offset = (page - 1) * pageSize;
  const pageRows = sorted.slice(offset, offset + pageSize);

  return {
    promotions: pageRows.map((row) => toListItemDto(row, reviewMap.get(row.id) ?? null)),
    page,
    pageSize,
    totalCount,
    totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
  };
}

export async function getPromotionMigrationDetail(promotionId: string) {
  const source = await loadLegacyPromotionSource(promotionId);
  if (!source) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data: reviewData } = await admin
    .from("promotion_migration_reviews")
    .select("*")
    .eq("promotion_id", promotionId)
    .maybeSingle();

  const review = reviewData ? (reviewData as ReviewRow) : null;
  const classification =
    (review?.classification as PromotionMigrationClassification | undefined) ??
    classifyPromotion(source);

  const transform = transformLegacyPromotionToGovernedDraft({ source, classification });

  let destinationSummary: {
    id: string;
    title: string;
    approvalStatus: string;
  } | null = null;

  if (review?.migrated_content_id) {
    const content = await dbLoadGovernedContentById(review.migrated_content_id);
    if (content) {
      destinationSummary = {
        id: content.id,
        title: content.title,
        approvalStatus: content.approval_status,
      };
    }
  }

  return {
    ...toListItemDto(source, review),
    summary: source.summary,
    category: source.category,
    priority: source.priority,
    startsAt: source.starts_at,
    endsAt: source.ends_at,
    operatorNote: review?.notes ?? null,
    preview: toMigrationPreviewDto(transform),
    destination: destinationSummary,
    governedContentHref: destinationSummary ? "/admin/communications" : null,
  };
}

export async function previewPromotionMigration(input: {
  promotionId: string;
  classification: PromotionMigrationClassification;
}) {
  const source = await loadLegacyPromotionSource(input.promotionId);
  if (!source) {
    return null;
  }

  const transform = transformLegacyPromotionToGovernedDraft({
    source,
    classification: input.classification,
  });

  return toMigrationPreviewDto(transform);
}

export async function updatePromotionMigrationReview(input: {
  promotionId: string;
  reviewerUserId: string;
  classification: PromotionMigrationClassification;
  operatorNote?: string | null;
}) {
  const source = await loadLegacyPromotionSource(input.promotionId);
  if (!source) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const admin = createAdminSupabaseClient();
  const { data: existing } = await admin
    .from("promotion_migration_reviews")
    .select("migrated_content_id")
    .eq("promotion_id", input.promotionId)
    .maybeSingle();

  if (existing && (existing as { migrated_content_id: string | null }).migrated_content_id) {
    return { ok: false as const, reason: "already_migrated" as const };
  }

  const notes = sanitizeOperatorNote(input.operatorNote);

  await admin.from("promotion_migration_reviews").upsert({
    promotion_id: input.promotionId,
    classification: input.classification,
    reviewed_by_user_id: input.reviewerUserId,
    reviewed_at: new Date().toISOString(),
    notes,
  } as never);

  await writeAuditLog({
    userId: input.reviewerUserId,
    action: "legacy_promotion_migration_reviewed",
    entityType: "promotion",
    entityId: input.promotionId,
    metadata: {
      promotion_id: input.promotionId,
      adviser_user_id: input.reviewerUserId,
      action_type: "review_classification",
      result_code: "ok",
      classification: input.classification,
    },
  });

  return { ok: true as const };
}

function migrationAuditAction(outcome: PromotionMigrationOutcome): string {
  if (outcome === "recovered_orphan") {
    return "legacy_promotion_migration_orphan_recovered";
  }
  if (outcome === "already_migrated" || outcome === "reused") {
    return "legacy_promotion_migration_reused";
  }
  if (outcome === "created" || outcome === "review_only") {
    return "legacy_promotion_migration_completed";
  }
  return "legacy_promotion_migration_failed";
}

function migrationResultCode(outcome: PromotionMigrationOutcome): string {
  return outcome;
}

export async function executePromotionMigration(input: {
  promotionId: string;
  reviewerUserId: string;
  classification: PromotionMigrationClassification;
  operatorNote?: string | null;
}): Promise<
  | {
      ok: true;
      contentId: string | null;
      skipped: boolean;
      outcome: PromotionMigrationOutcome;
      alreadyMigrated?: boolean;
      reused?: boolean;
    }
  | {
      ok: false;
      reason: "not_found" | "asset_blocked" | "invalid_classification" | "conflict" | "failed";
      outcome?: PromotionMigrationOutcome;
      message?: string;
      contentId?: string | null;
    }
> {
  const source = await loadLegacyPromotionSource(input.promotionId);
  if (!source) {
    return { ok: false, reason: "not_found" };
  }

  const transform = transformLegacyPromotionToGovernedDraft({
    source,
    classification: input.classification,
  });

  if (
    isMigrationDraftClassification(input.classification) &&
    transform.migrationBlocked
  ) {
    return {
      ok: false,
      reason: "asset_blocked",
      message: assetBlockMessage(transform.assetStatus),
    };
  }

  const atomic = await executeAtomicLegacyPromotionMigration({
    promotionId: input.promotionId,
    classification: input.classification,
    reviewerUserId: input.reviewerUserId,
    operatorNote: sanitizeOperatorNote(input.operatorNote),
    title: transform.title,
    summary: transform.summary,
    body: transform.body,
    category: transform.category,
    contentType: transform.contentType,
    audienceScope: transform.audienceScope,
    externalUrl: transform.externalUrl,
    expiresAt: transform.expiresAt,
    adviserUserId: transform.adviserUserId,
  });

  const auditAction = migrationAuditAction(atomic.outcome);
  const resultCode = migrationResultCode(atomic.outcome);

  await writeAuditLog({
    userId: input.reviewerUserId,
    action: auditAction,
    entityType: "promotion",
    entityId: input.promotionId,
    metadata: {
      promotion_id: input.promotionId,
      adviser_user_id: input.reviewerUserId,
      action_type: isMigrationDraftClassification(input.classification)
        ? "migrate_to_draft"
        : "review_only",
      result_code: resultCode,
      classification: input.classification,
      ...(atomic.contentId ? { migrated_destination_id: atomic.contentId } : {}),
      ...(isMigrationDraftClassification(input.classification)
        ? { asset_status: transform.assetStatus }
        : {}),
    },
  });

  if (!atomic.ok) {
    return {
      ok: false,
      reason: atomic.outcome === "conflict" ? "conflict" : "failed",
      outcome: atomic.outcome,
      message:
        atomic.outcome === "conflict"
          ? "Migration linkage conflict — manual review required"
          : "Migration failed",
      contentId: atomic.contentId ?? null,
    };
  }

  return {
    ok: true,
    contentId: atomic.contentId,
    skipped: atomic.skipped,
    outcome: atomic.outcome,
    alreadyMigrated: atomic.outcome === "already_migrated",
    reused: atomic.reused,
  };
}
