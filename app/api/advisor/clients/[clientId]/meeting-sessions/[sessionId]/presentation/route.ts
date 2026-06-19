import { NextResponse } from "next/server";

import {
  meetingErrorResponse,
  requireAdvisorMeetingAuth,
  requireSessionAccess,
  sensitiveMeetingResponse,
} from "@/lib/api/meetingStudioRouteHelpers";
import {
  buildMeetingPresentation,
  getPresentationSection,
} from "@/lib/compliance/meetingStudioWorkflow";
import { isMeetingSectionType } from "@/lib/compliance/meetingStudioTypes";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string; sessionId: string }>;
};

export async function GET(
  request: Request,
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

    const url = new URL(request.url);
    const sectionParam = url.searchParams.get("section");

    if (sectionParam) {
      if (!isMeetingSectionType(sectionParam)) {
        return NextResponse.json(
          { ok: false, error: "Section not available" },
          { status: 404 },
        );
      }

      try {
        const section = await getPresentationSection(
          access.session,
          access.client,
          sectionParam,
        );
        return sensitiveMeetingResponse({ ok: true, section });
      } catch {
        return sensitiveMeetingResponse(
          { ok: false, error: "Section not available" },
          { status: 404 },
        );
      }
    }

    const presentation = await buildMeetingPresentation(
      access.session,
      access.client,
    );

    return sensitiveMeetingResponse({ ok: true, presentation });
  } catch (err) {
    console.error("[meeting-sessions/presentation GET]", err);
    return meetingErrorResponse(
      err,
      toPublicErrorMessage(err, "Failed to load presentation"),
    );
  }
}
