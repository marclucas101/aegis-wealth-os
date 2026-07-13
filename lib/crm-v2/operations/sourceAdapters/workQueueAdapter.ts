import "server-only";

import { buildAdviserWorkQueue } from "@/lib/work-queue/buildAdviserWorkQueue";

import type { OperationsPanelDto } from "../types";

export async function loadWorkQueueOperationsPanels(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  freshnessAt: string;
}): Promise<OperationsPanelDto[]> {
  const queue = await buildAdviserWorkQueue({
    authUserId: input.authUserId,
    userRole: input.userRole,
    nowIso: input.freshnessAt,
  });

  const failedAdapters = queue.adapterStatus.filter((status) => !status.ok);
  const deferred = queue.adapterStatus.some((status) =>
    status.warningCodes?.includes("admin_scope_deferred"),
  );

  const adapterPanels: OperationsPanelDto[] = queue.adapterStatus.slice(0, 6).map((adapter) => ({
    panelKey: `work_queue_adapter_${adapter.sourceType}`,
    title: `${adapter.sourceType.replace(/_/g, " ")} adapter`,
    summary: adapter.ok
      ? `${adapter.itemCount} virtual item(s) projected.`
      : "Adapter could not load completely.",
    statusLevel: adapter.ok ? ("healthy" as const) : ("warning" as const),
    safeCount: adapter.itemCount,
    sourceModule: "work_queue",
    routeHref: "/advisor-v2/today",
    actionLabel: "Open Today",
    freshnessAt: input.freshnessAt,
    partialDataWarning: !adapter.ok,
  }));

  if (deferred) {
    adapterPanels.unshift({
      panelKey: "work_queue_admin_deferred",
      title: "Admin scope",
      summary: "Book-wide work queue is deferred for admin users.",
      statusLevel: "attention",
      safeCount: null,
      sourceModule: "work_queue",
      routeHref: "/advisor-v2/today",
      actionLabel: null,
      freshnessAt: input.freshnessAt,
      partialDataWarning: false,
    });
  }

  if (failedAdapters.length > 0) {
    adapterPanels.unshift({
      panelKey: "work_queue_adapter_failures",
      title: "Adapter failures",
      summary: `${failedAdapters.length} source adapter(s) reported partial failure.`,
      statusLevel: "warning",
      safeCount: failedAdapters.length,
      sourceModule: "work_queue",
      routeHref: "/advisor-v2/today",
      actionLabel: "Review Today",
      freshnessAt: input.freshnessAt,
      partialDataWarning: true,
    });
  }

  return adapterPanels;
}
