import "server-only";

import {
  categoryToContentType,
  stripHtmlTags,
} from "@/lib/communications/contentValidation";
import { validateExternalUrl } from "@/lib/communications/externalLinkValidation";
import type {
  AudienceScope,
  ContentApprovalStatus,
  GovernedContentCategory,
  GovernedContentType,
  PromotionMigrationClassification,
} from "@/lib/communications/types";

import {
  classifyPromotionAssetStatus,
  migrationBlockedByAssetPolicy,
} from "./promotionAssetPolicy";
import type { PromotionAssetStatus } from "./promotionMigrationTypes";
import { isMigrationDraftClassification } from "./promotionMigrationTypes";

export type LegacyPromotionSourceRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string;
  details: string | null;
  category: string;
  cta_label: string | null;
  cta_url: string | null;
  image_url: string | null;
  attachment_url: string | null;
  audience: string;
  status: string;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type GovernedDraftTransformResult = {
  title: string;
  summary: string;
  body: string;
  category: GovernedContentCategory;
  contentType: GovernedContentType;
  audienceScope: AudienceScope;
  approvalStatus: ContentApprovalStatus;
  externalUrl: string | null;
  expiresAt: string | null;
  adviserUserId: string | null;
  warnings: string[];
  omittedFields: string[];
  assetStatus: PromotionAssetStatus;
  migrationBlocked: boolean;
  blockReason: string | null;
};

function parseDetailsHighlights(details: string | null): string[] {
  if (!details?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(details) as { highlights?: unknown; eligibility?: unknown };
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.filter((item): item is string => typeof item === "string")
      : [];
    return highlights.map((item) => stripHtmlTags(item)).filter(Boolean).slice(0, 3);
  } catch {
    return [];
  }
}

function parseEligibility(details: string | null): string | null {
  if (!details?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(details) as { eligibility?: unknown };
    return typeof parsed.eligibility === "string"
      ? stripHtmlTags(parsed.eligibility).slice(0, 180) || null
      : null;
  } catch {
    return null;
  }
}

function resolveGovernedCategory(
  classification: PromotionMigrationClassification,
): GovernedContentCategory {
  if (classification === "market_update_review") {
    return "market_update";
  }
  if (classification === "event") {
    return "event";
  }
  if (classification === "product_promotional") {
    return "financial_education";
  }
  return "financial_education";
}

function buildBody(source: LegacyPromotionSourceRecord): string {
  const parts: string[] = [];
  const subtitle = source.subtitle ? stripHtmlTags(source.subtitle) : "";
  if (subtitle) {
    parts.push(subtitle);
  }

  const highlights = parseDetailsHighlights(source.details);
  if (highlights.length) {
    parts.push(highlights.map((item) => `• ${item}`).join("\n"));
  }

  const eligibility = parseEligibility(source.details);
  if (eligibility) {
    parts.push(`Eligibility: ${eligibility}`);
  }

  return parts.join("\n\n").slice(0, 8000);
}

function resolveExternalUrl(
  ctaUrl: string | null,
  endsAt: string | null,
  warnings: string[],
  omittedFields: string[],
): string | null {
  if (!ctaUrl?.trim()) {
    return null;
  }

  const trimmed = ctaUrl.trim();
  if (endsAt) {
    const end = new Date(endsAt);
    if (!Number.isNaN(end.getTime()) && end < new Date()) {
      omittedFields.push("cta_url");
      warnings.push("Expired call-to-action URL omitted.");
      return null;
    }
  }

  const validation = validateExternalUrl(trimmed);
  if (!validation.ok) {
    omittedFields.push("cta_url");
    warnings.push("Unsupported or invalid external URL omitted.");
    return null;
  }

  return trimmed;
}

export function transformLegacyPromotionToGovernedDraft(input: {
  source: LegacyPromotionSourceRecord;
  classification: PromotionMigrationClassification;
}): GovernedDraftTransformResult {
  const warnings: string[] = [];
  const omittedFields: string[] = ["audience", "priority", "starts_at", "image_url", "attachment_url"];

  const assetStatus = classifyPromotionAssetStatus({
    imagePath: input.source.image_url,
    attachmentPath: input.source.attachment_url,
  });

  const migrationBlocked =
    isMigrationDraftClassification(input.classification) &&
    migrationBlockedByAssetPolicy(assetStatus);

  if (input.source.audience !== "all_users") {
    warnings.push("Legacy audience scope was not migrated; using all_active_clients.");
  }

  const category = resolveGovernedCategory(input.classification);
  const contentType = categoryToContentType(category);
  const externalUrl = resolveExternalUrl(
    input.source.cta_url,
    input.source.ends_at,
    warnings,
    omittedFields,
  );

  return {
    title: stripHtmlTags(input.source.title).slice(0, 120),
    summary: stripHtmlTags(input.source.summary).slice(0, 400),
    body: buildBody(input.source),
    category,
    contentType,
    audienceScope: "all_active_clients",
    approvalStatus: "draft",
    externalUrl,
    expiresAt: input.source.ends_at,
    adviserUserId: input.source.created_by,
    warnings,
    omittedFields,
    assetStatus,
    migrationBlocked,
    blockReason: migrationBlocked
      ? "Legacy promotion assets require manual review before migration."
      : null,
  };
}

export function toMigrationPreviewDto(transform: GovernedDraftTransformResult) {
  return {
    destinationContentType: transform.contentType,
    destinationCategory: transform.category,
    title: transform.title,
    summary: transform.summary,
    bodyPreview: transform.body.slice(0, 500),
    audienceScope: transform.audienceScope,
    initialLifecycleState: transform.approvalStatus,
    assetStatus: transform.assetStatus,
    warnings: transform.warnings,
    omittedFields: transform.omittedFields,
    migrationBlocked: transform.migrationBlocked,
    blockReason: transform.blockReason,
  };
}
