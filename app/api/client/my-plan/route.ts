import { NextResponse } from "next/server";

import { recordActiveClientEvent } from "@/lib/compliance/activeClientAnalytics";
import {
  assertActiveClientFeature,
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { loadMyPlanPublications } from "@/lib/compliance/activeClientPortalService";
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

    const feature = await assertActiveClientFeature(access.ctx, "my_plan");
    if (!feature.allowed) {
      return NextResponse.json(
        { ok: false, error: feature.reason ?? "Feature not available" },
        { status: 403, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const publications = await loadMyPlanPublications(session.client.id);

    await recordActiveClientEvent({
      clientId: session.client.id,
      userId: session.authUser.id,
      event: "published_plan_viewed",
      metadata: { count: publications.length },
    });

    return NextResponse.json(
      { ok: true, publications },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/my-plan]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load plan") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}
