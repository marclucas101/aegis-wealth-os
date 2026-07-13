import { NextResponse } from "next/server";

import { assertCrmV2TodayAccess } from "@/lib/crm-v2/access";
import { loadAdviserTodayProjection } from "@/lib/crm-v2/today/projection";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const access = await assertCrmV2TodayAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const url = new URL(request.url);
    const operatingDate = url.searchParams.get("date") ?? undefined;

    const result = await loadAdviserTodayProjection({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      operatingDate: operatingDate ?? undefined,
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
      { ok: true, today: result.data },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load Today workspace") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
