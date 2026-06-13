import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { loadCurrentClientBudget } from "@/lib/supabase/budgetPersistence";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const access = await requireAdvisorAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const { clientId } = await context.params;
    const resolved = await resolveAccessibleClient(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
      clientId,
    );

    if (resolved.status === "not_found") {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }

    if (resolved.status === "forbidden") {
      return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 });
    }

    const budget = await loadCurrentClientBudget(clientId);

    return NextResponse.json({
      ok: true,
      budget,
      hasSavedBudget: budget !== null,
    });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load client budget");
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
