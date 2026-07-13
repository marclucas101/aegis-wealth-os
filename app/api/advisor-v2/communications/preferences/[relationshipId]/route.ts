import { NextResponse } from "next/server";

import { assertCrmV2CommunicationsAccess } from "@/lib/crm-v2/access";
import { loadAdviserCommunicationPreferences } from "@/lib/crm-v2/communications/communications";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ relationshipId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await assertCrmV2CommunicationsAccess();
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
    const result = await loadAdviserCommunicationPreferences({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      relationshipId,
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
      { ok: true, preferences: result.data },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load preferences") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
