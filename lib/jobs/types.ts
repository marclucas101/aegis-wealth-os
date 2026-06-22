import "server-only";

export const JOB_NAMES = ["scheduled_publishing"] as const;

export type JobName = (typeof JOB_NAMES)[number];

export type JobTriggerSource = "scheduler" | "admin_manual";

export type JobRunStatus = "running" | "success" | "partial" | "failed" | "skipped";

export type JobItemOutcome = "succeeded" | "skipped" | "failed";

export type JobRunCounts = {
  examined: number;
  succeeded: number;
  skipped: number;
  failed: number;
};

export type JobRunContext = {
  runId: string;
  jobName: JobName;
  triggerSource: JobTriggerSource;
  startedAt: Date;
  deadlineMs: number;
  initiatedByUserId?: string;
};

export type JobHandlerResult = {
  status: JobRunStatus;
  counts: JobRunCounts;
  sanitizedError?: string | null;
};

export type JobHandler = (ctx: JobRunContext) => Promise<JobHandlerResult>;

export const SCHEDULED_PUBLISHING_MAX_BATCH = 25;

export const SCHEDULED_PUBLISHING_TIMEOUT_MS = 55_000;

export const STALE_JOB_RUN_MS = 5 * 60_000;
