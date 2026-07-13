import { NextResponse } from "next/server";

import { assertCrmV2RelationshipMomentsAccess } from "@/lib/crm-v2/access";
import { updateRelationshipMoment } from "@/lib/crm-v2/moments/moments";
import type { UpdateMomentInput } from "@/lib/crm-v2/moments/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ relationshipId: string; momentId: string }> };

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2RelationshipMomentsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const body = (await request.json()) as UpdateMomentInput;
    const { relationshipId, momentId } = await context.params;
    const result = await updateRelationshipMoment({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      relationshipId,
      momentId,
      payload: body,
      requestId: access.requestId,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, reason: result.reason, error: result.error },
        {
          status:
            result.reason === "not_found"
              ? 404
              : result.reason === "forbidden"
                ? 403
                : result.reason === "conflict"
                  ? 409
                  : 400,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    return NextResponse.json(
      { ok: true, moment: result.data },
      {
        headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
      },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to update moment") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
