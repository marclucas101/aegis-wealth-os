import { isReviewQueueEligible, resolveCanonicalServicingState } from "../servicingState";
import { normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

export const reviewDueAdapter: AdviserWorkItemAdapter = {
  sourceType: "review_due",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const review of context.batchData.reviewClients) {
        if (!allowedClientIds.has(review.clientId)) {
          skipped += 1;
          continue;
        }

        const client = clients.get(review.clientId);
        if (!client) {
          skipped += 1;
          continue;
        }

        const servicing = resolveCanonicalServicingState({
          status: client.status,
          relationshipStage: client.relationshipStage,
        });
        if (!isReviewQueueEligible(servicing.canonical)) {
          skipped += 1;
          continue;
        }

        const isOverdue =
          review.servicingState === "overdue" || review.servicingState === "review_due";
        if (!isOverdue && review.servicingState !== "high_priority") {
          skipped += 1;
          continue;
        }

        const dueAt = review.nextRecommendedReviewDate;
        if (!dueAt && review.servicingState !== "overdue") {
          skipped += 1;
          continue;
        }

        const timingResult = normalizeWorkItemTiming({
          dueAt,
          now,
          timezone: context.timezone,
        });
        if (!timingResult.ok) {
          skipped += 1;
          continue;
        }

        const reasonCodes: WorkItemReasonCode[] = [];
        if (review.servicingState === "overdue" || timingResult.timing === "overdue") {
          reasonCodes.push("review_overdue");
        } else if (!dueAt) {
          reasonCodes.push("review_missing_date");
        } else {
          reasonCodes.push("review_due_soon");
        }

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId(
              "review_due",
              review.clientId,
              `review:${review.servicingState}`,
            ),
            sourceType: "review_due",
            sourceId: review.clientId,
            clientId: review.clientId,
            clientDisplayName: client.displayName,
            category: "review",
            title: "Client review due",
            summary: review.recommendedNextAction || null,
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: timingResult.dueAt,
            occurredAt: review.lastAnnualReviewDate,
            updatedAt: null,
            reasonCodes,
            actionHref: workQueueRoutes.clientShieldReview(review.clientId),
            sourceStatus: review.servicingState,
            blocking: false,
            dismissible: false,
            metadata: {},
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.reviewClients.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.reviewClients.length);
    }
  },
};
