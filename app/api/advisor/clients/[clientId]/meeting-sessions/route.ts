import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireClientAccess,
} from "@/lib/api/meetingStudioRouteHelpers";
import {
  createMeetingSession,
  listMeetingSessions,
  loadMeetingPreparationContext,
} from "@/lib/compliance/meetingStudioWorkflow";
import { isMeetingType } from "@/lib/compliance/meetingStudioTypes";
import {
  rateLimitOrThrow,
  rejectClientIdInBody,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const auth = await requireAdvisorMeetingAuth();
    if (!auth.ok) return auth.response;

    const { clientId } = await context.params;
    const clientAccess = await requireClientAccess(
      auth.authUserId,
      auth.role,
      clientId,
    );
    if (!clientAccess.ok) return clientAccess.response;

    const sessions = await listMeetingSessions(clientId);
    const preparation = await loadMeetingPreparationContext(clientAccess.client);

    return NextResponse.json({ ok: true, sessions, preparation });
  } catch (err) {
    console.error("[meeting-sessions GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to list sessions") },
      { status: 500 },
    );
  }
}

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

    const { clientId } = await context.params;
    const clientAccess = await requireClientAccess(
      auth.authUserId,
      auth.role,
      clientId,
    );
    if (!clientAccess.ok) return clientAccess.response;

    const body = (await request.json()) as Record<string, unknown>;
    const clientIdReject = rejectClientIdInBody(body);
    if (clientIdReject.rejected) {
      return NextResponse.json(
        { ok: false, error: clientIdReject.error },
        { status: 400 },
      );
    }

    const meetingType =
      typeof body.meetingType === "string" && isMeetingType(body.meetingType)
        ? body.meetingType
        : "review";

    const session = await createMeetingSession({
      clientId,
      adviserUserId: auth.authUserId,
      userRole: auth.role,
      meetingType,
      title: typeof body.title === "string" ? body.title : undefined,
      purpose: typeof body.purpose === "string" ? body.purpose : undefined,
      appointmentId:
        typeof body.appointmentId === "string" ? body.appointmentId : null,
      scheduledStart:
        typeof body.scheduledStart === "string" ? body.scheduledStart : null,
    });

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    console.error("[meeting-sessions POST]", err);
    return meetingErrorResponse(err, "Failed to create session");
  }
}
