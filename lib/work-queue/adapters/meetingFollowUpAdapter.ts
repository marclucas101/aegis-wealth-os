import { hoursUntil, normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

export const meetingFollowUpAdapter: AdviserWorkItemAdapter = {
  sourceType: "meeting_follow_up",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const appt of context.batchData.appointments) {
        if (!allowedClientIds.has(appt.clientId)) continue;
        if (appt.status !== "pending" && appt.status !== "confirmed") continue;

        const hours = hoursUntil(appt.startsAt, now);
        if (hours === null || hours < 0 || hours > context.limits.preparationLeadHours) {
          continue;
        }

        const hasPrepOutput = context.batchData.planningOutputs.some(
          (output) =>
            output.clientId === appt.clientId &&
            (output.publicationStatus === "draft" ||
              output.publicationStatus === "adviser_reviewed") &&
            (output.outputType === "meeting_summary" ||
              output.outputType === "meeting_presentation" ||
              output.outputType === "client_plan_summary"),
        );

        const hasPreparedSession = context.batchData.meetingSessions.some(
          (session) =>
            session.clientId === appt.clientId &&
            (session.appointmentId === appt.id || !session.appointmentId) &&
            (session.status === "prepared" || session.status === "in_progress"),
        );

        if (hasPrepOutput || hasPreparedSession) {
          skipped += 1;
          continue;
        }

        const client = clients.get(appt.clientId);
        if (!client) continue;

        const timingResult = normalizeWorkItemTiming({
          dueAt: appt.startsAt,
          now,
          timezone: appt.timezone || context.timezone,
        });
        if (!timingResult.ok) {
          skipped += 1;
          continue;
        }

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId(
              "meeting_follow_up",
              appt.id,
              "prep-missing",
            ),
            sourceType: "meeting_follow_up",
            sourceId: appt.id,
            clientId: appt.clientId,
            clientDisplayName: client.displayName,
            category: "meeting",
            title: "Meeting preparation incomplete",
            summary: "Prepare meeting materials before the scheduled appointment",
            actionOwner: "adviser",
            state: normalizeWorkItemState({ blocking: true }),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: appt.startsAt,
            occurredAt: null,
            updatedAt: null,
            reasonCodes: ["meeting_prep_missing"],
            actionHref: workQueueRoutes.clientMeetingStudio(appt.clientId),
            sourceStatus: appt.status,
            blocking: true,
            dismissible: false,
            metadata: { appointmentId: appt.id },
          }),
        );
      }

      for (const session of context.batchData.meetingSessions) {
        if (!allowedClientIds.has(session.clientId)) {
          skipped += 1;
          continue;
        }
        if (session.status !== "completed") {
          skipped += 1;
          continue;
        }
        if (
          session.summaryStatus === "published" ||
          session.summaryStatus === "ready_for_publication"
        ) {
          skipped += 1;
          continue;
        }

        const client = clients.get(session.clientId);
        if (!client) continue;

        const timingResult = normalizeWorkItemTiming({
          dueAt: null,
          now,
          timezone: context.timezone,
        });

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId(
              "meeting_follow_up",
              session.id,
              "summary-pending",
            ),
            sourceType: "meeting_follow_up",
            sourceId: session.id,
            clientId: session.clientId,
            clientDisplayName: client.displayName,
            category: "meeting",
            title: "Meeting follow-up pending",
            summary: "Complete meeting summary and publication workflow",
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.ok ? timingResult.timing : "unscheduled",
            priority: "normal",
            dueAt: null,
            occurredAt: session.completedAt,
            updatedAt: session.updatedAt,
            reasonCodes: ["meeting_follow_up_pending"],
            actionHref: workQueueRoutes.clientMeetingStudio(
              session.clientId,
              session.id,
            ),
            sourceStatus: session.summaryStatus ?? session.status,
            blocking: false,
            dismissible: false,
            metadata: {
              meetingSessionId: session.id,
              appointmentId: session.appointmentId ?? undefined,
            },
          }),
        );
      }

      return {
        items,
        sourceCount:
          context.batchData.appointments.length +
          context.batchData.meetingSessions.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.meetingSessions.length);
    }
  },
};
