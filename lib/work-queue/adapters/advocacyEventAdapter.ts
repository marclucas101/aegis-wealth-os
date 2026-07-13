import { normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

/** Action-based advocacy queue projection — never uses advocacy score for priority. */
export const advocacyEventAdapter: AdviserWorkItemAdapter = {
  sourceType: "advocacy_event",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.advocacyEvents) {
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
          dueAt: row.nextFollowUpDate,
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
            id: buildDeterministicWorkItemId("advocacy_event", row.id),
            sourceType: "advocacy_event",
            sourceId: row.id,
            clientId: row.clientId,
            clientDisplayName: client.displayName,
            category: "task",
            title: row.safeTitle,
            summary: "Advocacy follow-up requires adviser action",
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: timingResult.dueAt,
            occurredAt: row.updatedAt,
            updatedAt: row.updatedAt,
            reasonCodes,
            actionHref: `/advisor-v2/relationships/${row.clientId}/advocacy?eventId=${row.id}`,
            sourceStatus: row.followUpStatus,
            blocking: false,
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.advocacyEvents.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.advocacyEvents.length);
    }
  },
};
