import { NextResponse } from "next/server";

import { enforceDatabaseBackedSchedulerThrottle } from "@/lib/jobs/schedulerThrottle";
import { runAutomationJob } from "@/lib/jobs/jobRunner";
import {
  cronUnauthorizedResponse,
  validateCronSecret,
} from "@/lib/security/cronAuth";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type ScheduledPublishingJobResponse =
  | {
      ok: true;
      featureEnabled: boolean;
      activeRunBlocked?: boolean;
      run: {
        id: string;
        status: string;
        itemsExamined: number;
        itemsSucceeded: number;
        itemsSkipped: number;
        itemsFailed: number;
        sanitizedError: string | null;
      } | null;
    }
  | { ok: false; error: string };

function noStoreJson<T>(body: T, init?: { status?: number; headers?: Record<string, string> }): NextResponse<T> {
  const response = NextResponse.json(body, { status: init?.status });
  response.headers.set("Cache-Control", "private, no-store");
  if (init?.headers) {
    for (const [key, value] of Object.entries(init.headers)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export async function POST(
  request: Request,
): Promise<NextResponse<ScheduledPublishingJobResponse>> {
  if (!validateCronSecret(request)) {
    return cronUnauthorizedResponse();
  }

  try {
    const throttle = await enforceDatabaseBackedSchedulerThrottle({
      jobName: "scheduled_publishing",
      triggerSource: "scheduler",
    });

    if (!throttle.allowed) {
      return noStoreJson(
        { ok: false, error: "Scheduler invocation throttled" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(throttle.retryAfterMs / 1000))),
          },
        },
      );
    }

    const result = await runAutomationJob({
      jobName: "scheduled_publishing",
      triggerSource: "scheduler",
    });

    if (!result.ok) {
      return noStoreJson({ ok: false, error: result.error }, { status: 400 });
    }

    if (result.activeRunBlocked) {
      return noStoreJson(
        { ok: false, error: "A scheduled publishing run is already active" },
        { status: 409 },
      );
    }

    return noStoreJson({
      ok: true as const,
      featureEnabled: result.featureEnabled,
      activeRunBlocked: result.activeRunBlocked,
      run: result.run
        ? {
            id: result.run.id,
            status: result.run.status,
            itemsExamined: result.run.itemsExamined,
            itemsSucceeded: result.run.itemsSucceeded,
            itemsSkipped: result.run.itemsSkipped,
            itemsFailed: result.run.itemsFailed,
            sanitizedError: result.run.sanitizedError,
          }
        : null,
    } satisfies ScheduledPublishingJobResponse);
  } catch (err) {
    const message = toPublicErrorMessage(err, "Scheduled publishing job failed");
    console.error("[api/internal/jobs/scheduled-publishing]", err);

    return noStoreJson({ ok: false, error: message }, { status: 500 });
  }
}
