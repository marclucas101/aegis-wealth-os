import { NextResponse } from "next/server";

import {
  assertActiveClientFeature,
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { loadClientInsightsFeed } from "@/lib/communications/insightsFeedService";
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

    const feature = await assertActiveClientFeature(access.ctx, "insights_and_updates");
    if (!feature.allowed) {
      return NextResponse.json(
        { ok: false, error: feature.reason ?? "Feature not available" },
        { status: 403, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const insights = await loadClientInsightsFeed({ client: session.client });

    return NextResponse.json(
      { ok: true, insights },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/insights GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load insights") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}
