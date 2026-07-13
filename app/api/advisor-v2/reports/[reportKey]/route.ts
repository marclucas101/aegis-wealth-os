import { NextResponse } from "next/server";

import { assertCrmV2ReportsAccess } from "@/lib/crm-v2/access";
import { CRM_V2_REPORTS_MAX_DAYS } from "@/lib/crm-v2/constants";
import { loadAdviserReportsSection } from "@/lib/crm-v2/reports/projection";
import { REPORT_SECTION_KEYS } from "@/lib/crm-v2/reports/types";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";

export const dynamic = "force-dynamic";

const PRIVATE_CACHE = "private, no-store";

type RouteContext = { params: Promise<{ reportKey: string }> };

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const access = await assertCrmV2ReportsAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        {
          status: access.reason === "unauthenticated" ? 401 : 403,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const { reportKey } = await context.params;
    if (!REPORT_SECTION_KEYS.includes(reportKey as (typeof REPORT_SECTION_KEYS)[number])) {
      return NextResponse.json(
        { ok: false, reason: "not_found" },
        {
          status: 404,
          headers: { "X-Request-Id": access.requestId, "Cache-Control": PRIVATE_CACHE },
        },
      );
    }

    const url = new URL(request.url);
    const daysRaw = Number(url.searchParams.get("days"));
    const days =
      Number.isFinite(daysRaw) && daysRaw > 0
        ? Math.min(CRM_V2_REPORTS_MAX_DAYS, Math.floor(daysRaw))
        : undefined;

    const result = await loadAdviserReportsSection({
      authUserId: access.authUser.id,
      userRole: access.user.role as "advisor" | "admin",
      requestId: access.requestId,
      sectionKey: reportKey as (typeof REPORT_SECTION_KEYS)[number],
      days,
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
      { ok: false, error: toPublicErrorMessage(err, "Failed to load report section") },
      { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } },
    );
  }
}
