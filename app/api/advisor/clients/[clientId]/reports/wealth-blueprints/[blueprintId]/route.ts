import { NextResponse } from "next/server";

import { getRequestMetadata, toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorWealthBlueprintDetail,
  type AdvisorWealthBlueprintDetail,
} from "@/lib/supabase/advisorReportQueries";
import { writeAuditLog } from "@/lib/supabase/auditLog";

export const dynamic = "force-dynamic";

export type AdvisorWealthBlueprintDetailResponse =
  | { ok: true; report: AdvisorWealthBlueprintDetail }
  | {
      ok: false;
      reason: "unauthenticated" | "forbidden" | "not_found" | "error";
      error?: string;
    };

type RouteContext = {
  params: Promise<{ clientId: string; blueprintId: string }>;
};

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorWealthBlueprintDetailResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
          error:
            access.reason === "unauthenticated"
              ? undefined
              : "Advisor access required",
        },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const role = advisorRole(access.user.role);
    if (!role) {
      return NextResponse.json(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        { status: 403 },
      );
    }

    const { clientId, blueprintId } = await context.params;
    const result = await loadAdvisorWealthBlueprintDetail(
      access.authUser.id,
      role,
      clientId,
      blueprintId,
    );

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: result.reason,
          error:
            result.reason === "forbidden"
              ? "You do not have access to this client"
              : "Report not found",
        },
        { status: result.reason === "forbidden" ? 403 : 404 },
      );
    }

    const metadata = getRequestMetadata(request);
    await writeAuditLog({
      clientId,
      userId: access.authUser.id,
      action: "advisor_wealth_blueprint_viewed",
      entityType: "wealth_blueprint",
      entityId: blueprintId,
      metadata: {
        client_id: clientId,
        blueprint_id: blueprintId,
        title: result.report.title,
      },
      ipAddress: metadata.ip_address,
      userAgent: metadata.user_agent,
    });

    return NextResponse.json({ ok: true, report: result.report });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load report");
    console.error(
      "[api/advisor/clients/[clientId]/reports/wealth-blueprints/[blueprintId]]",
      err,
    );

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
