import { NextResponse } from "next/server";

import { recordActiveClientEvent } from "@/lib/compliance/activeClientAnalytics";
import {
  assertActiveClientFeature,
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { loadGoalsReviewsPortalData } from "@/lib/compliance/activeClientPortalService";
import {
  submitClientReviewInformation,
  type ReviewSubmissionType,
} from "@/lib/compliance/goalsReviewSubmission";
import { upsertClientGoal } from "@/lib/supabase/clientGoalsPersistence";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectClientIdInBody,
  rejectUnexpectedFields,
  toPublicErrorMessage,
  validateEnum,
  validateRequiredString,
} from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

const SUBMISSION_TYPES = [
  "annual_review",
  "life_change",
  "goals_update",
] as const satisfies readonly ReviewSubmissionType[];

export async function GET(): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const access = await assertActiveClientPortalAccess({
      user: session.user,
      client: session.client,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, error: access.reason },
        { status: access.status, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const feature = await assertActiveClientFeature(access.ctx, "goals_and_reviews");
    if (!feature.allowed) {
      return NextResponse.json(
        { ok: false, error: feature.reason ?? "Feature not available" },
        { status: 403, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const data = await loadGoalsReviewsPortalData({ client: session.client });

    return NextResponse.json(
      { ok: true, data },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/goals-reviews GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load goals and reviews") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const access = await assertActiveClientPortalAccess({
      user: session.user,
      client: session.client,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, error: access.reason },
        { status: access.status },
      );
    }

    const feature = await assertActiveClientFeature(access.ctx, "goals_and_reviews");
    if (!feature.allowed) {
      return NextResponse.json(
        { ok: false, error: feature.reason ?? "Feature not available" },
        { status: 403 },
      );
    }

    const rateLimit = rateLimitOrThrow(request, {
      userId: session.authUser.id,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok || !parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json(
        { ok: false, error: parsed.ok ? "Invalid request body" : parsed.error },
        { status: 400 },
      );
    }

    const clientIdReject = rejectClientIdInBody(parsed.body);
    if (clientIdReject.rejected) {
      return NextResponse.json({ ok: false, error: clientIdReject.error }, { status: 400 });
    }

    const sensitiveReject = rejectUnexpectedFields(parsed.body);
    if (sensitiveReject.rejected) {
      return NextResponse.json(
        { ok: false, error: sensitiveReject.error },
        { status: 400 },
      );
    }

    const body = parsed.body as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "save_goal") {
      const titleResult = validateRequiredString(body.title, "title");
      if (!titleResult.ok) {
        return NextResponse.json({ ok: false, error: titleResult.error }, { status: 400 });
      }

      const goal = await upsertClientGoal(session.client, {
        id: typeof body.id === "string" ? body.id : undefined,
        title: titleResult.value,
        targetAmount:
          typeof body.targetAmount === "number" ? body.targetAmount : null,
        targetDate:
          typeof body.targetDate === "string" ? body.targetDate : null,
        priority:
          body.priority === "low" || body.priority === "high"
            ? body.priority
            : "medium",
      });

      await recordActiveClientEvent({
        clientId: session.client.id,
        userId: session.authUser.id,
        event: body.id ? "goal_updated" : "goal_created",
        entityId: goal.id,
      });

      return NextResponse.json({ ok: true, goal });
    }

    if (action === "submit_review") {
      const typeResult = validateEnum(
        body.submissionType,
        SUBMISSION_TYPES,
        "submissionType",
      );
      if (!typeResult.ok) {
        return NextResponse.json({ ok: false, error: typeResult.error }, { status: 400 });
      }

      const payload =
        body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
          ? (body.payload as Record<string, unknown>)
          : {};

      const result = await submitClientReviewInformation({
        client: session.client,
        actorUserId: session.authUser.id,
        submissionType: typeResult.value,
        payload,
      });

      await recordActiveClientEvent({
        clientId: session.client.id,
        userId: session.authUser.id,
        event: "review_submitted",
        entityId: result.submissionId,
        metadata: {
          submissionType: typeResult.value,
          alreadySubmitted: result.alreadySubmitted,
        },
      });

      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported action" },
      { status: 400 },
    );
  } catch (err) {
    console.error("[api/client/goals-reviews POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to save") },
      { status: 500 },
    );
  }
}
