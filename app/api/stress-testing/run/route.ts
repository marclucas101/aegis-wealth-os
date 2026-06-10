import { NextResponse } from "next/server";

import {
  getRequestMetadata,
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  INTERACTIVE_STRESS_SEVERITIES,
  isValidInteractiveSeverity,
  isValidStressScenario,
  persistStressTestRun,
  STRESS_SCENARIO_KEYS,
  type InteractiveStressSeverity,
  type PersistStressTestRunResult,
} from "@/lib/supabase/stressPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";
import type { StressScenario } from "@/src/lib/scoring/types";

export const dynamic = "force-dynamic";

export type StressTestingRunResponse =
  | ({ ok: true } & PersistStressTestRunResult)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function POST(
  request: Request,
): Promise<NextResponse<StressTestingRunResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const rateLimit = rateLimitOrThrow<StressTestingRunResponse>(request, {
      userId: session.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, reason: "no_profile", error: parsed.error },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_profile",
          error: clientIdReject.error,
        },
        { status: 400 },
      );
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_profile",
          error: sensitiveReject.error,
        },
        { status: 400 },
      );
    }

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_profile",
          error: "Missing or invalid scenario or severity",
        },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const scenarioResult = validateEnum(
      body.scenario,
      STRESS_SCENARIO_KEYS,
      "scenario",
    );
    const severityResult = validateEnum(
      body.severity,
      INTERACTIVE_STRESS_SEVERITIES,
      "severity",
    );

    if (
      !scenarioResult.ok ||
      !severityResult.ok ||
      !isValidStressScenario(scenarioResult.value) ||
      !isValidInteractiveSeverity(severityResult.value)
    ) {
      return NextResponse.json(
        {
          ok: false,
          reason: "no_profile",
          error: "Missing or invalid scenario or severity",
        },
        { status: 400 },
      );
    }

    const scenario = scenarioResult.value as StressScenario;
    const severity = severityResult.value as InteractiveStressSeverity;

    const result = await persistStressTestRun(
      session.client,
      scenario,
      severity,
    );

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.authUser.id,
      action: "stress_test_run",
      entityType: "stress_tests",
      entityId: result.id,
      metadata: {
        scenario,
        severity,
        score_drop: result.score_drop,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to run stress test");

    if (message === "no_profile") {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    console.error("[api/stress-testing/run]", err);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
