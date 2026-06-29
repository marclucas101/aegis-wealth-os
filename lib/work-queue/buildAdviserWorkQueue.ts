import "server-only";

import { assembleAdviserWorkQueue } from "./assembleAdviserWorkQueue";
import { createWorkQueueLoadContext } from "./adapters/types";
import { DEFAULT_ADVISER_TIMEZONE, WORK_QUEUE_LIMITS } from "./constants";
import {
  loadWorkQueueBatchData,
  loadWorkQueueClients,
} from "./loadWorkQueueBatchData";
import type {
  AdviserWorkQueueResult,
  WorkQueueClientScope,
} from "./types";

export type BuildAdviserWorkQueueInput = {
  authUserId: string;
  userRole: "advisor" | "admin";
  nowIso?: string;
  timezone?: string;
};

function toClientScope(client: {
  id: string;
  display_name: string;
  advisor_user_id: string | null;
  status: string;
  relationship_stage: string;
  next_review_due: string | null;
}): WorkQueueClientScope {
  return {
    id: client.id,
    displayName: client.display_name,
    advisorUserId: client.advisor_user_id,
    status: client.status,
    relationshipStage: client.relationship_stage,
    nextReviewDue: client.next_review_due,
  };
}

/**
 * Pure assembly from preloaded context — used by tests and production builder.
 */
export function buildAdviserWorkQueueFromContext(
  context: ReturnType<typeof createWorkQueueLoadContext>,
): AdviserWorkQueueResult {
  return assembleAdviserWorkQueue(context);
}

/**
 * Server-only virtual work queue builder. No persistence, no source writes, no API route.
 */
export async function buildAdviserWorkQueue(
  input: BuildAdviserWorkQueueInput,
): Promise<AdviserWorkQueueResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();

  if (input.userRole !== "advisor") {
    return {
      generatedAt: nowIso,
      items: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        overdue: 0,
        blocked: 0,
        clientsAffected: 0,
      },
      adapterStatus: [
        {
          sourceType: "advisor_task",
          ok: true,
          itemCount: 0,
          sourceCount: 0,
          skippedCount: 0,
          warningCodes: ["admin_scope_deferred"],
        },
      ],
    };
  }

  const clients = await loadWorkQueueClients(input.authUserId, input.userRole);
  const assignedClients = clients.filter(
    (client) => client.advisor_user_id === input.authUserId,
  );

  const batchData = await loadWorkQueueBatchData({
    authUserId: input.authUserId,
    userRole: input.userRole,
    clients: assignedClients,
    nowIso,
  });

  const context = createWorkQueueLoadContext({
    authUserId: input.authUserId,
    userRole: input.userRole,
    clients: assignedClients.map(toClientScope),
    nowIso,
    timezone: input.timezone ?? DEFAULT_ADVISER_TIMEZONE,
    batchData,
  });

  return assembleAdviserWorkQueue(context);
}

export const WORK_QUEUE_FEATURE_FLAG_KEY = "adviser_work_queue" as const;

export const WORK_QUEUE_BUILD_LIMITS = WORK_QUEUE_LIMITS;
