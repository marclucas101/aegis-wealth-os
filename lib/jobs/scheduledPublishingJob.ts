import "server-only";

import { dbListDueScheduledContent } from "@/lib/supabase/governedContentPersistence";
import { dbRecordJobItem } from "@/lib/supabase/automationJobPersistence";

import { publishScheduledContentItem } from "./scheduledContentEligibility";
import type { JobHandler, JobRunContext, JobHandlerResult } from "./types";
import { SCHEDULED_PUBLISHING_MAX_BATCH } from "./types";

export const runScheduledPublishingJob: JobHandler = async (
  ctx: JobRunContext,
): Promise<JobHandlerResult> => {
  const counts = { examined: 0, succeeded: 0, skipped: 0, failed: 0 };

  const dueRows = await dbListDueScheduledContent(SCHEDULED_PUBLISHING_MAX_BATCH);

  for (const row of dueRows) {
    if (Date.now() > ctx.deadlineMs) {
      return {
        status: counts.failed > 0 || counts.succeeded > 0 ? "partial" : "failed",
        counts,
        sanitizedError: "Execution timeout reached",
      };
    }

    counts.examined += 1;
    const result = await publishScheduledContentItem(row.id);

    await dbRecordJobItem({
      jobRunId: ctx.runId,
      referenceType: "governed_content",
      referenceId: row.id,
      outcome: result.outcome,
      sanitizedReason: result.reason,
    });

    if (result.outcome === "succeeded") {
      counts.succeeded += 1;
    } else if (result.outcome === "skipped") {
      counts.skipped += 1;
    } else {
      counts.failed += 1;
    }
  }

  if (counts.failed > 0 && counts.succeeded > 0) {
    return { status: "partial", counts };
  }
  if (counts.failed > 0) {
    return { status: "failed", counts, sanitizedError: "One or more items failed" };
  }
  return { status: "success", counts };
};
