import { NextResponse } from "next/server";

import { approveContent } from "@/lib/communications/contentWorkflow";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
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

    const access = await requireAdminAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const enabled = await isFeatureEnabled("admin_content_approval");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Content approval is disabled" }, { status: 403 });
    }

    const { contentId } = await context.params;
    const row = await dbLoadGovernedContentById(contentId);

    if (!row) {
      return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    rejectUnexpectedFields(parsed.body, { rejectClientId: true });

    const updated = await approveContent({
      contentId,
      approverUserId: access.user.id,
      authorUserId: row.author_user_id,
    });

    return NextResponse.json({
      ok: true,
      content: { id: updated.id, approvalStatus: updated.approval_status },
    });
  } catch (err) {
    console.error("[api/admin/communications/[contentId]/approve POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Approve failed") },
      { status: 500 },
    );
  }
}
