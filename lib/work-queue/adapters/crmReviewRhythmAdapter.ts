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

export const crmReviewRhythmAdapter: AdviserWorkItemAdapter = {
  sourceType: "crm_review_rhythm",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.crmReviewRhythms) {
        if (!allowedClientIds.has(row.clientId)) {
          skipped += 1;
          continue;
        }
        if (row.status !== "overdue" && row.status !== "scheduled") {
          skipped += 1;
          continue;
        }

        const client = clients.get(row.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const timingResult = normalizeWorkItemTiming({
          dueAt: row.nextDueDate,
          now,
          timezone: context.timezone,
        });
        if (!timingResult.ok) {
          skipped += 1;
          continue;
        }

        const reasonCodes: WorkItemReasonCode[] =
          row.status === "overdue" ? ["review_overdue"] : ["review_due_soon"];
        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId("crm_review_rhythm", row.id),
            sourceType: "crm_review_rhythm",
            sourceId: row.id,
            clientId: row.clientId,
            clientDisplayName: client.displayName,
            category: "review",
            title: row.title,
            summary:
              row.status === "overdue"
                ? "Review rhythm overdue"
                : "Upcoming review scheduled",
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: timingResult.dueAt,
            occurredAt: row.updatedAt,
            updatedAt: row.updatedAt,
            reasonCodes,
            actionHref: `/advisor-v2/relationships/${row.clientId}/moments?view=review_rhythm`,
            sourceStatus: row.status,
            blocking: false,
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.crmReviewRhythms.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.crmReviewRhythms.length);
    }
  },
};
