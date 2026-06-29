import type { WorkQueueBatchData } from "../batchData";
import { WORK_QUEUE_LIMITS } from "../constants";
import type {
  AdviserWorkItemAdapterResult,
  WorkQueueClientScope,
} from "../types";

export type WorkQueueLoadContext = {
  authUserId: string;
  userRole: "advisor" | "admin";
  clients: WorkQueueClientScope[];
  nowIso: string;
  timezone: string;
  batchData: WorkQueueBatchData;
  limits: {
    maxClients: number;
    maxItems: number;
    appointmentWindowDays: number;
    reviewUpcomingDays: number;
    unpublishedDraftAgingDays: number;
    preparationLeadHours: number;
  };
};

export interface AdviserWorkItemAdapter {
  readonly sourceType: import("../sourceRegistry").WorkItemSourceType;
  load(context: WorkQueueLoadContext): AdviserWorkItemAdapterResult;
}

export function createWorkQueueLoadContext(input: {
  authUserId: string;
  userRole: "advisor" | "admin";
  clients: WorkQueueClientScope[];
  nowIso: string;
  timezone?: string;
  batchData: WorkQueueBatchData;
}): WorkQueueLoadContext {
  return {
    authUserId: input.authUserId,
    userRole: input.userRole,
    clients: input.clients.slice(0, WORK_QUEUE_LIMITS.maxClients),
    nowIso: input.nowIso,
    timezone: input.timezone ?? "Asia/Singapore",
    batchData: input.batchData,
    limits: {
      maxClients: WORK_QUEUE_LIMITS.maxClients,
      maxItems: WORK_QUEUE_LIMITS.maxItems,
      appointmentWindowDays: WORK_QUEUE_LIMITS.appointmentWindowDays,
      reviewUpcomingDays: WORK_QUEUE_LIMITS.reviewUpcomingDays,
      unpublishedDraftAgingDays: WORK_QUEUE_LIMITS.unpublishedDraftAgingDays,
      preparationLeadHours: WORK_QUEUE_LIMITS.preparationLeadHours,
    },
  };
}

export function clientScopeById(
  context: WorkQueueLoadContext,
): Map<string, WorkQueueClientScope> {
  return new Map(context.clients.map((client) => [client.id, client]));
}

export function emptyAdapterResult(): AdviserWorkItemAdapterResult {
  return {
    items: [],
    sourceCount: 0,
    skippedCount: 0,
    warningCodes: [],
  };
}

export function adapterErrorResult(sourceCount: number): AdviserWorkItemAdapterResult {
  return {
    items: [],
    sourceCount,
    skippedCount: sourceCount,
    warningCodes: ["adapter_error"],
  };
}
