import "server-only";

import { loadGoogleCalendarIntegrationStatus } from "@/lib/crm-v2/google-calendar/service";

import type { ReportCardDto } from "../types";

export async function loadOperationsSummaryReportCards(input: {
  authUserId: string;
  dateRangeLabel: string;
  freshnessAt: string;
}): Promise<{ cards: ReportCardDto[]; failed: boolean }> {
  try {
    const status = await loadGoogleCalendarIntegrationStatus(input.authUserId);
    return {
      cards: [
        {
          reportKey: "google_calendar_sync",
          title: "Google Calendar sync",
          summary: status.connection.connected
            ? "Calendar connected — see Operations for sync health."
            : "Calendar not connected.",
          dateRangeLabel: input.dateRangeLabel,
          safeCount: status.failedSyncCount + status.actionRequiredCount,
          safePercentage: null,
          trendDirection: status.failedSyncCount > 0 ? "up" : "flat",
          sourceModule: "google_calendar",
          routeHref: "/advisor-v2/operations",
          freshnessAt: input.freshnessAt,
          partialDataWarning: false,
        },
        {
          reportKey: "google_calendar_pending",
          title: "Pending sync items",
          summary: "Appointment mappings awaiting sync.",
          dateRangeLabel: input.dateRangeLabel,
          safeCount: status.pendingSyncCount,
          safePercentage: null,
          trendDirection: "unknown",
          sourceModule: "google_calendar",
          routeHref: "/advisor-v2/operations/google-calendar",
          freshnessAt: input.freshnessAt,
          partialDataWarning: false,
        },
      ],
      failed: false,
    };
  } catch {
    return { cards: [], failed: true };
  }
}
