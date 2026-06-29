import { diffDaysFromNow, normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

const QUEUE_PUBLICATION_STATUSES = new Set(["draft", "adviser_reviewed"]);

export const planningOutputAdapter: AdviserWorkItemAdapter = {
  sourceType: "planning_output",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const output of context.batchData.planningOutputs) {
        if (!allowedClientIds.has(output.clientId)) {
          skipped += 1;
          continue;
        }
        if (!QUEUE_PUBLICATION_STATUSES.has(output.publicationStatus)) {
          skipped += 1;
          continue;
        }

        const client = clients.get(output.clientId);
        if (!client) continue;

        const ageDays = diffDaysFromNow(output.updatedAt, now);
        const isStaleUnpublished =
          output.publicationStatus === "draft" &&
          ageDays !== null &&
          ageDays >= context.limits.unpublishedDraftAgingDays;

        const reasonCodes: WorkItemReasonCode[] = [];
        if (output.publicationStatus === "draft") {
          reasonCodes.push(
            isStaleUnpublished ? "planning_stale_unpublished" : "planning_draft_pending",
          );
        } else {
          reasonCodes.push("planning_publish_pending");
        }

        const timingResult = normalizeWorkItemTiming({
          dueAt: null,
          now,
          timezone: context.timezone,
        });

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId("planning_output", output.id),
            sourceType: "planning_output",
            sourceId: output.id,
            clientId: output.clientId,
            clientDisplayName: client.displayName,
            category: "planning",
            title: "Planning output awaiting publication",
            summary: output.outputType.replace(/_/g, " "),
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.ok ? timingResult.timing : "unscheduled",
            priority: "normal",
            dueAt: null,
            occurredAt: output.createdAt,
            updatedAt: output.updatedAt,
            reasonCodes,
            actionHref: workQueueRoutes.clientPlanningOutputs(
              output.clientId,
              output.outputType,
            ),
            sourceStatus: output.publicationStatus,
            blocking: false,
            dismissible: false,
            metadata: { outputType: output.outputType },
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.planningOutputs.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.planningOutputs.length);
    }
  },
};
