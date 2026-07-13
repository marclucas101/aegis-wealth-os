import {
  CRM_V2_APPOINTMENTS_PATH,
  CRM_V2_COMMUNICATIONS_PATH,
  CRM_V2_OPERATIONS_PATH,
  CRM_V2_RELATIONSHIPS_PATH,
  CRM_V2_SERVICE_PATH,
  CRM_V2_TODAY_PATH,
} from "@/lib/crm-v2/navigation";

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
    workspaceHref: CRM_V2_RELATIONSHIPS_PATH,
    emptyMessage: "No relationship coverage metrics for this period.",
  },
  {
    key: "appointments",
    label: "Appointments",
    workspaceHref: CRM_V2_APPOINTMENTS_PATH,
    emptyMessage: "No appointment activity in this period.",
  },
  {
    key: "service",
    label: "Service",
    workspaceHref: CRM_V2_SERVICE_PATH,
    emptyMessage: "No service commitments or requests in this period.",
  },
  {
    key: "protection",
    label: "Protection",
    workspaceHref: CRM_V2_RELATIONSHIPS_PATH,
    emptyMessage: "No protection verification activity in this period.",
  },
  {
    key: "review_rhythm",
    label: "Review Rhythm",
    workspaceHref: CRM_V2_RELATIONSHIPS_PATH,
    emptyMessage: "No review rhythm signals in this period.",
  },
  {
    key: "communications",
    label: "Communications",
    workspaceHref: CRM_V2_COMMUNICATIONS_PATH,
    emptyMessage: "No communications activity in this period.",
  },
  {
    key: "operations_summary",
    label: "Operations Summary",
    workspaceHref: CRM_V2_OPERATIONS_PATH,
    emptyMessage: "No operations summary available.",
  },
  {
    key: "work_queue_summary",
    label: "Work Queue Summary",
    workspaceHref: CRM_V2_TODAY_PATH,
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
