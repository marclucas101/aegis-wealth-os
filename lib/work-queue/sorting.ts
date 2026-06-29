import {
  prioritySortWeight,
  stateSortWeight,
  timingSortWeight,
} from "./priority";
import type { AdviserWorkItem, WorkItemState } from "./types";

const STATE_ACTION_ORDER: Record<WorkItemState, number> = {
  actionable: 4,
  blocked: 5,
  waiting: 3,
  informational: 2,
  completed: 1,
};

function dueTimestamp(item: AdviserWorkItem): number {
  if (!item.dueAt) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(item.dueAt).getTime();
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function updatedTimestamp(item: AdviserWorkItem): number {
  if (!item.updatedAt) return 0;
  const parsed = new Date(item.updatedAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Stable deterministic ordering for adviser work queue items.
 */
export function sortWorkItems(items: AdviserWorkItem[]): AdviserWorkItem[] {
  return [...items].sort((a, b) => {
    const stateDelta =
      (STATE_ACTION_ORDER[b.state] ?? 0) - (STATE_ACTION_ORDER[a.state] ?? 0);
    if (stateDelta !== 0) return stateDelta;

    const blockingDelta = Number(b.blocking) - Number(a.blocking);
    if (blockingDelta !== 0) return blockingDelta;

    const priorityDelta =
      prioritySortWeight(b.priority) - prioritySortWeight(a.priority);
    if (priorityDelta !== 0) return priorityDelta;

    const timingDelta = timingSortWeight(b.timing) - timingSortWeight(a.timing);
    if (timingDelta !== 0) return timingDelta;

    const dueDelta = dueTimestamp(a) - dueTimestamp(b);
    if (dueDelta !== 0) return dueDelta;

    const updatedDelta = updatedTimestamp(b) - updatedTimestamp(a);
    if (updatedDelta !== 0) return updatedDelta;

    return a.id.localeCompare(b.id);
  });
}

export function applyWorkQueueItemLimit(
  items: AdviserWorkItem[],
  maxItems: number,
): AdviserWorkItem[] {
  if (items.length <= maxItems) return items;
  return items.slice(0, maxItems);
}

export function stateSortWeightForTest(state: WorkItemState): number {
  return stateSortWeight(state);
}
