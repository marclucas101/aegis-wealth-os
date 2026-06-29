import { hoursUntil, normalizeWorkItemState, normalizeWorkItemTiming } from "../normalization";
import { applyPriorityToItem } from "../priority";
import { buildDeterministicWorkItemId, workQueueRoutes } from "../routes";
import type { AdviserWorkItem, WorkItemReasonCode } from "../types";
import {
  adapterErrorResult,
  clientScopeById,
  type AdviserWorkItemAdapter,
} from "./types";

const ACTIVE_APPOINTMENT_STATUSES = new Set(["pending", "confirmed"]);

export const appointmentAdapter: AdviserWorkItemAdapter = {
  sourceType: "appointment",
  load(context) {
    try {
      const clients = clientScopeById(context);
      const allowedClientIds = new Set(context.clients.map((c) => c.id));
      const now = new Date(context.nowIso);
      const windowEnd = new Date(now);
      windowEnd.setDate(windowEnd.getDate() + context.limits.appointmentWindowDays);

      const items: AdviserWorkItem[] = [];
      let skipped = 0;

      for (const appt of context.batchData.appointments) {
        if (!allowedClientIds.has(appt.clientId)) {
          skipped += 1;
          continue;
        }
        if (!ACTIVE_APPOINTMENT_STATUSES.has(appt.status)) {
          skipped += 1;
          continue;
        }

        const startsAt = new Date(appt.startsAt);
        if (Number.isNaN(startsAt.getTime()) || startsAt > windowEnd) {
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

        const hours = hoursUntil(appt.startsAt, now);
        const needsPrep =
          hours !== null &&
          hours >= 0 &&
          hours <= context.limits.preparationLeadHours;

        const publishedOutputReady = context.batchData.planningOutputs.some(
          (output) =>
            output.clientId === appt.clientId &&
            (output.publicationStatus === "published" ||
              output.publicationStatus === "adviser_reviewed") &&
            (output.outputType === "meeting_summary" ||
              output.outputType === "meeting_presentation"),
        );

        if (needsPrep && !publishedOutputReady) {
          skipped += 1;
          continue;
        }

        const reasonCodes: WorkItemReasonCode[] = ["appointment_upcoming"];

        items.push(
          applyPriorityToItem({
            id: buildDeterministicWorkItemId("appointment", appt.id),
            sourceType: "appointment",
            sourceId: appt.id,
            clientId: appt.clientId,
            clientDisplayName: client.displayName,
            category: "meeting",
            title: "Upcoming client appointment",
            summary: appt.appointmentType,
            actionOwner: "adviser",
            state: normalizeWorkItemState({}),
            timing: timingResult.timing,
            priority: "normal",
            dueAt: appt.startsAt,
            occurredAt: null,
            updatedAt: null,
            reasonCodes,
            actionHref: workQueueRoutes.adviserAppointments(),
            sourceStatus: appt.status,
            blocking: false,
            metadata: { appointmentId: appt.id },
            dismissible: false,
          }),
        );
      }

      return {
        items,
        sourceCount: context.batchData.appointments.length,
        skippedCount: skipped,
        warningCodes: [],
      };
    } catch {
      return adapterErrorResult(context.batchData.appointments.length);
    }
  },
};
