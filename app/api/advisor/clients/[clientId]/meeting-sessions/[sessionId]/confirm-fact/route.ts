import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireSessionAccess,
} from "@/lib/api/meetingStudioRouteHelpers";
import { confirmMeetingFact } from "@/lib/compliance/meetingStudioWorkflow";
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

    const fieldKey = typeof body.fieldKey === "string" ? body.fieldKey : "";
    const status = body.status;
    if (
      status !== "confirmed" &&
      status !== "corrected" &&
      status !== "pending"
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid confirmation status" },
        { status: 400 },
      );
    }

    const result = await confirmMeetingFact({
      session: access.session,
      client: access.client,
      fieldKey,
      status,
      correctedValue:
        typeof body.correctedValue === "string" ? body.correctedValue : null,
      adviserUserId: auth.authUserId,
    });

    return NextResponse.json({
      ok: true,
      session: result.session,
      requiresRecalculation: result.requiresRecalculation,
    });
  } catch (err) {
    console.error("[meeting-sessions/confirm-fact POST]", err);
    return meetingErrorResponse(err, "Failed to confirm fact");
  }
}
