import { advocacyEventAdapter } from "./advocacyEventAdapter";
import { advisorTaskAdapter } from "./advisorTaskAdapter";
import { appointmentAdapter } from "./appointmentAdapter";
import { binderExportAdapter } from "./binderExportAdapter";
import { clientServiceRequestAdapter } from "./clientServiceRequestAdapter";
import { dataCompletenessAdapter } from "./dataCompletenessAdapter";
import { meetingFollowUpAdapter } from "./meetingFollowUpAdapter";
import { planningOutputAdapter } from "./planningOutputAdapter";
import { reviewDueAdapter } from "./reviewDueAdapter";
import { roadmapItemAdapter } from "./roadmapItemAdapter";
import { protectionExtractionAdapter } from "./protectionExtractionAdapter";
import { protectionPolicyServicingAdapter } from "./protectionPolicyServicingAdapter";
import { relationshipMomentAdapter } from "./relationshipMomentAdapter";
import { crmReviewRhythmAdapter } from "./crmReviewRhythmAdapter";
import { clientPreferenceUpdateAdapter } from "./clientPreferenceUpdateAdapter";
import { serviceCommitmentAdapter } from "./serviceCommitmentAdapter";
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
  serviceCommitmentAdapter,
  clientServiceRequestAdapter,
  protectionExtractionAdapter,
  protectionPolicyServicingAdapter,
  relationshipMomentAdapter,
  crmReviewRhythmAdapter,
  clientPreferenceUpdateAdapter,
  advocacyEventAdapter,
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
  serviceCommitmentAdapter,
  clientServiceRequestAdapter,
  protectionExtractionAdapter,
  protectionPolicyServicingAdapter,
  relationshipMomentAdapter,
  crmReviewRhythmAdapter,
  clientPreferenceUpdateAdapter,
  advocacyEventAdapter,
};

export type { AdviserWorkItemAdapter, WorkQueueLoadContext } from "./types";
