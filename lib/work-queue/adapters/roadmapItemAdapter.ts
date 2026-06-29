import { normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

const ACTIONABLE_ROADMAP_STATUSES = new Set(["not_started", "in_progress"]); // excludes completed

export const roadmapItemAdapter: AdviserWorkItemAdapter = {
  sourceType: "roadmap_item",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.roadmapItems) {
        if (!allowedClientIds.has(row.clientId)) {
          skipped += 1;
          continue;
        }
        if (!ACTIONABLE_ROADMAP_STATUSES.has(row.status)) {
          skipped += 1;
          continue;
        }

        const client = clients.get(row.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const actionOwner =
          row.taskOwner === "client"
            ? row.clientVisible
              ? "client"
              : "adviser"
            : "adviser";

        const waitingOnClient =
          row.taskOwner === "client" && row.clientVisible && row.status === "not_started";

        const reasonCodes: WorkItemReasonCode[] = [];
        if (waitingOnClient) reasonCodes.push("roadmap_waiting_client");
        else if (row.status === "in_progress") reasonCodes.push("roadmap_in_progress");
        else reasonCodes.push("roadmap_not_started");

        const timingResult = normalizeWorkItemTiming({
          dueAt: null,
          now,
          timezone: context.timezone,
        });

        const item: AdviserWorkItem = applyPriorityToItem({
          id: buildDeterministicWorkItemId("roadmap_item", row.id),
          sourceType: "roadmap_item",
          sourceId: row.id,
          clientId: row.clientId,
          clientDisplayName: client.displayName,
          category: "roadmap",
          title: row.title,
          summary: null,
          actionOwner: actionOwner === "client" ? "client" : "adviser",
          state: normalizeWorkItemState({ waitingOnClient }),
          timing: timingResult.ok ? timingResult.timing : "unscheduled",
          priority: "normal",
          dueAt: null,
          occurredAt: null,
          updatedAt: row.updatedAt,
          reasonCodes,
          actionHref: workQueueRoutes.clientRoadmap(row.clientId),
          sourceStatus: row.status,
          blocking: false,
          dismissible: false,
          metadata: {},
        });

        items.push(item);
      }

      return {
        items,
        sourceCount: context.batchData.roadmapItems.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.roadmapItems.length);
    }
  },
};
