import { NextResponse } from "next/server";

import { recordActiveClientEvent } from "@/lib/compliance/activeClientAnalytics";
import {
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import {
  loadMyPlanPublications,
  loadPublishedMeetingSummaries,
} from "@/lib/compliance/activeClientPortalService";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const access = await assertActiveClientPortalAccess({
      user: session.user,
      client: session.client,
    });

    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, error: access.reason },
        { status: access.status, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const [planSummaries, meetingSummaries] = await Promise.all([
      loadMyPlanPublications(session.client.id),
      loadPublishedMeetingSummaries(session.client.id),
    ]);

    const meetingOnly = meetingSummaries.filter(
      (s) => s.outputType === "meeting_summary",
    );

    if (meetingOnly.length > 0) {
      await recordActiveClientEvent({
        clientId: session.client.id,
        userId: session.authUser.id,
        event: "published_meeting_summary_viewed",
        metadata: { count: meetingOnly.length },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        summaries: [...planSummaries, ...meetingOnly],
      },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/published-summaries]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load summaries") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}
