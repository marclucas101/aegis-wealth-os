import { NextResponse } from "next/server";

import { assertCrmV2RelationshipsAccess } from "@/lib/crm-v2/access";
import { resolveAuthorizedRelationship } from "@/lib/crm-v2/relationships/identity";
import { loadCrmRelationship360 } from "@/lib/crm-v2/relationships/readModel";
import { parseRelationshipTab } from "@/lib/crm-v2/relationships/routes";
import type { CrmRelationship360 } from "@/lib/crm-v2/relationships/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

export type AdvisorV2RelationshipDetailResponse =
  | ({ ok: true } & CrmRelationship360)
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "feature_disabled"
        | "pilot_mode_disabled"
        | "pilot_not_eligible"
        | "not_found"
        | "error";
      error?: string;
    };

const PRIVATE_CACHE = "private, no-store";

type RouteContext = {
  params: Promise<{ relationshipId: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorV2RelationshipDetailResponse>> {
  try {
    const access = await assertCrmV2RelationshipsAccess();
    if (!access.allowed) {
      const status = access.reason === "unauthenticated" ? 401 : 403;
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status,
          headers: {
            "X-Request-Id": access.requestId,
            "Cache-Control": PRIVATE_CACHE,
          },
        },
      );
    }

    const { relationshipId } = await context.params;
    const resolved = await resolveAuthorizedRelationship(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      relationshipId,
    );

    if (!resolved.ok) {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        {
          status: 404,
          headers: {
            "X-Request-Id": access.requestId,
            "Cache-Control": PRIVATE_CACHE,
          },
        },
      );
    }

    const tab = parseRelationshipTab(new URL(request.url).searchParams.get("tab"));
    const model = await loadCrmRelationship360(
      resolved.client,
      tab,
      access.requestId,
    );

    return NextResponse.json(
      { ok: true, ...model },
      {
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load relationship");
    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
