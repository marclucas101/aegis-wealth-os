import { NextResponse } from "next/server";

import { submitContentForReview } from "@/lib/communications/contentWorkflow";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { dbLoadGovernedContentById } from "@/lib/supabase/governedContentPersistence";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ contentId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const enabled = await isFeatureEnabled("adviser_insight_authoring");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Insight authoring is disabled" }, { status: 403 });
    }

    const { contentId } = await context.params;
    const row = await dbLoadGovernedContentById(contentId);

    if (!row) {
      return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    }

    if (
      access.user.role === "advisor" &&
      row.author_user_id !== access.user.id
    ) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const updated = await submitContentForReview({
      contentId,
      actorUserId: access.user.id,
    });

    return NextResponse.json({
      ok: true,
      content: { id: updated.id, approvalStatus: updated.approval_status },
    });
  } catch (err) {
    console.error("[api/advisor/insights/[contentId]/submit POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to submit content") },
      { status: 500 },
    );
  }
}
