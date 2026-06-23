import "server-only";

import {
  FINANCIAL_READINESS_SNAPSHOT_ALLOWLIST,
  sanitizeFinancialReadinessPayload,
} from "@/lib/compliance/clientSafeDtos";
import { isCurrentPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import type { PublishedOutputRow } from "@/lib/supabase/compliancePublication";

import { BINDER_SENSITIVE_MARKERS } from "./binderRedactionFixtures";
import {
  BINDER_MAX_TABLE_ROWS,
  BINDER_MAX_TEXT_LENGTH,
  type BinderPdfCard,
  type BinderPdfChapter,
  type BinderPdfRenderModel,
  type BinderPdfTable,
  type BinderPdfTableRow,
} from "./binderPdfTypes";

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bS\d{7}[A-Z]\b/i,
  /\b\d{8,}\b/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /clients\/[0-9a-f-]{36}\//i,
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  /<[^>]+>/,
];

const BLOCKED_KEYS = new Set([
  "nric",
  "nric_fin",
  "identity_number",
  "account_number",
  "accountNumber",
  "policy_number",
  "policyNumber",
  "email",
  "phone",
  "storage_path",
  "storage_bucket",
  "file_path",
  "rawShieldScore",
  "adjustedShieldScore",
  "shield",
  "pillarScores",
  "awri",
  "internalNotes",
  "adviserNotes",
  "complianceNotes",
  "provider_credentials",
  "html",
  "raw",
  "diagnostic",
]);

function capText(value: string, max = BINDER_MAX_TEXT_LENGTH): string {
  const stripped = value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max - 1)}…`;
}

function scrubString(value: string): string {
  let result = capText(value);
  for (const marker of BINDER_SENSITIVE_MARKERS) {
    result = result.split(marker).join("[redacted]");
  }
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[redacted]");
  }
  return result;
}

function assertAllowlistedObject(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) continue;
    if (!allowedKeys.has(key)) continue;
    out[key] = value[key];
  }
  return out;
}

export function redactPublishedPayload(
  row: PublishedOutputRow,
): Record<string, unknown> {
  if (row.output_audience === "adviser_internal") {
    throw new Error("Adviser-internal output blocked");
  }
  if (!isCurrentPublishedOutput(row)) {
    throw new Error("Publication not current");
  }

  if (
    row.output_type === "financial_readiness_snapshot" ||
    row.output_type === "financial_overview"
  ) {
    const sanitized = sanitizeFinancialReadinessPayload({
      ...row.safe_payload,
    });
    const allowlisted: Record<string, unknown> = {};
    for (const key of FINANCIAL_READINESS_SNAPSHOT_ALLOWLIST) {
      if (key in sanitized) {
        allowlisted[key] = (sanitized as Record<string, unknown>)[key];
      }
    }
    return allowlisted;
  }

  return assertAllowlistedObject(row.safe_payload, new Set([
    "summary",
    "headline",
    "description",
    "highlights",
    "priorities",
    "items",
    "milestones",
    "sections",
    "notes",
    "title",
    "body",
    "dataAsAt",
    "reviewDate",
    "nextReviewDate",
  ]));
}

export function buildRedactedTable(
  headings: string[],
  rows: string[][],
): BinderPdfTable {
  return {
    headings: headings.map((h) => scrubString(h)),
    rows: rows.slice(0, BINDER_MAX_TABLE_ROWS).map((cells) => ({
      cells: cells.map((c) => scrubString(c)),
    })),
    repeatHeadings: true,
  };
}

export function buildRedactedCard(title: string, body: string): BinderPdfCard {
  return {
    title: scrubString(title),
    body: scrubString(body),
    keepTogether: true,
  };
}

export function buildRedactedChapter(
  chapter: BinderPdfChapter,
): BinderPdfChapter {
  return {
    ...chapter,
    title: scrubString(chapter.title),
    paragraphs: chapter.paragraphs.map((p) => scrubString(p)),
    cards: chapter.cards?.map((card) => buildRedactedCard(card.title, card.body)),
    table: chapter.table
      ? {
          headings: chapter.table.headings.map((h) => scrubString(h)),
          rows: chapter.table.rows.slice(0, BINDER_MAX_TABLE_ROWS).map(
            (row: BinderPdfTableRow) => ({
              cells: row.cells.map((c) => scrubString(c)),
            }),
          ),
          repeatHeadings: chapter.table.repeatHeadings ?? true,
        }
      : undefined,
  };
}

export function buildRedactedRenderModel(
  model: BinderPdfRenderModel,
): BinderPdfRenderModel {
  return {
    schemaVersion: model.schemaVersion,
    confidentialityFooter: scrubString(model.confidentialityFooter),
    cover: {
      clientDisplayName: scrubString(model.cover.clientDisplayName),
      adviserDisplayName: scrubString(model.cover.adviserDisplayName),
      meetingDateLabel: model.cover.meetingDateLabel
        ? scrubString(model.cover.meetingDateLabel)
        : null,
      generatedDateLabel: scrubString(model.cover.generatedDateLabel),
      subtitle: scrubString(model.cover.subtitle),
    },
    chapters: model.chapters.map((chapter) => buildRedactedChapter(chapter)),
  };
}

export function collectRenderableText(model: BinderPdfRenderModel): string {
  const parts: string[] = [
    model.cover.clientDisplayName,
    model.cover.adviserDisplayName,
    model.cover.subtitle,
    model.confidentialityFooter,
    ...model.chapters.flatMap((chapter) => [
      chapter.title,
      ...chapter.paragraphs,
      ...(chapter.cards?.flatMap((c) => [c.title, c.body]) ?? []),
      ...(chapter.table?.headings ?? []),
      ...(chapter.table?.rows.flatMap((r) => r.cells) ?? []),
    ]),
  ];
  return parts.join("\n");
}

export function assertNoSensitiveMarkersInText(text: string): void {
  for (const marker of BINDER_SENSITIVE_MARKERS) {
    if (text.includes(marker)) {
      throw new Error(`Sensitive marker leaked: ${marker}`);
    }
  }
}

export function assertRenderModelSafe(model: BinderPdfRenderModel): void {
  const redacted = buildRedactedRenderModel(model);
  assertNoSensitiveMarkersInText(collectRenderableText(redacted));
}
