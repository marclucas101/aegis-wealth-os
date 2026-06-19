import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireSessionAccess,
} from "@/lib/api/meetingStudioRouteHelpers";
import { startMeetingSession } from "@/lib/compliance/meetingStudioWorkflow";
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

    const body = await request.json().catch(() => ({}));
    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const session = await startMeetingSession({
      session: access.session,
      clientId,
      adviserUserId: auth.authUserId,
    });

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    console.error("[meeting-sessions/start POST]", err);
    return meetingErrorResponse(err, "Failed to start meeting");
  }
}
