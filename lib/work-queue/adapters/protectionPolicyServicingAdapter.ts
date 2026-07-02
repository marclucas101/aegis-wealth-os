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

export const protectionPolicyServicingAdapter: AdviserWorkItemAdapter = {
  sourceType: "protection_policy_servicing",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const row of context.batchData.protectionPolicyServicing) {
        if (!allowedClientIds.has(row.clientId)) {
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

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId("protection_policy_servicing", row.id),
            sourceType: "protection_policy_servicing",
            sourceId: row.id,
            clientId: row.clientId,
            clientDisplayName: client.displayName,
            category: "task",
            title: row.title,
            summary: row.servicingReason.replace(/_/g, " "),
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: timingResult.timing === "overdue" ? "high" : "normal",
            dueAt: timingResult.dueAt,
            occurredAt: row.dueAt,
            updatedAt: row.dueAt ?? context.nowIso,
            reasonCodes,
            actionHref: `/advisor-v2/relationships/${row.clientId}/protection`,
            sourceStatus: row.servicingReason,
            blocking: timingResult.timing === "overdue",
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.protectionPolicyServicing.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.protectionPolicyServicing.length);
    }
  },
};
