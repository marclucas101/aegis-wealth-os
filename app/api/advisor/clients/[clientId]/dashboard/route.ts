import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { loadAdvisorClientDashboardView } from "@/lib/supabase/advisorClientFinancialViews";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import type { DashboardSnapshot } from "@/lib/supabase/dashboardQueries";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ clientId: string }>;
};

export type AdvisorClientDashboardResponse =
  | ({ ok: true; readOnly: true } & DashboardSnapshot)
  | {
      ok: false;
      reason:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "no_profile"
        | "error";
      error?: string;
    };

function advisorRole(role: string): "advisor" | "admin" | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse<AdvisorClientDashboardResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      return NextResponse.json(
        {
          ok: false,
          reason:
            access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
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

    const { clientId } = await context.params;
    const result = await loadAdvisorClientDashboardView(
      access.authUser.id,
      role,
      clientId,
    );

    if (result.status === "forbidden") {
      return NextResponse.json(
        {
          ok: false,
          reason: "forbidden",
          error: "You do not have access to this client",
        },
        { status: 403 },
      );
    }

    if (result.status === "not_found") {
      return NextResponse.json(
        { ok: false, reason: "not_found", error: "Client not found" },
        { status: 404 },
      );
    }

    if (result.status === "no_profile") {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, readOnly: true, ...result.snapshot });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load client dashboard",
    );
    console.error("[api/advisor/clients/[clientId]/dashboard GET]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
