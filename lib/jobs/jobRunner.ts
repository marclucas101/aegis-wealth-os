import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  dbClearStaleJobRuns,
  dbCompleteJobRun,
  dbTryStartJobRun,
  toSanitizedJobRunSummary,
  type SanitizedJobRunSummary,
} from "@/lib/supabase/automationJobPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

import { sanitizeJobError } from "./jobAudit";
import { getJobHandler } from "./jobRegistry";
import type { JobRunContext } from "./types";
import { SCHEDULED_PUBLISHING_TIMEOUT_MS, STALE_JOB_RUN_MS } from "./types";

export type RunJobInput = {
  jobName: "scheduled_publishing";
  triggerSource: "scheduler" | "admin_manual";
  initiatedByUserId?: string;
};

export type RunJobResult =
  | {
      ok: true;
      featureEnabled: boolean;
      run: SanitizedJobRunSummary | null;
      activeRunBlocked?: boolean;
    }
  | { ok: false; error: string };

export async function runAutomationJob(input: RunJobInput): Promise<RunJobResult> {
  if (input.jobName !== "scheduled_publishing") {
    return { ok: false, error: "Unknown job" };
  }

  const featureEnabled = await isFeatureEnabled("scheduled_content_automation");

  if (!featureEnabled) {
    const skippedRun = await dbTryStartJobRun({
      jobName: input.jobName,
      triggerSource: input.triggerSource,
      metadata: { featureEnabled: false, initiatedByUserId: input.initiatedByUserId },
    });

    if (!skippedRun) {
      return { ok: true, featureEnabled: false, run: null, activeRunBlocked: true };
    }

    const completed = await dbCompleteJobRun({
      runId: skippedRun.id,
      status: "skipped",
      itemsExamined: 0,
      itemsSucceeded: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
      sanitizedError: "Scheduled content automation is disabled",
    });

    if (input.initiatedByUserId) {
      await writeAuditLog({
        userId: input.initiatedByUserId,
        action: "automation_job_skipped",
        entityType: "automation_job_run",
        entityId: completed.id,
        metadata: { jobName: input.jobName, reason: "feature_disabled" },
      });
    }

    return {
      ok: true,
      featureEnabled: false,
      run: toSanitizedJobRunSummary(completed),
    };
  }

  await dbClearStaleJobRuns({
    jobName: input.jobName,
    staleAfterMs: STALE_JOB_RUN_MS,
  });

  const started = await dbTryStartJobRun({
    jobName: input.jobName,
    triggerSource: input.triggerSource,
    metadata: {
      featureEnabled: true,
      initiatedByUserId: input.initiatedByUserId,
    },
  });

  if (!started) {
    return { ok: true, featureEnabled: true, run: null, activeRunBlocked: true };
  }

  const startedAt = new Date(started.started_at);
  const ctx: JobRunContext = {
    runId: started.id,
    jobName: input.jobName,
    triggerSource: input.triggerSource,
    startedAt,
    deadlineMs: startedAt.getTime() + SCHEDULED_PUBLISHING_TIMEOUT_MS,
    initiatedByUserId: input.initiatedByUserId,
  };

  try {
    const handler = getJobHandler(input.jobName);
    const result = await handler(ctx);

    const completed = await dbCompleteJobRun({
      runId: started.id,
      status: result.status,
      itemsExamined: result.counts.examined,
      itemsSucceeded: result.counts.succeeded,
      itemsSkipped: result.counts.skipped,
      itemsFailed: result.counts.failed,
      sanitizedError: result.sanitizedError,
    });

    if (input.initiatedByUserId) {
      await writeAuditLog({
        userId: input.initiatedByUserId,
        action: "automation_job_completed",
        entityType: "automation_job_run",
        entityId: completed.id,
        metadata: {
          jobName: input.jobName,
          status: completed.status,
          itemsSucceeded: completed.items_succeeded,
          itemsFailed: completed.items_failed,
        },
      });
    }

    return {
      ok: true,
      featureEnabled: true,
      run: toSanitizedJobRunSummary(completed),
    };
  } catch (err) {
    const sanitized = sanitizeJobError(err);
    const completed = await dbCompleteJobRun({
      runId: started.id,
      status: "failed",
      itemsExamined: 0,
      itemsSucceeded: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
      sanitizedError: sanitized,
    });

    return {
      ok: true,
      featureEnabled: true,
      run: toSanitizedJobRunSummary(completed),
    };
  }
}
