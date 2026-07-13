import {
  CRM_V2_COMMUNICATIONS_PATH,
  CRM_V2_RELATIONSHIPS_PATH,
  CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
  CRM_V2_TODAY_PATH,
} from "@/lib/crm-v2/navigation";

import type { OperationsSectionDto, OperationsSectionKey } from "./types";

export type OperationsSectionDefinition = {
  key: OperationsSectionKey;
  label: string;
  workspaceHref: string | null;
  emptyMessage: string;
};

export const OPERATIONS_SECTION_DEFINITIONS: readonly OperationsSectionDefinition[] = [
  {
    key: "feature_controls",
    label: "Feature Controls",
    workspaceHref: null,
    emptyMessage: "No CRM V2 feature controls available.",
  },
  {
    key: "migration_diagnostics",
    label: "Migration and Diagnostics",
    workspaceHref: null,
    emptyMessage: "Migration status is manual-runbook driven.",
  },
  {
    key: "google_calendar",
    label: "Google Calendar",
    workspaceHref: CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
    emptyMessage: "No Google Calendar status available.",
  },
  {
    key: "communications",
    label: "Communications",
    workspaceHref: CRM_V2_COMMUNICATIONS_PATH,
    emptyMessage: "No communication exceptions in this scope.",
  },
  {
    key: "work_queue",
    label: "Work Queue",
    workspaceHref: CRM_V2_TODAY_PATH,
    emptyMessage: "Work queue adapter health unavailable.",
  },
  {
    key: "today_sources",
    label: "Today Sources",
    workspaceHref: CRM_V2_TODAY_PATH,
    emptyMessage: "Today source adapter health unavailable.",
  },
  {
    key: "protection_extraction",
    label: "Protection Extraction",
    workspaceHref: CRM_V2_RELATIONSHIPS_PATH,
    emptyMessage: "No protection extraction exceptions.",
  },
  {
    key: "security_boundaries",
    label: "Security Boundaries",
    workspaceHref: null,
    emptyMessage: "Security boundary checks unavailable.",
  },
  {
    key: "manual_acceptance",
    label: "Manual Acceptance",
    workspaceHref: null,
    emptyMessage: "Manual acceptance checklist not loaded.",
  },
  {
    key: "action_required",
    label: "Action Required",
    workspaceHref: null,
    emptyMessage: "No actions required at this time.",
  },
] as const;

export function operationsSectionDefinition(key: OperationsSectionKey): OperationsSectionDefinition {
  const found = OPERATIONS_SECTION_DEFINITIONS.find((section) => section.key === key);
  if (!found) throw new Error(`Unknown operations section: ${key}`);
  return found;
}

export function createEmptyOperationsSections(): OperationsSectionDto[] {
  return OPERATIONS_SECTION_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    workspaceHref: definition.workspaceHref,
    panels: [],
    partialFailure: false,
    emptyMessage: definition.emptyMessage,
  }));
}
