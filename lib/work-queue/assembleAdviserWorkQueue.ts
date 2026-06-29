import { WORK_QUEUE_ADAPTERS } from "./adapters";
import type { WorkQueueLoadContext } from "./adapters/types";
import { deduplicateWorkItems } from "./deduplication";
import { applyPriorityToItem } from "./priority";
import { applyWorkQueueItemLimit, sortWorkItems } from "./sorting";
import type { AdviserWorkQueueResult, SafeAdapterStatus } from "./types";

function buildSummary(items: AdviserWorkQueueResult["items"]) {
  const clientIds = new Set<string>();
  let critical = 0;
  let high = 0;
  let overdue = 0;
  let blocked = 0;

  for (const item of items) {
    clientIds.add(item.clientId);
    if (item.priority === "critical") critical += 1;
    if (item.priority === "high") high += 1;
    if (item.timing === "overdue") overdue += 1;
    if (item.blocking || item.state === "blocked") blocked += 1;
  }

  return {
    total: items.length,
    critical,
    high,
    overdue,
    blocked,
    clientsAffected: clientIds.size,
  };
}

/**
 * Pure assembly from preloaded context — deterministic, no I/O.
 */
export function assembleAdviserWorkQueue(
  context: WorkQueueLoadContext,
): AdviserWorkQueueResult {
  const adapterStatus: SafeAdapterStatus[] = [];
  const collected = [];

  for (const adapter of WORK_QUEUE_ADAPTERS) {
    const result = adapter.load(context);
    adapterStatus.push({
      sourceType: adapter.sourceType,
      ok: !result.warningCodes.includes("adapter_error"),
      itemCount: result.items.length,
      sourceCount: result.sourceCount,
      skippedCount: result.skippedCount,
      warningCodes: result.warningCodes,
    });
    collected.push(...result.items.map(applyPriorityToItem));
  }

  const deduped = deduplicateWorkItems(collected);
  const sorted = sortWorkItems(deduped.items);
  const limited = applyWorkQueueItemLimit(sorted, context.limits.maxItems);

  return {
    generatedAt: context.nowIso,
    items: limited,
    summary: buildSummary(limited),
    adapterStatus,
  };
}
