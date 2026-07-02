import { normalizeWorkItemState } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId } from "../routes";
import type { AdviserWorkItem } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
  type WorkQueueLoadContext,
} from "./types";

const ADVISER_ACTION_STATUSES = new Set([
  "submitted",
  "acknowledged",
  "in_progress",
  "waiting_on_client",
]);

export const clientServiceRequestAdapter: AdviserWorkItemAdapter = {
  sourceType: "client_service_request",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.clientServiceRequests) {
        if (!allowedClientIds.has(row.clientId)) {
          skipped += 1;
          continue;
        }
        if (!ADVISER_ACTION_STATUSES.has(row.lifecycleStatus)) {
          skipped += 1;
          continue;
        }

        const client = clients.get(row.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const item: AdviserWorkItem = applyPriorityToItem({
          id: buildDeterministicWorkItemId("client_service_request", row.id),
          sourceType: "client_service_request",
          sourceId: row.id,
          clientId: row.clientId,
          clientDisplayName: client.displayName,
          category: "task",
          title: row.summary,
          summary: row.requestCategory.replace(/_/g, " "),
          actionOwner: "adviser",
          state: normalizeWorkItemState({}),
          timing: "not_applicable",
          priority: row.urgency === "high" ? "high" : "normal",
          dueAt: null,
          occurredAt: row.createdAt,
          updatedAt: row.updatedAt,
          reasonCodes: ["task_open"],
          actionHref: "/advisor-v2/service?view=client_requests",
          sourceStatus: row.lifecycleStatus,
          blocking: row.urgency === "high",
          dismissible: false,
          metadata: {},
        });

        items.push(item);
      }

      return {
        items,
        sourceCount: context.batchData.clientServiceRequests.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.clientServiceRequests.length);
    }
  },
};
