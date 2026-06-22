import { NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { rateLimitOrThrow } from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
import {
  dbHasActiveJobRun,
  dbListJobRuns,
  toSanitizedJobRunSummary,
} from "@/lib/supabase/automationJobPersistence";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "commandCenter" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdminAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const url = new URL(request.url);
    const jobName = url.searchParams.get("jobName") ?? "scheduled_publishing";
    if (jobName !== "scheduled_publishing") {
      return NextResponse.json({ ok: false, error: "Unknown job" }, { status: 400 });
    }

    const [runs, featureEnabled, activeRun] = await Promise.all([
      dbListJobRuns({ jobName: "scheduled_publishing", limit: 50 }),
      isFeatureEnabled("scheduled_content_automation"),
      dbHasActiveJobRun("scheduled_publishing"),
    ]);

    const response = NextResponse.json({
      ok: true,
      featureEnabled,
      activeRun,
      runs: runs.map(toSanitizedJobRunSummary),
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    console.error("[api/admin/jobs/runs GET]", err);
    return NextResponse.json({ ok: false, error: "Failed to load job history" }, { status: 500 });
  }
}
