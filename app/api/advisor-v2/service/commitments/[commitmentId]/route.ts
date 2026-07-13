import { NextResponse } from "next/server";

import { assertCrmV2ServiceAccess } from "@/lib/crm-v2/access";
import { getAdviserCommitmentDetail } from "@/lib/crm-v2/service/service";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ commitmentId: string }> },
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ServiceAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const { commitmentId } = await context.params;
    const result = await getAdviserCommitmentDetail({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      commitmentId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason },
        {
          status: result.reason === "not_found" ? 404 : 403,
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
      { ok: false, error: toPublicErrorMessage(err, "Failed to load commitment") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
