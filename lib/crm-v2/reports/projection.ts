import "server-only";

import {
  CRM_V2_REPORTS_DEFAULT_DAYS,
  CRM_V2_REPORTS_MAX_CARDS_PER_SECTION,
  CRM_V2_REPORTS_MAX_DAYS,
} from "@/lib/crm-v2/constants";

import { createEmptyReportSections, sectionDefinition } from "./sections";
import { loadAppointmentReportCards } from "./sourceAdapters/appointmentsAdapter";
import { loadCommunicationsReportCards } from "./sourceAdapters/communicationsAdapter";
import { loadOperationsSummaryReportCards } from "./sourceAdapters/operationsSummaryAdapter";
import { loadProtectionReportCards } from "./sourceAdapters/protectionAdapter";
import { loadRelationshipCoverageReportCards } from "./sourceAdapters/relationshipsAdapter";
import { loadReviewRhythmReportCards } from "./sourceAdapters/reviewRhythmAdapter";
import { loadServiceReportCards } from "./sourceAdapters/serviceAdapter";
import { loadWorkQueueSummaryReportCards } from "./sourceAdapters/workQueueAdapter";
import type {
  AdviserReportsProjectionDto,
  CrmReportsResult,
  ReportCardDto,
  ReportSectionDto,
  ReportSectionKey,
  ReportSourceFailureDto,
} from "./types";
import { REPORT_SECTION_KEYS } from "./types";

export type LoadAdviserReportsProjectionInput = {
  authUserId: string;
  userRole: "advisor" | "admin";
  requestId: string;
  days?: number;
  timezone?: string;
};

function clampDays(days: number | undefined): number {
  const raw = days ?? CRM_V2_REPORTS_DEFAULT_DAYS;
  return Math.min(CRM_V2_REPORTS_MAX_DAYS, Math.max(1, raw));
}

function buildDateRange(days: number, timezone: string): {
  from: string;
  to: string;
  fromIso: string;
  toIso: string;
  label: string;
} {
  const now = new Date();
  const toIso = now.toISOString();
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  const fromIso = from.toISOString();
  const formatter = new Intl.DateTimeFormat("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
  const label = `${formatter.format(from)} – ${formatter.format(now)}`;
  return {
    from: fromIso.slice(0, 10),
    to: toIso.slice(0, 10),
    fromIso,
    toIso,
    label,
  };
}

function applySectionCards(
  sections: ReportSectionDto[],
  key: ReportSectionKey,
  cards: ReportCardDto[],
  partialFailure: boolean,
): ReportSectionDto[] {
  const definition = sectionDefinition(key);
  const bounded = cards.slice(0, CRM_V2_REPORTS_MAX_CARDS_PER_SECTION);
  return sections.map((section) =>
    section.key === key
      ? {
          ...section,
          cards: bounded,
          partialFailure: partialFailure || bounded.length === 0,
          emptyMessage: bounded.length === 0 ? definition.emptyMessage : section.emptyMessage,
        }
      : section,
  );
}

/**
 * Central server-only reports projection. Read-only; no persisted report authority.
 */
export async function loadAdviserReportsProjection(
  input: LoadAdviserReportsProjectionInput,
): Promise<CrmReportsResult<AdviserReportsProjectionDto>> {
  const timezone = input.timezone ?? "Asia/Singapore";
  const days = clampDays(input.days);
  const range = buildDateRange(days, timezone);
  const generatedAt = new Date().toISOString();
  const sourceFailures: ReportSourceFailureDto[] = [];
  let sections = createEmptyReportSections(range.label);

  if (input.userRole !== "advisor") {
    return {
      ok: true,
      data: {
        generatedAt,
        requestId: input.requestId,
        dateRange: { from: range.from, to: range.to, days, maxDays: CRM_V2_REPORTS_MAX_DAYS },
        sections,
        sourceFailures: [
          {
            sourceKey: "admin_scope",
            safeMessage: "Book-wide reports are deferred for admin — adviser assignment required.",
          },
        ],
        adminScopeDeferred: true,
      },
    };
  }

  const adapterInput = {
    authUserId: input.authUserId,
    dateRangeLabel: range.label,
    freshnessAt: generatedAt,
    fromIso: range.fromIso,
    toIso: range.toIso,
  };

  try {
    const cards = await loadRelationshipCoverageReportCards(adapterInput);
    sections = applySectionCards(sections, "relationship_coverage", cards, cards.some((c) => c.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "relationships", safeMessage: "Relationship coverage could not be loaded." });
    sections = applySectionCards(sections, "relationship_coverage", [], true);
  }

  try {
    const cards = await loadAppointmentReportCards(adapterInput);
    sections = applySectionCards(sections, "appointments", cards, cards.some((c) => c.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "appointments", safeMessage: "Appointment activity could not be loaded." });
    sections = applySectionCards(sections, "appointments", [], true);
  }

  try {
    const cards = await loadServiceReportCards(adapterInput);
    sections = applySectionCards(sections, "service", cards, cards.some((c) => c.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "service", safeMessage: "Service metrics could not be loaded." });
    sections = applySectionCards(sections, "service", [], true);
  }

  try {
    const cards = await loadProtectionReportCards({
      authUserId: input.authUserId,
      dateRangeLabel: range.label,
      freshnessAt: generatedAt,
    });
    sections = applySectionCards(sections, "protection", cards, cards.some((c) => c.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "protection", safeMessage: "Protection status could not be loaded." });
    sections = applySectionCards(sections, "protection", [], true);
  }

  try {
    const cards = await loadReviewRhythmReportCards({
      authUserId: input.authUserId,
      dateRangeLabel: range.label,
      freshnessAt: generatedAt,
      toIso: range.toIso,
    });
    sections = applySectionCards(sections, "review_rhythm", cards, cards.some((c) => c.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "review_rhythm", safeMessage: "Review rhythm could not be loaded." });
    sections = applySectionCards(sections, "review_rhythm", [], true);
  }

  try {
    const cards = await loadCommunicationsReportCards(adapterInput);
    sections = applySectionCards(sections, "communications", cards, cards.some((c) => c.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "communications", safeMessage: "Communications activity could not be loaded." });
    sections = applySectionCards(sections, "communications", [], true);
  }

  try {
    const result = await loadOperationsSummaryReportCards({
      authUserId: input.authUserId,
      dateRangeLabel: range.label,
      freshnessAt: generatedAt,
    });
    if (result.failed) {
      sourceFailures.push({ sourceKey: "operations_summary", safeMessage: "Operations summary could not be loaded." });
    }
    sections = applySectionCards(sections, "operations_summary", result.cards, result.failed);
  } catch {
    sourceFailures.push({ sourceKey: "operations_summary", safeMessage: "Operations summary could not be loaded." });
    sections = applySectionCards(sections, "operations_summary", [], true);
  }

  try {
    const result = await loadWorkQueueSummaryReportCards({
      authUserId: input.authUserId,
      userRole: input.userRole,
      dateRangeLabel: range.label,
      freshnessAt: generatedAt,
      timezone,
    });
    if (result.failed) {
      sourceFailures.push({ sourceKey: "work_queue", safeMessage: "Work queue summary could not be loaded." });
    }
    sections = applySectionCards(sections, "work_queue_summary", result.cards, result.failed);
  } catch {
    sourceFailures.push({ sourceKey: "work_queue", safeMessage: "Work queue summary could not be loaded." });
    sections = applySectionCards(sections, "work_queue_summary", [], true);
  }

  return {
    ok: true,
    data: {
      generatedAt,
      requestId: input.requestId,
      dateRange: { from: range.from, to: range.to, days, maxDays: CRM_V2_REPORTS_MAX_DAYS },
      sections,
      sourceFailures,
      adminScopeDeferred: false,
    },
  };
}

export async function loadAdviserReportsSection(
  input: LoadAdviserReportsProjectionInput & { sectionKey: ReportSectionKey },
): Promise<CrmReportsResult<ReportSectionDto>> {
  if (!REPORT_SECTION_KEYS.includes(input.sectionKey)) {
    return { ok: false, reason: "not_found" };
  }

  const projection = await loadAdviserReportsProjection(input);
  if (!projection.ok) return projection;

  const section = projection.data.sections.find((item) => item.key === input.sectionKey);
  if (!section) return { ok: false, reason: "not_found" };

  return { ok: true, data: section };
}
