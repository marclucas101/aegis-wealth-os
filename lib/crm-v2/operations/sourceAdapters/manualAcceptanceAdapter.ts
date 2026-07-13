import "server-only";

import type { OperationsPanelDto } from "../types";

export function loadManualAcceptancePanels(freshnessAt: string): OperationsPanelDto[] {
  return [
    {
      panelKey: "manual_acceptance_phase12",
      title: "Phase 12 manual tests",
      summary: "47 manual acceptance checks documented — runtime tests not auto-passed.",
      statusLevel: "attention",
      safeCount: 47,
      sourceModule: "manual_acceptance",
      routeHref: null,
      actionLabel: "See CRM_V2_PHASE_12_MANUAL_TESTS.md",
      freshnessAt,
      partialDataWarning: false,
    },
    {
      panelKey: "manual_acceptance_features_disabled",
      title: "Features remain disabled",
      summary: "crm_v2_reports and crm_v2_operations default disabled until operator activation.",
      statusLevel: "healthy",
      safeCount: null,
      sourceModule: "manual_acceptance",
      routeHref: null,
      actionLabel: null,
      freshnessAt,
      partialDataWarning: false,
    },
  ];
}
