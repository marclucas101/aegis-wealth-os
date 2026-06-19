import { NextResponse } from "next/server";

import {
  assertActiveClientFeature,
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { loadClientInsightDetail } from "@/lib/communications/insightsFeedService";
import { getRequestMetadata, rateLimitOrThrow, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ contentId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { contentId } = await context.params;
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

    const insight = await loadClientInsightDetail({
      client: session.client,
      contentId,
    });

    if (!insight) {
      return NextResponse.json(
        { ok: false, error: "Insight not found" },
        { status: 404, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    return NextResponse.json(
      { ok: true, insight },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/insights/[contentId] GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load insight") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const { contentId } = await context.params;
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const meta = getRequestMetadata(request);
    await writeAuditLog({
      clientId: session.client.id,
      userId: session.user.id,
      action: "insight_viewed",
      entityType: "governed_content",
      entityId: contentId,
      ...meta,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/client/insights/[contentId] POST view]", err);
    return NextResponse.json({ ok: false, error: "Failed to record view" }, { status: 500 });
  }
}
