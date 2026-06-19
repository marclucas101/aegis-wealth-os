import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireSessionAccess,
} from "@/lib/api/meetingStudioRouteHelpers";
import { isMeetingSectionType } from "@/lib/compliance/meetingStudioTypes";
import { recordSectionShown } from "@/lib/compliance/meetingStudioWorkflow";
import {
  rateLimitOrThrow,
  rejectClientIdInBody,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string; sessionId: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAdvisorMeetingAuth();
    if (!auth.ok) return auth.response;

    const rateLimit = rateLimitOrThrow(request, {
      userId: auth.authUserId,
      bucket: "writeHeavy",
    });
    if (!rateLimit.ok) return rateLimit.response;

    const { clientId, sessionId } = await context.params;
    const access = await requireSessionAccess(
      auth.authUserId,
      auth.role,
      clientId,
      sessionId,
    );
    if (!access.ok) return access.response;

    const body = (await request.json()) as Record<string, unknown>;
    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const sectionType =
      typeof body.sectionType === "string" ? body.sectionType : "";
    if (!isMeetingSectionType(sectionType)) {
      return NextResponse.json(
        { ok: false, error: "Invalid section type" },
        { status: 400 },
      );
    }

    const session = await recordSectionShown({
      session: access.session,
      clientId,
      adviserUserId: auth.authUserId,
      sectionType,
      skipped: body.skipped === true,
    });

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    console.error("[meeting-sessions/section-shown POST]", err);
    return meetingErrorResponse(err, "Failed to record section");
  }
}
