import "server-only";

import { createAdminSupabaseClient } from "./admin";

export type AutomationJobName = "scheduled_publishing";

export type AutomationJobTriggerSource = "scheduler" | "admin_manual";

export type AutomationJobRunStatus =
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "skipped";

export type AutomationJobItemOutcome = "succeeded" | "skipped" | "failed";

export type AutomationJobRunRow = {
  id: string;
  job_name: AutomationJobName;
  trigger_source: AutomationJobTriggerSource;
  status: AutomationJobRunStatus;
  started_at: string;
  completed_at: string | null;
  items_examined: number;
  items_succeeded: number;
  items_skipped: number;
  items_failed: number;
  sanitized_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AutomationJobItemRow = {
  id: string;
  job_run_id: string;
  reference_type: "governed_content";
  reference_id: string;
  outcome: AutomationJobItemOutcome;
  sanitized_reason: string | null;
  created_at: string;
};

export type SanitizedJobRunSummary = {
  id: string;
  jobName: AutomationJobName;
  triggerSource: AutomationJobTriggerSource;
  status: AutomationJobRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  itemsExamined: number;
  itemsSucceeded: number;
  itemsSkipped: number;
  itemsFailed: number;
  sanitizedError: string | null;
};

function mapRunRow(data: Record<string, unknown>): AutomationJobRunRow {
  return data as unknown as AutomationJobRunRow;
}

export function toSanitizedJobRunSummary(row: AutomationJobRunRow): SanitizedJobRunSummary {
  const completedAt = row.completed_at;
  const durationMs =
    completedAt !== null
      ? new Date(completedAt).getTime() - new Date(row.started_at).getTime()
      : null;

  return {
    id: row.id,
    jobName: row.job_name,
    triggerSource: row.trigger_source,
    status: row.status,
    startedAt: row.started_at,
    completedAt,
    durationMs,
    itemsExamined: row.items_examined,
    itemsSucceeded: row.items_succeeded,
    itemsSkipped: row.items_skipped,
    itemsFailed: row.items_failed,
    sanitizedError: row.sanitized_error,
  };
}

export async function dbClearStaleJobRuns(input: {
  jobName: AutomationJobName;
  staleAfterMs: number;
}): Promise<number> {
  const admin = createAdminSupabaseClient();
  const cutoff = new Date(Date.now() - input.staleAfterMs).toISOString();

  const { data, error } = await admin
    .from("automation_job_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      sanitized_error: "Execution timeout — stale run cleared",
    } as never)
    .eq("job_name", input.jobName)
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id");

  if (error) {
    throw new Error(`Failed to clear stale job runs: ${error.message}`);
  }

  return (data ?? []).length;
}

export async function dbTryStartJobRun(input: {
  jobName: AutomationJobName;
  triggerSource: AutomationJobTriggerSource;
  metadata?: Record<string, unknown>;
}): Promise<AutomationJobRunRow | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("automation_job_runs")
    .insert({
      job_name: input.jobName,
      trigger_source: input.triggerSource,
      status: "running",
      metadata: input.metadata ?? {},
    } as never)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return null;
    }
    throw new Error(`Failed to start job run: ${error.message}`);
  }

  return data ? mapRunRow(data as Record<string, unknown>) : null;
}

export async function dbCompleteJobRun(input: {
  runId: string;
  status: AutomationJobRunStatus;
  itemsExamined: number;
  itemsSucceeded: number;
  itemsSkipped: number;
  itemsFailed: number;
  sanitizedError?: string | null;
}): Promise<AutomationJobRunRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("automation_job_runs")
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      items_examined: input.itemsExamined,
      items_succeeded: input.itemsSucceeded,
      items_skipped: input.itemsSkipped,
      items_failed: input.itemsFailed,
      sanitized_error: input.sanitizedError ?? null,
    } as never)
    .eq("id", input.runId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to complete job run: ${error.message}`);
  }

  return mapRunRow(data as Record<string, unknown>);
}

export async function dbRecordJobItem(input: {
  jobRunId: string;
  referenceType: "governed_content";
  referenceId: string;
  outcome: AutomationJobItemOutcome;
  sanitizedReason?: string | null;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("automation_job_items").insert({
    job_run_id: input.jobRunId,
    reference_type: input.referenceType,
    reference_id: input.referenceId,
    outcome: input.outcome,
    sanitized_reason: input.sanitizedReason?.slice(0, 200) ?? null,
  } as never);

  if (error) {
    throw new Error(`Failed to record job item: ${error.message}`);
  }
}

export async function dbListJobRuns(input: {
  jobName?: AutomationJobName;
  limit?: number;
}): Promise<AutomationJobRunRow[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("automation_job_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (input.jobName) {
    query = query.eq("job_name", input.jobName);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to list job runs: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRunRow(row as Record<string, unknown>));
}

export async function dbHasActiveJobRun(jobName: AutomationJobName): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("automation_job_runs")
    .select("id")
    .eq("job_name", jobName)
    .eq("status", "running")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check active job run: ${error.message}`);
  }

  return Boolean(data);
}
