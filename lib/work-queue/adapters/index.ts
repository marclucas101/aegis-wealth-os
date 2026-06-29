import { advisorTaskAdapter } from "./advisorTaskAdapter";
import { appointmentAdapter } from "./appointmentAdapter";
import { binderExportAdapter } from "./binderExportAdapter";
import { dataCompletenessAdapter } from "./dataCompletenessAdapter";
import { meetingFollowUpAdapter } from "./meetingFollowUpAdapter";
import { planningOutputAdapter } from "./planningOutputAdapter";
import { reviewDueAdapter } from "./reviewDueAdapter";
import { roadmapItemAdapter } from "./roadmapItemAdapter";
import type { AdviserWorkItemAdapter } from "./types";

export const WORK_QUEUE_ADAPTERS: AdviserWorkItemAdapter[] = [
  advisorTaskAdapter,
  roadmapItemAdapter,
  reviewDueAdapter,
  appointmentAdapter,
  meetingFollowUpAdapter,
  planningOutputAdapter,
  binderExportAdapter,
  dataCompletenessAdapter,
];

export {
  advisorTaskAdapter,
  roadmapItemAdapter,
  reviewDueAdapter,
  appointmentAdapter,
  meetingFollowUpAdapter,
  planningOutputAdapter,
  binderExportAdapter,
  dataCompletenessAdapter,
};

export type { AdviserWorkItemAdapter, WorkQueueLoadContext } from "./types";
