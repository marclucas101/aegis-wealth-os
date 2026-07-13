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

const REVIEW_STATUSES = new Set(["provisional", "awaiting_review"]);

export const protectionExtractionAdapter: AdviserWorkItemAdapter = {
  sourceType: "protection_extraction",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.protectionExtractions) {
        if (!allowedClientIds.has(row.clientId)) {
          skipped += 1;
          continue;
        }
        if (!REVIEW_STATUSES.has(row.reviewStatus)) {
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
            id: buildDeterministicWorkItemId("protection_extraction", row.id),
            sourceType: "protection_extraction",
            sourceId: row.id,
            clientId: row.clientId,
            clientDisplayName: client.displayName,
            category: "task",
            title: row.title,
            summary: "Provisional protection extraction awaiting verification",
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: timingResult.dueAt,
            occurredAt: row.createdAt,
            updatedAt: row.createdAt,
            reasonCodes,
            actionHref: `/advisor-v2/relationships/${row.clientId}/protection?extractionId=${row.id}`,
            sourceStatus: row.reviewStatus,
            blocking: false,
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.protectionExtractions.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.protectionExtractions.length);
    }
  },
};
