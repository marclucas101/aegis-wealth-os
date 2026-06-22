import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { AutomationJobName } from "@/lib/supabase/automationJobPersistence";

/** Minimum interval between scheduler-triggered invocations (durable, cross-instance). */
export const SCHEDULER_INVOCATION_MIN_INTERVAL_MS = 60_000;

export type SchedulerThrottleResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/**
 * Database-backed execution throttle for internal scheduler routes.
 * Prevents excessive valid-secret invocations across serverless instances.
 */
export async function enforceDatabaseBackedSchedulerThrottle(input: {
  jobName: AutomationJobName;
  triggerSource?: "scheduler";
  minIntervalMs?: number;
}): Promise<SchedulerThrottleResult> {
  const minIntervalMs = input.minIntervalMs ?? SCHEDULER_INVOCATION_MIN_INTERVAL_MS;
  const admin = createAdminSupabaseClient();
  const cutoff = new Date(Date.now() - minIntervalMs).toISOString();

  const { data, error } = await admin
    .from("automation_job_runs")
    .select("started_at")
    .eq("job_name", input.jobName)
    .eq("trigger_source", input.triggerSource ?? "scheduler")
    .gte("started_at", cutoff)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Scheduler throttle check failed: ${error.message}`);
  }

  if (!data) {
    return { allowed: true };
  }

  const startedAt = new Date((data as { started_at: string }).started_at).getTime();
  const retryAfterMs = Math.max(0, startedAt + minIntervalMs - Date.now());

  return { allowed: false, retryAfterMs };
}
