import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireSessionAccess,
} from "@/lib/api/meetingStudioRouteHelpers";
import { isMeetingSectionType } from "@/lib/compliance/meetingStudioTypes";
import { saveMeetingPreparation, selectScenarios } from "@/lib/compliance/meetingStudioWorkflow";
import {
  rateLimitOrThrow,
  rejectClientIdInBody,
} from "@/lib/security/apiGuards";
import type { MeetingSectionType } from "@/lib/compliance/meetingStudioTypes";

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

    const rawSections = Array.isArray(body.selectedSections)
      ? body.selectedSections
      : [];
    const selectedSections = rawSections.filter(
      (s): s is MeetingSectionType =>
        typeof s === "string" && isMeetingSectionType(s),
    );

    const rawOrder = Array.isArray(body.sectionOrder) ? body.sectionOrder : [];
    const sectionOrder = rawOrder.filter(
      (s): s is MeetingSectionType =>
        typeof s === "string" && isMeetingSectionType(s),
    );

    let session = await saveMeetingPreparation({
      session: access.session,
      clientId,
      adviserUserId: auth.authUserId,
      selectedSections,
      sectionOrder: sectionOrder.length > 0 ? sectionOrder : undefined,
      preparationState:
        body.preparationState && typeof body.preparationState === "object"
          ? (body.preparationState as never)
          : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      purpose: typeof body.purpose === "string" ? body.purpose : undefined,
    });

    if (Array.isArray(body.scenarioKeys)) {
      const scenarioKeys = body.scenarioKeys.filter(
        (k): k is string => typeof k === "string",
      );
      if (scenarioKeys.length > 0) {
        session = await selectScenarios({
          session,
          clientId,
          adviserUserId: auth.authUserId,
          scenarioKeys,
          explanations:
            body.scenarioExplanations &&
            typeof body.scenarioExplanations === "object"
              ? (body.scenarioExplanations as Record<string, string>)
              : undefined,
        });
      }
    }

    return NextResponse.json({ ok: true, session });
  } catch (err) {
    console.error("[meeting-sessions/prepare POST]", err);
    return meetingErrorResponse(err, "Failed to save preparation");
  }
}
