import "server-only";

import { buildAdviserWorkQueue } from "@/lib/work-queue/buildAdviserWorkQueue";

import type { ReportCardDto } from "../types";

export async function loadWorkQueueSummaryReportCards(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  dateRangeLabel: string;
  freshnessAt: string;
  timezone?: string;
}): Promise<{ cards: ReportCardDto[]; failed: boolean }> {
  try {
    const queue = await buildAdviserWorkQueue({
      authUserId: input.authUserId,
      userRole: input.userRole,
      timezone: input.timezone,
    });

    const failedAdapters = queue.adapterStatus.filter((status) => !status.ok).length;

    return {
      cards: [
        {
          reportKey: "work_queue_total",
          title: "Virtual queue items",
          summary: "Read-only projection from authoritative sources — not persisted.",
          dateRangeLabel: input.dateRangeLabel,
          safeCount: queue.summary.total,
          safePercentage: null,
          trendDirection: "unknown",
          sourceModule: "work_queue",
          routeHref: "/advisor-v2/today",
          freshnessAt: input.freshnessAt,
          partialDataWarning: failedAdapters > 0,
        },
        {
          reportKey: "work_queue_overdue",
          title: "Overdue items",
          summary: "Queue items past due — lifecycle ordering only, no sales priority.",
          dateRangeLabel: input.dateRangeLabel,
          safeCount: queue.summary.overdue,
          safePercentage: null,
          trendDirection: queue.summary.overdue > 0 ? "up" : "flat",
          sourceModule: "work_queue",
          routeHref: "/advisor-v2/today",
          freshnessAt: input.freshnessAt,
          partialDataWarning: false,
        },
        {
          reportKey: "work_queue_clients",
          title: "Clients affected",
          summary: "Distinct clients represented in the virtual queue.",
          dateRangeLabel: input.dateRangeLabel,
          safeCount: queue.summary.clientsAffected,
          safePercentage: null,
          trendDirection: "unknown",
          sourceModule: "work_queue",
          routeHref: "/advisor-v2/today",
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
