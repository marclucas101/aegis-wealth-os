import { normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
  type WorkQueueLoadContext,
} from "./types";

const ACTIVE_TASK_STATUSES = new Set(["open", "in_progress"]); // excludes completed, cancelled

export const advisorTaskAdapter: AdviserWorkItemAdapter = {
  sourceType: "advisor_task",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const task of context.batchData.tasks) {
        if (!task.clientId || !allowedClientIds.has(task.clientId)) {
          skipped += 1;
          continue;
        }
        if (!ACTIVE_TASK_STATUSES.has(task.status)) {
          skipped += 1;
          continue;
        }

        const client = clients.get(task.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const timingResult = normalizeWorkItemTiming({
          dueAt: task.dueDate,
          now,
          timezone: context.timezone,
        });
        if (!timingResult.ok) {
          skipped += 1;
          continue;
        }

        const reasonCodes: WorkItemReasonCode[] = [];
        if (timingResult.timing === "overdue") reasonCodes.push("task_overdue");
        else if (timingResult.timing === "due_today") reasonCodes.push("task_due_today");
        else reasonCodes.push("task_open");

        const item: AdviserWorkItem = applyPriorityToItem({
          id: buildDeterministicWorkItemId("advisor_task", task.id),
          sourceType: "advisor_task",
          sourceId: task.id,
          clientId: task.clientId,
          clientDisplayName: client.displayName,
          category: "task",
          title: task.title,
          summary: task.description,
          actionOwner: "adviser",
          state: normalizeWorkItemState({}),
          timing: timingResult.timing,
          priority: "normal",
          dueAt: timingResult.dueAt,
          occurredAt: null,
          updatedAt: task.updatedAt,
          reasonCodes,
          actionHref: workQueueRoutes.clientTasks(task.clientId),
          sourceStatus: task.status,
          blocking: timingResult.timing === "overdue" && task.priority === "urgent",
          dismissible: false,
          metadata: {
            relatedSourceType:
              task.relatedEntityType?.includes("roadmap") ? "roadmap_item" : undefined,
            relatedSourceId: task.relatedEntityId ?? undefined,
          },
        });

        items.push(item);
      }

      return {
        items,
        sourceCount: context.batchData.tasks.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.tasks.length);
    }
  },
};

export function loadAdvisorTaskAdapter(context: WorkQueueLoadContext) {
  return advisorTaskAdapter.load(context);
}
