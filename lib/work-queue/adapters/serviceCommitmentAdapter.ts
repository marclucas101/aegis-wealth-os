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

const OPEN_STATUSES = new Set([
  "open",
  "in_progress",
  "waiting_on_client",
  "waiting_on_adviser",
  "blocked",
]);

export const serviceCommitmentAdapter: AdviserWorkItemAdapter = {
  sourceType: "service_commitment",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.serviceCommitments) {
        if (!allowedClientIds.has(row.clientId)) {
          skipped += 1;
          continue;
        }
        if (!OPEN_STATUSES.has(row.lifecycleStatus)) {
          skipped += 1;
          continue;
        }
        if (row.owner === "client" && row.lifecycleStatus === "waiting_on_client") {
          skipped += 1;
          continue;
        }

        const client = clients.get(row.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const timingResult = normalizeWorkItemTiming({
          dueAt: row.dueAt,
          now,
          timezone: context.timezone,
        });
        if (!timingResult.ok) {
          skipped += 1;
          continue;
        }

        const reasonCodes: WorkItemReasonCode[] = ["task_open"];
        if (timingResult.timing === "overdue") reasonCodes.push("task_overdue");
        if (row.lifecycleStatus === "waiting_on_adviser") {
          reasonCodes.push("task_overdue");
        }

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId("service_commitment", row.id),
            sourceType: "service_commitment",
            sourceId: row.id,
            clientId: row.clientId,
            clientDisplayName: client.displayName,
            category: "task",
            title: row.title,
            summary: row.commitmentType.replace(/_/g, " "),
            actionOwner: row.owner === "client" ? "client" : "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: timingResult.timing === "overdue" ? "high" : "normal",
            dueAt: timingResult.dueAt,
            occurredAt: null,
            updatedAt: row.updatedAt,
            reasonCodes,
            actionHref: "/advisor-v2/service?view=commitments",
            sourceStatus: row.lifecycleStatus,
            blocking: timingResult.timing === "overdue",
            dismissible: false,
          metadata: {
            relatedSourceType: row.sourceType as import("../sourceRegistry").WorkItemSourceType | undefined,
            relatedSourceId: row.sourceId ?? undefined,
          },
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.serviceCommitments.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.serviceCommitments.length);
    }
  },
};
