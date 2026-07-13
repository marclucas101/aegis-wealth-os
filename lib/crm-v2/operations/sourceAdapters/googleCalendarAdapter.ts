import "server-only";

import {
  CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
  CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
} from "@/lib/crm-v2/navigation";
import { loadGoogleCalendarIntegrationStatus } from "@/lib/crm-v2/google-calendar/service";

import type { OperationsPanelDto } from "../types";

export async function loadGoogleCalendarOperationsPanels(input: {
  authUserId: string;
  freshnessAt: string;
}): Promise<OperationsPanelDto[]> {
  const status = await loadGoogleCalendarIntegrationStatus(input.authUserId);

  const panels: OperationsPanelDto[] = [
    {
      panelKey: "google_calendar_connection",
      title: "Connection",
      summary: status.connection.connected ? "Google Calendar connected." : "Not connected.",
      statusLevel: status.connection.connected ? "healthy" : "attention",
      safeCount: null,
      sourceModule: "google_calendar",
      routeHref: CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
      actionLabel: status.connection.connected ? "Manage connection" : "Connect calendar",
      freshnessAt: input.freshnessAt,
      partialDataWarning: false,
    },
    {
      panelKey: "google_calendar_failed_sync",
      title: "Failed sync mappings",
      summary: "Appointment sync failures — tokens and raw provider errors are not shown.",
      statusLevel: status.failedSyncCount > 0 ? "warning" : "healthy",
      safeCount: status.failedSyncCount,
      sourceModule: "google_calendar",
      routeHref: CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
      actionLabel: "View sync status",
      freshnessAt: input.freshnessAt,
      partialDataWarning: false,
    },
    {
      panelKey: "google_calendar_action_required",
      title: "Action required",
      summary: "Mappings needing adviser action.",
      statusLevel: status.actionRequiredCount > 0 ? "attention" : "healthy",
      safeCount: status.actionRequiredCount,
      sourceModule: "google_calendar",
      routeHref: CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH,
      actionLabel: "Review mappings",
      freshnessAt: input.freshnessAt,
      partialDataWarning: false,
    },
  ];

  return panels;
}
