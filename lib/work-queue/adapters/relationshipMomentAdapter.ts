import { normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
  type WorkQueueLoadContext,
} from "./types";

export const relationshipMomentAdapter: AdviserWorkItemAdapter = {
  sourceType: "relationship_moment",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.relationshipMoments) {
        if (!allowedClientIds.has(row.clientId)) {
          skipped += 1;
          continue;
        }
        if (!row.requiresAction) {
          skipped += 1;
          continue;
        }

        const client = clients.get(row.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const timingResult = normalizeWorkItemTiming({
          dueAt: row.nextOccurrenceDate,
          now,
          timezone: context.timezone,
        });
        if (!timingResult.ok) {
          skipped += 1;
          continue;
        }

        const reasonCodes: WorkItemReasonCode[] = ["task_open"];
        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId("relationship_moment", row.id),
            sourceType: "relationship_moment",
            sourceId: row.id,
            clientId: row.clientId,
            clientDisplayName: client.displayName,
            category: "task",
            title: row.title,
            summary: "Relationship moment requires adviser action",
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: timingResult.dueAt,
            occurredAt: row.updatedAt,
            updatedAt: row.updatedAt,
            reasonCodes,
            actionHref: `/advisor-v2/relationships/${row.clientId}/moments?momentId=${row.id}`,
            sourceStatus: row.confirmationState,
            blocking: false,
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.relationshipMoments.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.relationshipMoments.length);
    }
  },
};
