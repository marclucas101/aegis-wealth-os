import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireSessionAccess,
} from "@/lib/api/meetingStudioRouteHelpers";
import { recordAcknowledgement } from "@/lib/compliance/meetingStudioWorkflow";
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

    const itemKey = typeof body.itemKey === "string" ? body.itemKey : "";
    const method = body.method;
    if (method !== "verbal_recorded" && method !== "on_screen") {
      return NextResponse.json(
        { ok: false, error: "Invalid acknowledgement method" },
        { status: 400 },
      );
    }

    const session = await recordAcknowledgement({
      session: access.session,
      clientId,
      adviserUserId: auth.authUserId,
      itemKey,
      method,
    });

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    console.error("[meeting-sessions/record-acknowledgement POST]", err);
    return meetingErrorResponse(err, "Failed to record acknowledgement");
  }
}
