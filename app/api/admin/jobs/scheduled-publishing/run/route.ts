import { NextResponse } from "next/server";

import { runAutomationJob } from "@/lib/jobs/jobRunner";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
import { dbHasActiveJobRun } from "@/lib/supabase/automationJobPersistence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
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

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    rejectUnexpectedFields(parsed.body, { rejectClientId: true });

    const body =
      parsed.body && typeof parsed.body === "object"
        ? (parsed.body as Record<string, unknown>)
        : {};

    if (body.confirm !== true) {
      return NextResponse.json(
        { ok: false, error: "Explicit confirmation required" },
        { status: 400 },
      );
    }

    const active = await dbHasActiveJobRun("scheduled_publishing");
    if (active) {
      return NextResponse.json(
        { ok: false, error: "A scheduled publishing run is already active" },
        { status: 409 },
      );
    }

    const result = await runAutomationJob({
      jobName: "scheduled_publishing",
      triggerSource: "admin_manual",
      initiatedByUserId: access.user.id,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    const response = NextResponse.json({
      ok: true,
      featureEnabled: result.featureEnabled,
      activeRunBlocked: result.activeRunBlocked,
      run: result.run,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    console.error("[api/admin/jobs/scheduled-publishing/run POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Manual job run failed") },
      { status: 500 },
    );
  }
}
