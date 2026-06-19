import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireSessionAccess,
} from "@/lib/api/meetingStudioRouteHelpers";
import { sanitizeCloseStatePatch } from "@/lib/compliance/meetingCloseState";
import {
  rateLimitOrThrow,
  rejectClientIdInBody,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string; sessionId: string }>;
};

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAdvisorMeetingAuth();
    if (!auth.ok) return auth.response;

    const { clientId, sessionId } = await context.params;
    const access = await requireSessionAccess(
      auth.authUserId,
      auth.role,
      clientId,
      sessionId,
    );
    if (!access.ok) return access.response;

    return NextResponse.json({ ok: true, session: access.session });
  } catch (err) {
    console.error("[meeting-sessions/[sessionId] GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load session") },
      { status: 500 },
    );
  }
}

export async function PATCH(
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

    if (access.session.status === "completed") {
      return NextResponse.json(
        { ok: false, error: "Completed sessions cannot be modified" },
        { status: 400 },
      );
    }

    const { saveCloseState } = await import(
      "@/lib/compliance/meetingStudioWorkflow"
    );

    if (body.closeState && typeof body.closeState === "object") {
      const session = await saveCloseState({
        session: access.session,
        clientId,
        closeState: sanitizeCloseStatePatch(body.closeState),
      });
      return NextResponse.json({ ok: true, session });
    }

    return NextResponse.json({ ok: true, session: access.session });
  } catch (err) {
    console.error("[meeting-sessions/[sessionId] PATCH]", err);
    return meetingErrorResponse(err, "Failed to update session");
  }
}
