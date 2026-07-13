export const OPERATIONS_SECTION_KEYS = [
  "feature_controls",
  "migration_diagnostics",
  "google_calendar",
  "communications",
  "work_queue",
  "today_sources",
  "protection_extraction",
  "security_boundaries",
  "manual_acceptance",
  "action_required",
] as const;

export type OperationsSectionKey = (typeof OPERATIONS_SECTION_KEYS)[number];

export type OperationsStatusLevel = "healthy" | "attention" | "warning" | "unknown";

export type OperationsPanelDto = {
  panelKey: string;
  title: string;
  summary: string;
  statusLevel: OperationsStatusLevel;
  safeCount: number | null;
  sourceModule: string;
  routeHref: string | null;
  actionLabel: string | null;
  freshnessAt: string;
  partialDataWarning: boolean;
};

export type FeatureControlStatusDto = {
  featureKey: string;
  enabled: boolean;
  adviserVisible: boolean;
  clientVisible: boolean;
  pilotRequired: boolean;
  description: string | null;
  lastUpdatedAt: string | null;
};

export type OperationsSectionDto = {
  key: OperationsSectionKey;
  label: string;
  workspaceHref: string | null;
  panels: OperationsPanelDto[];
  featureControls?: FeatureControlStatusDto[];
  partialFailure: boolean;
  emptyMessage: string;
};

export type AdviserOperationsProjectionDto = {
  generatedAt: string;
  requestId: string;
  sections: OperationsSectionDto[];
  sourceFailures: OperationsSourceFailureDto[];
  environmentWarnings: string[];
  adminScopeDeferred: boolean;
};

export type OperationsSourceFailureDto = {
  sourceKey: string;
  safeMessage: string;
};

export type CrmOperationsResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "forbidden" | "not_found" };
