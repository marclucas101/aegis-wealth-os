import "server-only";

import type { OperationsPanelDto } from "../types";

/** Migration status is manual-runbook driven — no Supabase CLI at runtime. */
export function loadMigrationDiagnosticsPanels(freshnessAt: string): OperationsPanelDto[] {
  return [
    {
      panelKey: "migration_manual_runbook",
      title: "Migration apply status",
      summary: "Migrations are applied by operators via runbook — not from this UI.",
      statusLevel: "unknown",
      safeCount: null,
      sourceModule: "migration",
      routeHref: null,
      actionLabel: "See CRM_V2_PHASE_12_MIGRATION_RUNBOOK.md",
      freshnessAt,
      partialDataWarning: false,
    },
    {
      panelKey: "migration_diagnostics_sql",
      title: "Diagnostic SQL",
      summary: "Preflight, verify and discrepancy scripts under supabase/diagnostics/.",
      statusLevel: "healthy",
      safeCount: null,
      sourceModule: "migration",
      routeHref: null,
      actionLabel: "Run diagnostics manually",
      freshnessAt,
      partialDataWarning: false,
    },
    {
      panelKey: "migration_phase12_pending",
      title: "Phase 12 migration",
      summary: "202606290019 feature-control seeds — disabled by default, unapplied until operator action.",
      statusLevel: "attention",
      safeCount: null,
      sourceModule: "migration",
      routeHref: null,
      actionLabel: "Dry-run only",
      freshnessAt,
      partialDataWarning: false,
    },
  ];
}
