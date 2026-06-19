import { NextResponse } from "next/server";

import {
  assertActiveClientFeature,
  assertActiveClientPortalAccess,
  CLIENT_API_CACHE_HEADERS,
} from "@/lib/compliance/activeClientAccess";
import { loadClientSafeRoadmap } from "@/lib/compliance/clientRoadmapData";
import { wrapClientSafeResponse } from "@/lib/compliance/clientSafeDtos";
import { resolveFallbackState } from "@/lib/compliance/fallbackStates";
import { loadCurrentPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import { resolveRelationshipStage } from "@/lib/compliance/relationshipStage";
import { sanitizeClientPlanSummary } from "@/lib/compliance/clientSafeDtos";
import { loadCurrentDiscoverProfile } from "@/lib/supabase/discoverPersistence";
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

    const feature = await assertActiveClientFeature(access.ctx, "roadmap");
    if (!feature.allowed) {
      return NextResponse.json(
        { ok: false, error: feature.reason ?? "Feature not available" },
        { status: 403, headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const roadmap = await loadClientSafeRoadmap(session.client);
    const published = await loadCurrentPublishedOutput(
      session.client.id,
      "roadmap_summary",
      "client_published",
    );

    if (
      roadmap.clientActions.length === 0 &&
      roadmap.adviserActions.length === 0 &&
      !published
    ) {
      const stage = resolveRelationshipStage(session.client);
      const discover = await loadCurrentDiscoverProfile(session.client.id);
      const fallback = resolveFallbackState({
        stage,
        hasDiscoverData: Boolean(discover?.formData),
        hasAssignedAdviser: Boolean(session.client.advisor_user_id),
        hasPublishedSummary: false,
      });

      return NextResponse.json(
        {
          ok: true,
          envelope: wrapClientSafeResponse("roadmap_summary", null, {
            accessMode: "fallback",
            fallbackReason: fallback.reason,
            fallbackMessage: "Your adviser will share agreed actions when ready.",
          }),
        },
        { headers: CLIENT_API_CACHE_HEADERS },
      );
    }

    const publishedSummary = published
      ? sanitizeClientPlanSummary(published.safe_payload)
      : null;

    return NextResponse.json(
      {
        ok: true,
        envelope: wrapClientSafeResponse("roadmap_summary", roadmap, {
          accessMode: published ? "published" : "client_safe",
          publishedAt: published?.published_at ?? null,
        }),
        publishedSummary,
      },
      { headers: CLIENT_API_CACHE_HEADERS },
    );
  } catch (err) {
    console.error("[api/client/roadmap]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load roadmap") },
      { status: 500, headers: CLIENT_API_CACHE_HEADERS },
    );
  }
}
