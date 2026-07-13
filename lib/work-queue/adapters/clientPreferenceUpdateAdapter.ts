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

export const clientPreferenceUpdateAdapter: AdviserWorkItemAdapter = {
  sourceType: "client_preference_update",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.clientPreferenceUpdates) {
        if (!allowedClientIds.has(row.clientId)) {
          skipped += 1;
          continue;
        }
        if (row.status !== "pending_review") {
          skipped += 1;
          continue;
        }

        const client = clients.get(row.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const timingResult = normalizeWorkItemTiming({
          dueAt: null,
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
            id: buildDeterministicWorkItemId("client_preference_update", row.id),
            sourceType: "client_preference_update",
            sourceId: row.id,
            clientId: row.clientId,
            clientDisplayName: client.displayName,
            category: "task",
            title: "Client preference update",
            summary: "Client preference update requires adviser review",
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: timingResult.dueAt,
            occurredAt: row.createdAt,
            updatedAt: row.createdAt,
            reasonCodes,
            actionHref: `/advisor-v2/relationships/${row.clientId}/moments?view=client_preferences`,
            sourceStatus: row.status,
            blocking: false,
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.clientPreferenceUpdates.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.clientPreferenceUpdates.length);
    }
  },
};
