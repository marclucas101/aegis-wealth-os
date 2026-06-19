import { NextResponse } from "next/server";

import { recordActiveClientEvent } from "@/lib/compliance/activeClientAnalytics";
import {
  assertActiveClientFeature,
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { loadActiveClientFinancialOverview } from "@/lib/compliance/activeClientPortalService";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type FinancialOverviewResponse =
  | { ok: true; data: Awaited<ReturnType<typeof loadActiveClientFinancialOverview>> }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<FinancialOverviewResponse>> {
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

    const feature = await assertActiveClientFeature(
      access.ctx,
      "financial_overview",
    );
    if (!feature.allowed) {
      return NextResponse.json(
        { ok: false, error: feature.reason ?? "Feature not available" },
        { status: 403, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const data = await loadActiveClientFinancialOverview({
      user: session.user,
      client: session.client,
    });

    await recordActiveClientEvent({
      clientId: session.client.id,
      userId: session.authUser.id,
      event: "financial_overview_viewed",
    });

    return NextResponse.json(
      { ok: true, data },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/financial-overview]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load overview") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}
