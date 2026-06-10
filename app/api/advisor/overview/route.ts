import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import {
  loadAdvisorOverview,
  type AdvisorOverview,
} from "@/lib/supabase/advisorQueries";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type AdvisorOverviewResponse =
  | ({ ok: true } & AdvisorOverview)
  | { ok: false; reason: "unauthenticated"; error?: string }
  | { ok: false; reason: "error"; error: string };

export async function GET(): Promise<NextResponse<AdvisorOverviewResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const overview = await loadAdvisorOverview(
      session.authUser.id,
      session.user.role,
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
