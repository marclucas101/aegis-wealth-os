import { normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

export const binderExportAdapter: AdviserWorkItemAdapter = {
  sourceType: "binder_export",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const binder of context.batchData.binderExports) {
        if (!allowedClientIds.has(binder.clientId)) {
          skipped += 1;
          continue;
        }
        if (binder.generationStatus !== "failed") {
          skipped += 1;
          continue;
        }

        const client = clients.get(binder.clientId);
        if (!client) continue;

        const timingResult = normalizeWorkItemTiming({
          dueAt: null,
          now,
          timezone: context.timezone,
        });

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId("binder_export", binder.id),
            sourceType: "binder_export",
            sourceId: binder.id,
            clientId: binder.clientId,
            clientDisplayName: client.displayName,
            category: "binder",
            title: "Binder generation failed",
            summary: binder.generationErrorCode
              ? `Error code: ${binder.generationErrorCode}`
              : "Retry binder generation from meeting packs",
            actionOwner: "adviser",
            state: normalizeWorkItemState({ blocking: true }),
            timing: timingResult.ok ? timingResult.timing : "unscheduled",
            priority: "normal",
            dueAt: null,
            occurredAt: null,
            updatedAt: binder.updatedAt,
            reasonCodes: ["binder_generation_failed"],
            actionHref: workQueueRoutes.clientMeetingPacks(binder.clientId),
            sourceStatus: binder.generationStatus,
            blocking: true,
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.binderExports.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.binderExports.length);
    }
  },
};
