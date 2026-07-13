import { NextResponse } from "next/server";

import { assertCrmV2AdvocacyAccess } from "@/lib/crm-v2/access";
import { computeAdvocacyYearScore } from "@/lib/crm-v2/advocacy/score";
import { loadAdviserAdvocacyWorkspace } from "@/lib/crm-v2/advocacy/advocacy";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2AdvocacyAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const { relationshipId } = await context.params;
    const clientAccess = await resolveAccessibleClient(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      relationshipId,
    );
    if (clientAccess.status === "not_found") {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        { status: 404, headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
      );
    }
    if (clientAccess.status === "forbidden") {
      return NextResponse.json(
        { ok: false, reason: "forbidden" },
        { status: 403, headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
      );
    }

    const [workspace, score] = await Promise.all([
      loadAdviserAdvocacyWorkspace({
        authUserId: access.authUser.id,
        userRole: access.user.role as "advisor" | "admin",
        relationshipId,
      }),
      computeAdvocacyYearScore({ clientId: relationshipId }),
    ]);

    if (!workspace.ok) {
      return NextResponse.json(
        { ok: false, reason: workspace.reason },
        {
          status: workspace.reason === "not_found" ? 404 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        summary: workspace.data.summary,
        yearlyScore: score,
      },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load advocacy summary") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
