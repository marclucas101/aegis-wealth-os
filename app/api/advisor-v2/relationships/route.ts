import { NextResponse } from "next/server";

import { assertCrmV2RelationshipsAccess } from "@/lib/crm-v2/access";
import {
  loadCrmRelationshipListPage,
  parseRelationshipListFilters,
} from "@/lib/crm-v2/relationships/listQueries";
import type { CrmRelationshipListPage } from "@/lib/crm-v2/relationships/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

export type AdvisorV2RelationshipsListResponse =
  | ({ ok: true } & CrmRelationshipListPage)
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "feature_disabled"
        | "pilot_mode_disabled"
        | "pilot_not_eligible"
        | "error";
      error?: string;
    };

const PRIVATE_CACHE = "private, no-store";

export async function GET(
  request: Request,
): Promise<NextResponse<AdvisorV2RelationshipsListResponse>> {
  try {
    const access = await assertCrmV2RelationshipsAccess();
    if (!access.allowed) {
      const status =
        access.reason === "unauthenticated"
          ? 401
          : 403;
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

    const filters = parseRelationshipListFilters(new URL(request.url).searchParams);
    const result = await loadCrmRelationshipListPage(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      filters,
    );

    return NextResponse.json(
      { ok: true, ...result },
      {
        headers: {
          "X-Request-Id": access.requestId,
          "Cache-Control": PRIVATE_CACHE,
        },
      },
    );
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load relationships");
    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      {
        status: 500,
        headers: { "Cache-Control": PRIVATE_CACHE },
      },
    );
  }
}
