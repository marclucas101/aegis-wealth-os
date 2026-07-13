import type { CRM_V2_REPORTS_MAX_DAYS } from "@/lib/crm-v2/constants";

export const REPORT_SECTION_KEYS = [
  "relationship_coverage",
  "appointments",
  "service",
  "protection",
  "review_rhythm",
  "communications",
  "operations_summary",
  "work_queue_summary",
] as const;

export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number];

export type ReportTrendDirection = "up" | "down" | "flat" | "unknown";

export type ReportCardDto = {
  reportKey: string;
  title: string;
  summary: string;
  dateRangeLabel: string;
  safeCount: number | null;
  safePercentage: number | null;
  trendDirection: ReportTrendDirection;
  sourceModule: string;
  routeHref: string;
  freshnessAt: string;
  partialDataWarning: boolean;
};

export type ReportSectionDto = {
  key: ReportSectionKey;
  label: string;
  workspaceHref: string;
  dateRangeLabel: string;
  cards: ReportCardDto[];
  partialFailure: boolean;
  emptyMessage: string;
};

export type AdviserReportsProjectionDto = {
  generatedAt: string;
  requestId: string;
  dateRange: {
    from: string;
    to: string;
    days: number;
    maxDays: typeof CRM_V2_REPORTS_MAX_DAYS;
  };
  sections: ReportSectionDto[];
  sourceFailures: ReportSourceFailureDto[];
  adminScopeDeferred: boolean;
};

export type ReportSourceFailureDto = {
  sourceKey: string;
  safeMessage: string;
};

export type CrmReportsResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "forbidden" | "not_found" };
