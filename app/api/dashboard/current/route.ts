import { NextResponse } from "next/server";

import {
  loadDashboardSnapshot,
  type DashboardSnapshot,
} from "@/lib/supabase/dashboardQueries";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type DashboardCurrentResponse =
  | ({ ok: true } & DashboardSnapshot)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<NextResponse<DashboardCurrentResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const snapshot = await loadDashboardSnapshot(session.client);

    if (!snapshot) {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load dashboard snapshot";

    console.error("[api/dashboard/current]", message);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
