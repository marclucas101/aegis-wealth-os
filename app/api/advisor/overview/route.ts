import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";
import {
  loadAdvisorOverview,
  type AdvisorOverview,
} from "@/lib/supabase/advisorQueries";

export const dynamic = "force-dynamic";

export type AdvisorOverviewResponse =
  | ({ ok: true } & AdvisorOverview)
  | { ok: false; reason: "unauthenticated"; error?: string }
  | { ok: false; reason: "forbidden"; error?: string }
  | { ok: false; reason: "error"; error: string };

export async function GET(): Promise<NextResponse<AdvisorOverviewResponse>> {
  try {
    const access = await requireAdvisorAccess();

    if (!access.allowed) {
      if (access.reason === "unauthenticated") {
        return NextResponse.json(
          { ok: false, reason: "unauthenticated" },
          { status: 401 },
        );
      }

      return NextResponse.json(
        {
          ok: false,
          reason: "forbidden",
          error: "Advisor access required",
        },
        { status: 403 },
      );
    }

    const overview = await loadAdvisorOverview(
      access.authUser.id,
      access.user.role as "advisor" | "admin",
    );

    return NextResponse.json({ ok: true, ...overview });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load advisor overview",
    );

    console.error("[api/advisor/overview]", err);

    return NextResponse.json(
      { ok: false, reason: "error", error: message },
      { status: 500 },
    );
  }
}
