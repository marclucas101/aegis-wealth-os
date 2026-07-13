import "server-only";

import { CRM_V2_OPERATIONS_MAX_PANELS_PER_SECTION } from "@/lib/crm-v2/constants";

import { createEmptyOperationsSections, operationsSectionDefinition } from "./sections";
import { loadCommunicationsOperationsPanels } from "./sourceAdapters/communicationsAdapter";
import { loadCrmV2FeatureControlStatus } from "./sourceAdapters/featureControlsAdapter";
import { loadGoogleCalendarOperationsPanels } from "./sourceAdapters/googleCalendarAdapter";
import { loadManualAcceptancePanels } from "./sourceAdapters/manualAcceptanceAdapter";
import { loadMigrationDiagnosticsPanels } from "./sourceAdapters/migrationDiagnosticsAdapter";
import { loadProtectionExtractionOperationsPanels } from "./sourceAdapters/protectionExtractionAdapter";
import { loadSecurityBoundariesPanels } from "./sourceAdapters/securityBoundariesAdapter";
import { loadTodaySourcesOperationsPanels } from "./sourceAdapters/todaySourcesAdapter";
import { loadWorkQueueOperationsPanels } from "./sourceAdapters/workQueueAdapter";
import type {
  AdviserOperationsProjectionDto,
  CrmOperationsResult,
  OperationsPanelDto,
  OperationsSectionDto,
  OperationsSectionKey,
  OperationsSourceFailureDto,
} from "./types";
import { OPERATIONS_SECTION_KEYS } from "./types";

export type LoadAdviserOperationsProjectionInput = {
  authUserId: string;
  userRole: "advisor" | "admin";
  requestId: string;
};

function applySectionPanels(
  sections: OperationsSectionDto[],
  key: OperationsSectionKey,
  panels: OperationsPanelDto[],
  partialFailure: boolean,
  extra?: Partial<OperationsSectionDto>,
): OperationsSectionDto[] {
  const definition = operationsSectionDefinition(key);
  const bounded = panels.slice(0, CRM_V2_OPERATIONS_MAX_PANELS_PER_SECTION);
  return sections.map((section) =>
    section.key === key
      ? {
          ...section,
          ...extra,
          panels: bounded,
          partialFailure: partialFailure || bounded.length === 0,
          emptyMessage: bounded.length === 0 ? definition.emptyMessage : section.emptyMessage,
        }
      : section,
  );
}

function collectActionRequiredPanels(sections: OperationsSectionDto[], freshnessAt: string): OperationsPanelDto[] {
  const actions: OperationsPanelDto[] = [];

  for (const section of sections) {
    for (const panel of section.panels) {
      if (
        panel.statusLevel === "warning" ||
        panel.statusLevel === "attention" ||
        (panel.safeCount !== null && panel.safeCount > 0 && panel.panelKey.includes("failed"))
      ) {
        actions.push({
          ...panel,
          panelKey: `action_${panel.panelKey}`,
          title: `Action: ${panel.title}`,
          actionLabel: panel.actionLabel ?? "Review",
        });
      }
    }
  }

  if (actions.length === 0) {
    actions.push({
      panelKey: "action_none",
      title: "No actions required",
      summary: "All monitored sources are within normal bounds.",
      statusLevel: "healthy",
      safeCount: 0,
      sourceModule: "operations",
      routeHref: null,
      actionLabel: null,
      freshnessAt,
      partialDataWarning: false,
    });
  }

  return actions.slice(0, CRM_V2_OPERATIONS_MAX_PANELS_PER_SECTION);
}

/**
 * Central server-only operations projection. Read-only except existing approved workflows linked from panels.
 */
export async function loadAdviserOperationsProjection(
  input: LoadAdviserOperationsProjectionInput,
): Promise<CrmOperationsResult<AdviserOperationsProjectionDto>> {
  const generatedAt = new Date().toISOString();
  const sourceFailures: OperationsSourceFailureDto[] = [];
  let sections = createEmptyOperationsSections();
  let environmentWarnings: string[] = [];
  const adminScopeDeferred = input.userRole !== "advisor";

  try {
    const featureControls = await loadCrmV2FeatureControlStatus();
    sections = applySectionPanels(sections, "feature_controls", [], false, { featureControls });
  } catch {
    sourceFailures.push({ sourceKey: "feature_controls", safeMessage: "Feature controls could not be loaded." });
    sections = applySectionPanels(sections, "feature_controls", [], true);
  }

  try {
    const panels = loadMigrationDiagnosticsPanels(generatedAt);
    sections = applySectionPanels(sections, "migration_diagnostics", panels, false);
  } catch {
    sourceFailures.push({ sourceKey: "migration", safeMessage: "Migration diagnostics could not be loaded." });
    sections = applySectionPanels(sections, "migration_diagnostics", [], true);
  }

  if (adminScopeDeferred) {
    sourceFailures.push({
      sourceKey: "admin_scope",
      safeMessage: "Adviser-scoped operations panels are deferred for admin book-wide view.",
    });
  } else {
    try {
      const panels = await loadGoogleCalendarOperationsPanels({
        authUserId: input.authUserId,
        freshnessAt: generatedAt,
      });
      sections = applySectionPanels(sections, "google_calendar", panels, false);
    } catch {
      sourceFailures.push({ sourceKey: "google_calendar", safeMessage: "Google Calendar status could not be loaded." });
      sections = applySectionPanels(sections, "google_calendar", [], true);
    }

    try {
      const panels = await loadCommunicationsOperationsPanels({
        authUserId: input.authUserId,
        freshnessAt: generatedAt,
      });
      sections = applySectionPanels(sections, "communications", panels, panels.some((p) => p.partialDataWarning));
    } catch {
      sourceFailures.push({ sourceKey: "communications", safeMessage: "Communications exceptions could not be loaded." });
      sections = applySectionPanels(sections, "communications", [], true);
    }

    try {
      const panels = await loadProtectionExtractionOperationsPanels({
        authUserId: input.authUserId,
        freshnessAt: generatedAt,
      });
      sections = applySectionPanels(sections, "protection_extraction", panels, panels.some((p) => p.partialDataWarning));
    } catch {
      sourceFailures.push({ sourceKey: "protection", safeMessage: "Protection extraction status could not be loaded." });
      sections = applySectionPanels(sections, "protection_extraction", [], true);
    }
  }

  try {
    const panels = await loadWorkQueueOperationsPanels({
      authUserId: input.authUserId,
      userRole: input.userRole,
      freshnessAt: generatedAt,
    });
    sections = applySectionPanels(sections, "work_queue", panels, panels.some((p) => p.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "work_queue", safeMessage: "Work queue health could not be loaded." });
    sections = applySectionPanels(sections, "work_queue", [], true);
  }

  try {
    const panels = await loadTodaySourcesOperationsPanels({
      authUserId: input.authUserId,
      userRole: input.userRole,
      freshnessAt: generatedAt,
    });
    sections = applySectionPanels(sections, "today_sources", panels, panels.some((p) => p.partialDataWarning));
  } catch {
    sourceFailures.push({ sourceKey: "today", safeMessage: "Today source health could not be loaded." });
    sections = applySectionPanels(sections, "today_sources", [], true);
  }

  try {
    const security = loadSecurityBoundariesPanels(generatedAt);
    environmentWarnings = security.environmentWarnings;
    sections = applySectionPanels(sections, "security_boundaries", security.panels, security.environmentWarnings.length > 0);
  } catch {
    sourceFailures.push({ sourceKey: "security", safeMessage: "Security boundary status could not be loaded." });
    sections = applySectionPanels(sections, "security_boundaries", [], true);
  }

  try {
    const panels = loadManualAcceptancePanels(generatedAt);
    sections = applySectionPanels(sections, "manual_acceptance", panels, false);
  } catch {
    sections = applySectionPanels(sections, "manual_acceptance", [], true);
  }

  const actionPanels = collectActionRequiredPanels(sections, generatedAt);
  sections = applySectionPanels(sections, "action_required", actionPanels, false);

  return {
    ok: true,
    data: {
      generatedAt,
      requestId: input.requestId,
      sections,
      sourceFailures,
      environmentWarnings,
      adminScopeDeferred,
    },
  };
}

export async function loadAdviserOperationsSection(
  input: LoadAdviserOperationsProjectionInput & { sectionKey: OperationsSectionKey },
): Promise<CrmOperationsResult<OperationsSectionDto>> {
  if (!OPERATIONS_SECTION_KEYS.includes(input.sectionKey)) {
    return { ok: false, reason: "not_found" };
  }

  const projection = await loadAdviserOperationsProjection(input);
  if (!projection.ok) return projection;

  const section = projection.data.sections.find((item) => item.key === input.sectionKey);
  if (!section) return { ok: false, reason: "not_found" };

  return { ok: true, data: section };
}
