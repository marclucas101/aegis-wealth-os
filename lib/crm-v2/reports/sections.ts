import type { ReportSectionDto, ReportSectionKey } from "./types";

export type ReportSectionDefinition = {
  key: ReportSectionKey;
  label: string;
  workspaceHref: string;
  emptyMessage: string;
};

export const REPORT_SECTION_DEFINITIONS: readonly ReportSectionDefinition[] = [
  {
    key: "relationship_coverage",
    label: "Relationship Coverage",
    workspaceHref: "/advisor-v2/relationships",
    emptyMessage: "No relationship coverage metrics for this period.",
  },
  {
    key: "appointments",
    label: "Appointments",
    workspaceHref: "/advisor-v2/appointments",
    emptyMessage: "No appointment activity in this period.",
  },
  {
    key: "service",
    label: "Service",
    workspaceHref: "/advisor-v2/service",
    emptyMessage: "No service commitments or requests in this period.",
  },
  {
    key: "protection",
    label: "Protection",
    workspaceHref: "/advisor-v2/relationships",
    emptyMessage: "No protection verification activity in this period.",
  },
  {
    key: "review_rhythm",
    label: "Review Rhythm",
    workspaceHref: "/advisor-v2/relationships",
    emptyMessage: "No review rhythm signals in this period.",
  },
  {
    key: "communications",
    label: "Communications",
    workspaceHref: "/advisor-v2/communications",
    emptyMessage: "No communications activity in this period.",
  },
  {
    key: "operations_summary",
    label: "Operations Summary",
    workspaceHref: "/advisor-v2/operations",
    emptyMessage: "No operations summary available.",
  },
  {
    key: "work_queue_summary",
    label: "Work Queue Summary",
    workspaceHref: "/advisor-v2/today",
    emptyMessage: "Work queue summary is empty.",
  },
] as const;

export function sectionDefinition(key: ReportSectionKey): ReportSectionDefinition {
  const found = REPORT_SECTION_DEFINITIONS.find((section) => section.key === key);
  if (!found) throw new Error(`Unknown report section: ${key}`);
  return found;
}

export function createEmptyReportSections(dateRangeLabel: string): ReportSectionDto[] {
  return REPORT_SECTION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    workspaceHref: definition.workspaceHref,
    dateRangeLabel,
    cards: [],
    partialFailure: false,
    emptyMessage: definition.emptyMessage,
  }));
}
