import "server-only";

import { CRM_V2_PILOT_USER_IDS_ENV } from "@/lib/crm-v2/constants";
import { parsePilotAllowlistFromEnv } from "@/lib/crm-v2/pilotConfig";

import type { OperationsPanelDto } from "../types";

export function loadSecurityBoundariesPanels(freshnessAt: string): {
  panels: OperationsPanelDto[];
  environmentWarnings: string[];
} {
  const environmentWarnings: string[] = [];
  const allowlist = parsePilotAllowlistFromEnv();

  if (!allowlist.ok) {
    environmentWarnings.push("CRM V2 pilot allowlist is not configured.");
  }

  if (!process.env[CRM_V2_PILOT_USER_IDS_ENV]?.trim()) {
    environmentWarnings.push(`${CRM_V2_PILOT_USER_IDS_ENV} is empty — pilot gate will fail closed.`);
  }

  const panels: OperationsPanelDto[] = [
    {
      panelKey: "security_pilot_allowlist",
      title: "Pilot allowlist",
      summary: allowlist.ok
        ? "Pilot allowlist is configured (contents not exposed)."
        : "Pilot allowlist is missing or invalid.",
      statusLevel: allowlist.ok ? "healthy" : "warning",
      safeCount: allowlist.ok ? allowlist.userIds.size : null,
      sourceModule: "security",
      routeHref: null,
      actionLabel: null,
      freshnessAt,
      partialDataWarning: !allowlist.ok,
    },
    {
      panelKey: "security_assignment_scope",
      title: "Assignment scope",
      summary: "Adviser operations are scoped to session identity — no browser-supplied adviser ID.",
      statusLevel: "healthy",
      safeCount: null,
      sourceModule: "security",
      routeHref: null,
      actionLabel: null,
      freshnessAt,
      partialDataWarning: false,
    },
    {
      panelKey: "security_fail_closed",
      title: "Fail-closed gates",
      summary: "Feature-disabled state performs no business loading.",
      statusLevel: "healthy",
      safeCount: null,
      sourceModule: "security",
      routeHref: null,
      actionLabel: null,
      freshnessAt,
      partialDataWarning: false,
    },
  ];

  return { panels, environmentWarnings };
}
