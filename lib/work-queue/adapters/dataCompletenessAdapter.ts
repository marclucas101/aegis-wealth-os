import { normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

function mapGapToReason(gap: string): WorkItemReasonCode {
  const lower = gap.toLowerCase();
  if (lower.includes("document")) return "missing_supporting_document";
  if (lower.includes("discover") || lower.includes("profile")) {
    return "missing_required_data";
  }
  return "missing_required_data";
}

export const dataCompletenessAdapter: AdviserWorkItemAdapter = {
  sourceType: "data_completeness",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;
      let sourceCount = 0;

      for (const client of context.clients) {
        const scoped = clients.get(client.id);
        if (!scoped) continue;
        const quality = context.batchData.fileQualityByClientId[client.id];
        if (!quality) continue;
        sourceCount += 1;

        const gaps =
          quality.criticalGaps.length > 0
            ? quality.criticalGaps
            : quality.missingItems.slice(0, 2);
        if (gaps.length === 0) {
          skipped += 1;
          continue;
        }

        for (const gap of gaps) {
          const isDocumentGap = gap.toLowerCase().includes("document");
          const sourceType = isDocumentGap ? "document_follow_up" : "data_completeness";
          const reasonCode = mapGapToReason(gap);
          const checklistItemId = gap.toLowerCase().replace(/\s+/g, "_").slice(0, 48);

          const timingResult = normalizeWorkItemTiming({
            dueAt: null,
            now,
            timezone: context.timezone,
          });

          items.push(
            applyPriorityToItem({
              id: buildDeterministicWorkItemId(
                sourceType,
                client.id,
                checklistItemId,
              ),
              sourceType,
              sourceId: checklistItemId,
              clientId: client.id,
              clientDisplayName: scoped.displayName,
              category: isDocumentGap ? "document" : "data_quality",
              title: isDocumentGap ? "Document follow-up required" : "Data completeness gap",
              summary: gap,
              actionOwner: reasonCode === "missing_supporting_document" ? "shared" : "adviser",
              state: normalizeWorkItemState({}),
              timing: timingResult.ok ? timingResult.timing : "unscheduled",
              priority: "normal",
              dueAt: null,
              occurredAt: null,
              updatedAt: null,
              reasonCodes: [reasonCode],
              actionHref: isDocumentGap
                ? workQueueRoutes.clientDocumentVault(client.id)
                : workQueueRoutes.clientOverview(client.id),
              sourceStatus: "gap_detected",
              blocking: false,
              dismissible: false,
              metadata: { checklistItemId },
            }),
          );
        }
      }

      return {
        items,
        sourceCount,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(Object.keys(context.batchData.fileQualityByClientId).length);
    }
  },
};
