import { NextResponse } from "next/server";

import { toPublicErrorMessage, validateEnum } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  FEEDBACK_STATUSES,
  listAdvisorFeedback,
  type AdviserFeedbackRecord,
  type AdviserFeedbackSummary,
  type FeedbackStatus,
} from "@/lib/supabase/adviserFeedbackPersistence";

export const dynamic = "force-dynamic";

export type AdvisorFeedbackListResponse =
  | {
      ok: true;
      feedback: AdviserFeedbackRecord[];
      summaries: AdviserFeedbackSummary[];
      viewer: { userId: string; role: "advisor" | "admin" };
    }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "error"; error?: string };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(
  request: Request,
): Promise<NextResponse<AdvisorFeedbackListResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const adviserUserId = searchParams.get("adviserUserId") ?? "all";
    const minRatingParam = searchParams.get("minRating");
    const sortParam = searchParams.get("sort");

    let status: FeedbackStatus | "all" = "all";
    if (statusParam && statusParam !== "all") {
      const statusResult = validateEnum<FeedbackStatus>(
        statusParam,
        FEEDBACK_STATUSES,
        "status",
      );
      if (!statusResult.ok) {
        return NextResponse.json(
          { ok: false, reason: "error", error: statusResult.error },
          { status: 400 },
        );
      }
      status = statusResult.value;
    }

    const minRating = minRatingParam ? Number.parseInt(minRatingParam, 10) : undefined;
    const sort = sortParam === "oldest" ? "oldest" : "newest";

    const result = await listAdvisorFeedback(access.authUser.id, role, {
      status,
      adviserUserId: role === "admin" ? adviserUserId : access.authUser.id,
      minRating: Number.isInteger(minRating) ? minRating : undefined,
      sort,
    });

    return NextResponse.json({
      ok: true,
      feedback: result.feedback,
      summaries: result.summaries,
      viewer: result.viewer,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load adviser feedback");
    console.error("[api/advisor/feedback GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
