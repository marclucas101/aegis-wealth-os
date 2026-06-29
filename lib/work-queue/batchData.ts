import type { AdvisorTaskRecord } from "@/lib/supabase/advisorTasks";
import type { ReviewPipelineClient } from "@/lib/supabase/advisorReviewPipeline";
import type { ClientFileQuality } from "@/lib/supabase/clientFileQuality";

export type WorkQueueRoadmapRow = {
  id: string;
  clientId: string;
  itemKey: string;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  taskOwner: "client" | "adviser";
  clientVisible: boolean;
  priority: string;
  updatedAt: string;
};

export type WorkQueueAppointmentRow = {
  id: string;
  clientId: string;
  clientDisplayName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "failed";
  appointmentType: string;
};

export type WorkQueueMeetingSessionRow = {
  id: string;
  clientId: string;
  appointmentId: string | null;
  status: string;
  summaryStatus: string | null;
  scheduledStart: string | null;
  completedAt: string | null;
  updatedAt: string;
};

export type WorkQueuePlanningOutputRow = {
  id: string;
  clientId: string;
  outputType: string;
  publicationStatus: string;
  updatedAt: string;
  createdAt: string;
};

export type WorkQueueBinderExportRow = {
  id: string;
  clientId: string;
  generationStatus: string;
  status: string;
  generationErrorCode: string | null;
  updatedAt: string;
};

/** Preloaded batch payload — populated once per queue build (no per-item queries). */
export type WorkQueueBatchData = {
  tasks: AdvisorTaskRecord[];
  roadmapItems: WorkQueueRoadmapRow[];
  reviewClients: ReviewPipelineClient[];
  appointments: WorkQueueAppointmentRow[];
  meetingSessions: WorkQueueMeetingSessionRow[];
  planningOutputs: WorkQueuePlanningOutputRow[];
  binderExports: WorkQueueBinderExportRow[];
  fileQualityByClientId: Record<string, ClientFileQuality>;
};

export function createEmptyWorkQueueBatchData(): WorkQueueBatchData {
  return {
    tasks: [],
    roadmapItems: [],
    reviewClients: [],
    appointments: [],
    meetingSessions: [],
    planningOutputs: [],
    binderExports: [],
    fileQualityByClientId: {},
  };
}
