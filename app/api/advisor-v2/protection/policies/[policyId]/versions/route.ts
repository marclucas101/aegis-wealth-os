import { NextResponse } from "next/server";

import { assertCrmV2ProtectionPortfolioAccess } from "@/lib/crm-v2/access";
import { listAdviserProtectionPolicyVersions } from "@/lib/crm-v2/protection/protection";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ policyId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ProtectionPortfolioAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const { policyId } = await context.params;
    const result = await listAdviserProtectionPolicyVersions({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      policyId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        {
          status: result.reason === "not_found" ? 404 : result.reason === "forbidden" ? 403 : 400,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, ...result.data },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load versions") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
