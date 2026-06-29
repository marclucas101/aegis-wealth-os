import type { AdvisorTaskRecord } from "@/lib/supabase/advisorTasks";
import type { ReviewPipelineClient } from "@/lib/supabase/advisorReviewPipeline";
import type { ClientFileQuality } from "@/lib/supabase/clientFileQuality";

import type { WorkQueueBatchData } from "../batchData";
import type { WorkQueueClientScope } from "../types";

export const FIXTURE_ADVISER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const FIXTURE_OTHER_ADVISER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const FIXTURE_CLIENT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const FIXTURE_CLIENT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const FIXTURE_CLIENT_UNASSIGNED = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
export const FIXTURE_TASK_ID = "11111111-1111-4111-8111-111111111111";
export const FIXTURE_ROADMAP_ID = "22222222-2222-4222-8222-222222222222";
export const FIXTURE_APPOINTMENT_ID = "33333333-3333-4333-8333-333333333333";
export const FIXTURE_OUTPUT_ID = "44444444-4444-4444-8444-444444444444";
export const FIXTURE_BINDER_ID = "55555555-5555-4555-8555-555555555555";
export const FIXTURE_SESSION_ID = "66666666-6666-4666-8666-666666666666";

export const FIXTURE_NOW = "2026-06-15T10:00:00.000Z";

export function fixtureClientScopes(): WorkQueueClientScope[] {
  return [
    {
      id: FIXTURE_CLIENT_A,
      displayName: "Client Alpha",
      advisorUserId: FIXTURE_ADVISER_ID,
      status: "active",
      relationshipStage: "active_client",
      nextReviewDue: "2026-06-10",
    },
    {
      id: FIXTURE_CLIENT_B,
      displayName: "Client Beta",
      advisorUserId: FIXTURE_ADVISER_ID,
      status: "onboarding",
      relationshipStage: "fact_find_complete",
      nextReviewDue: null,
    },
  ];
}

export function fixtureOverdueTask(): AdvisorTaskRecord {
  return {
    id: FIXTURE_TASK_ID,
    clientId: FIXTURE_CLIENT_A,
    clientDisplayName: "Client Alpha",
    assignedToUserId: FIXTURE_ADVISER_ID,
    createdByUserId: FIXTURE_ADVISER_ID,
    title: "Follow up on review",
    description: null,
    taskType: "follow_up",
    priority: "high",
    status: "open",
    dueDate: "2026-06-01",
    completedAt: null,
    relatedEntityType: "roadmap_item",
    relatedEntityId: FIXTURE_ROADMAP_ID,
    sourceKey: null,
    dismissedAt: null,
    metadata: {},
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

export function fixtureReviewClient(): ReviewPipelineClient {
  return {
    clientId: FIXTURE_CLIENT_A,
    displayName: "Client Alpha",
    dbStatus: "review_due",
    servicingState: "overdue",
    adjustedShieldScore: 55,
    rating: "BB",
    lastAnnualReviewDate: "2024-01-15",
    nextRecommendedReviewDate: "2026-06-01",
    roadmapCompletionPercent: 40,
    recommendedNextAction: "Schedule annual review",
    priorityReasons: ["Review overdue"],
  };
}

export function fixtureBatchData(
  overrides: Partial<WorkQueueBatchData> = {},
): WorkQueueBatchData {
  const fileQuality: ClientFileQuality = {
    clientId: FIXTURE_CLIENT_B,
    displayName: "Client Beta",
    readinessScore: 45,
    readinessRating: "incomplete",
    reviewReady: false,
    missingItems: ["Discover profile completed"],
    completedItems: [],
    criticalGaps: ["No Discover profile"],
    recommendedNextActions: ["Complete discover"],
  };

  return {
    tasks: [fixtureOverdueTask()],
    roadmapItems: [
      {
        id: FIXTURE_ROADMAP_ID,
        clientId: FIXTURE_CLIENT_A,
        itemKey: "manual-1",
        title: "Increase emergency fund",
        status: "in_progress",
        taskOwner: "client",
        clientVisible: true,
        priority: "high",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
    ],
    reviewClients: [fixtureReviewClient()],
    appointments: [
      {
        id: FIXTURE_APPOINTMENT_ID,
        clientId: FIXTURE_CLIENT_B,
        clientDisplayName: "Client Beta",
        startsAt: "2026-06-16T02:00:00.000Z",
        endsAt: "2026-06-16T03:00:00.000Z",
        timezone: "Asia/Singapore",
        status: "confirmed",
        appointmentType: "review",
      },
    ],
    meetingSessions: [
      {
        id: FIXTURE_SESSION_ID,
        clientId: FIXTURE_CLIENT_A,
        appointmentId: null,
        status: "completed",
        summaryStatus: "draft",
        scheduledStart: null,
        completedAt: "2026-06-14T00:00:00.000Z",
        updatedAt: "2026-06-14T00:00:00.000Z",
      },
    ],
    planningOutputs: [
      {
        id: FIXTURE_OUTPUT_ID,
        clientId: FIXTURE_CLIENT_A,
        outputType: "client_plan_summary",
        publicationStatus: "adviser_reviewed",
        updatedAt: "2026-05-20T00:00:00.000Z",
        createdAt: "2026-05-01T00:00:00.000Z",
      },
    ],
    binderExports: [
      {
        id: FIXTURE_BINDER_ID,
        clientId: FIXTURE_CLIENT_A,
        generationStatus: "failed",
        status: "generated",
        generationErrorCode: "BINDER_RENDER_FAILED",
        updatedAt: "2026-06-12T00:00:00.000Z",
      },
    ],
    fileQualityByClientId: {
      [FIXTURE_CLIENT_B]: fileQuality,
    },
    ...overrides,
  };
}
