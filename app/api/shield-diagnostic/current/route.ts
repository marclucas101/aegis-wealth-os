import { NextResponse } from "next/server";

import { resolveRestrictedClientModuleAccess } from "@/lib/compliance/clientAccessGate";
import { resolveFallbackState } from "@/lib/compliance/fallbackStates";
import { wrapClientSafeResponse } from "@/lib/compliance/clientSafeDtos";
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
      feature: "shield_diagnostic",
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
        envelope: wrapClientSafeResponse("shield_diagnostic_summary", null, {
          accessMode: "fallback",
          fallbackReason: fallback.reason,
          fallbackMessage:
            access.reason ?? "Shield diagnostic requires adviser review",
        }),
      });
    }

    // Legacy path only when raw_client_financial_views enabled (dev)
    const { loadShieldDiagnosticSnapshot } = await import(
      "@/lib/supabase/moduleQueries"
    );
    const snapshot = await loadShieldDiagnosticSnapshot(session.client);

    if (!snapshot) {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load shield diagnostic snapshot",
    );
    console.error("[api/shield-diagnostic/current]", err);
    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
