import { NextResponse } from "next/server";

import { resolveRestrictedClientModuleAccess } from "@/lib/compliance/clientAccessGate";
import { wrapClientSafeResponse } from "@/lib/compliance/clientSafeDtos";
import { resolveFallbackState } from "@/lib/compliance/fallbackStates";
import { resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const access = await resolveRestrictedClientModuleAccess({
      user: session.user,
      client: session.client,
      feature: "goals_and_reviews",
    });

    if (!access.allowed) {
      const stage = resolveRelationshipStage(session.client);
      const discover = await loadCurrentDiscoverProfile(session.client.id);
      const fallback = resolveFallbackState({
        stage,
        hasDiscoverData: Boolean(discover?.formData),
        hasAssignedAdviser: Boolean(session.client.advisor_user_id),
        hasPublishedSummary: false,
      });

      return NextResponse.json({
        ok: true,
        envelope: wrapClientSafeResponse("annual_review_summary", null, {
          accessMode: "fallback",
          fallbackReason: fallback.reason,
          fallbackMessage:
            access.reason ?? "Annual review requires an adviser-reviewed summary",
        }),
      });
    }

    const { loadAnnualReviewSnapshot } = await import(
      "@/lib/supabase/moduleQueries"
    );
    const snapshot = await loadAnnualReviewSnapshot(session.client);

    if (!snapshot) {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load annual review snapshot",
    );
    console.error("[api/annual-review/current]", err);
    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
