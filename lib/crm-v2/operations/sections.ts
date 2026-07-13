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
    workspaceHref: "/advisor-v2/settings/integrations/google-calendar",
    emptyMessage: "No Google Calendar status available.",
  },
  {
    key: "communications",
    label: "Communications",
    workspaceHref: "/advisor-v2/communications",
    emptyMessage: "No communication exceptions in this scope.",
  },
  {
    key: "work_queue",
    label: "Work Queue",
    workspaceHref: "/advisor-v2/today",
    emptyMessage: "Work queue adapter health unavailable.",
  },
  {
    key: "today_sources",
    label: "Today Sources",
    workspaceHref: "/advisor-v2/today",
    emptyMessage: "Today source adapter health unavailable.",
  },
  {
    key: "protection_extraction",
    label: "Protection Extraction",
    workspaceHref: "/advisor-v2/relationships",
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
