import type { AdviserWorkQueueResult } from "@/lib/work-queue/types";

import { CRM_V2_TODAY_WORK_QUEUE_PANEL_ITEMS } from "./constants";
import { buildTodayCardRouteHref } from "./routes";
import type { TodayWorkQueuePanelDto } from "./types";

/** Read-only work-queue panel — virtual, non-authoritative. */
export function buildTodayWorkQueuePanel(
  queue: AdviserWorkQueueResult,
): TodayWorkQueuePanelDto {
  const actionable = queue.items.filter((item) => item.state !== "completed");
  const topItems = actionable.slice(0, CRM_V2_TODAY_WORK_QUEUE_PANEL_ITEMS).map((item) => ({
    id: item.id,
    title: item.title,
    clientDisplayName: item.clientDisplayName,
    routeHref: buildTodayCardRouteHref({
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      relationshipId: item.clientId,
      metadataAppointmentId: item.metadata.appointmentId,
    }),
    timing: item.timing,
  }));

  return {
    generatedAt: queue.generatedAt,
    itemCount: actionable.length,
    overdueCount: queue.summary.overdue,
    topItems,
    readOnly: true,
  };
}
