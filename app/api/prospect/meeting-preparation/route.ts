import { NextResponse } from "next/server";

import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { loadMeetingPreparationData } from "@/lib/compliance/meetingPreparationData";
import { recordProspectEvent } from "@/lib/compliance/prospectAnalytics";
import { getRequestMetadata } from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type MeetingPreparationResponse =
  | { ok: true; data: Awaited<ReturnType<typeof loadMeetingPreparationData>> }
  | { ok: false; error: string };

export async function GET(
  request: Request,
): Promise<NextResponse<MeetingPreparationResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const ctx = await getUserExperienceContext({
      user: session.user,
      client: session.client,
    });

    if (!(await canAccessClientFeature(ctx, "meeting_preparation"))) {
      return NextResponse.json(
        { ok: false, error: "Meeting preparation is not available." },
        { status: 403 },
      );
    }

    const data = await loadMeetingPreparationData({
      user: session.user,
      client: session.client,
    });

    const metadata = getRequestMetadata(request);
    await recordProspectEvent({
      clientId: session.client.id,
      userId: session.authUser.id,
      event: "prospect_meeting_preparation_viewed",
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error("[api/prospect/meeting-preparation]", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load meeting preparation" },
      { status: 500 },
    );
  }
}
