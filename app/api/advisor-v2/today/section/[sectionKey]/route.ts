import { NextResponse } from "next/server";

import { assertCrmV2TodayAccess } from "@/lib/crm-v2/access";
import { loadAdviserTodaySection } from "@/lib/crm-v2/today/projection";
import { TODAY_SECTION_KEYS } from "@/lib/crm-v2/today/types";
import type { TodaySectionKey } from "@/lib/crm-v2/today/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = {
  params: Promise<{ sectionKey: string }>;
};

function parseSectionKey(value: string): TodaySectionKey | null {
  return TODAY_SECTION_KEYS.includes(value as TodaySectionKey)
    ? (value as TodaySectionKey)
    : null;
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
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

    const { sectionKey: rawKey } = await context.params;
    const sectionKey = parseSectionKey(rawKey);
    if (!sectionKey) {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        {
          status: 404,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const url = new URL(request.url);
    const operatingDate = url.searchParams.get("date") ?? undefined;

    const result = await loadAdviserTodaySection({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      operatingDate: operatingDate ?? undefined,
      sectionKey,
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
      { ok: true, section: result.data },
      { headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load Today section") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
