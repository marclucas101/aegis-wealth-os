import { NextResponse } from "next/server";

import { BINDER_READINESS_USER_MESSAGE } from "@/lib/binder/binderSectionPolicy";
import { assertReadinessResponseSafe } from "@/lib/binder/binderContentPreparation";
import { parseBinderPackPurpose } from "@/lib/binder/binderPackPurpose";
import { assessBinderReadiness } from "@/lib/binder/binderReadinessService";
import { toBinderPublicError } from "@/lib/binder/binderErrors";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { privateNoStoreHeaders, rateLimitOrThrow } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "read" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403, headers: privateNoStoreHeaders() },
      );
    }

    const enabled = await isFeatureEnabled("binder_export");
    if (!enabled) {
      return NextResponse.json(
        { ok: false, error: "Binder export is disabled" },
        { status: 403, headers: privateNoStoreHeaders() },
      );
    }

    const { clientId } = await context.params;
    const role = access.user.role === "admin" ? "admin" : "advisor";

    const clientAccess = await resolveAccessibleClient(access.user.id, role, clientId);
    if (clientAccess.status !== "ok") {
      return NextResponse.json(
        {
          ok: false,
          error:
            clientAccess.status === "forbidden"
              ? "Client not assigned"
              : "Client not found",
        },
        {
          status: clientAccess.status === "forbidden" ? 403 : 404,
          headers: privateNoStoreHeaders(),
        },
      );
    }

    const url = new URL(request.url);
    const meetingDate = url.searchParams.get("meetingDate");
    const purpose = parseBinderPackPurpose(url.searchParams.get("purpose"));
    const selectedParam = url.searchParams.get("selectedSections");
    const selectedSectionIds = selectedParam
      ? selectedParam.split(",").map((value) => value.trim()).filter(Boolean)
      : undefined;

    const assessment = await assessBinderReadiness({
      clientId,
      adviserUserId: access.user.id,
      userRole: role,
      meetingDate,
      purpose,
      selectedSectionIds,
    });

    const responseBody = {
      ok: true as const,
      readiness: assessment.readiness,
      message: assessment.readiness.ready ? null : BINDER_READINESS_USER_MESSAGE,
    };

    assertReadinessResponseSafe(responseBody.readiness);

    return NextResponse.json(responseBody, { headers: privateNoStoreHeaders() });
  } catch (err) {
    const pub = toBinderPublicError(err, "Failed to assess binder readiness");
    const status = pub.code === "BINDER_ACCESS_DENIED" ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: "Unable to check meeting pack readiness." },
      { status, headers: privateNoStoreHeaders() },
    );
  }
}
