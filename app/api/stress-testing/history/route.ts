import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import {
  loadStressTestHistory,
  type StressTestHistoryEntry,
} from "@/lib/supabase/stressPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type StressTestingHistoryResponse =
  | { ok: true; runs: StressTestHistoryEntry[] }
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<
  NextResponse<StressTestingHistoryResponse>
> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const runs = await loadStressTestHistory(session.client);

    return NextResponse.json({ ok: true, runs });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load stress test history",
    );

    console.error("[api/stress-testing/history]", err);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
