import "server-only";

import { CRM_V2_TODAY_PATH } from "@/lib/crm-v2/navigation";
import { loadAdviserTodayProjection } from "@/lib/crm-v2/today/projection";

import type { OperationsPanelDto } from "../types";

export async function loadTodaySourcesOperationsPanels(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  freshnessAt: string;
}): Promise<OperationsPanelDto[]> {
  const today = await loadAdviserTodayProjection({
    authUserId: input.authUserId,
    userRole: input.userRole,
  });

  if (!today.ok) {
    return [
      {
        panelKey: "today_sources_unavailable",
        title: "Today projection",
        summary: "Today source health could not be determined.",
        statusLevel: "warning",
        safeCount: null,
        sourceModule: "today",
        routeHref: CRM_V2_TODAY_PATH,
        actionLabel: "Open Today",
        freshnessAt: input.freshnessAt,
        partialDataWarning: true,
      },
    ];
  }

  const failures = today.data.sourceFailures;
  if (failures.length === 0) {
    return [
      {
        panelKey: "today_sources_healthy",
        title: "Today sources",
        summary: "All Today source adapters loaded successfully.",
        statusLevel: "healthy",
        safeCount: today.data.sections.reduce((sum, section) => sum + section.cards.length, 0),
        sourceModule: "today",
        routeHref: CRM_V2_TODAY_PATH,
        actionLabel: "Open Today",
        freshnessAt: input.freshnessAt,
        partialDataWarning: false,
      },
    ];
  }

  return failures.map((failure) => ({
    panelKey: `today_source_${failure.sourceKey}`,
    title: `Today source: ${failure.sourceKey}`,
    summary: failure.safeMessage,
    statusLevel: "warning" as const,
    safeCount: null,
    sourceModule: "today",
    routeHref: CRM_V2_TODAY_PATH,
    actionLabel: "Open Today",
    freshnessAt: input.freshnessAt,
    partialDataWarning: true,
  }));
}
