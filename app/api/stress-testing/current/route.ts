import { NextResponse } from "next/server";

import {
  loadStressTestingSnapshot,
  type StressTestingSnapshot,
} from "@/lib/supabase/moduleQueries";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type StressTestingCurrentResponse =
  | ({ ok: true } & StressTestingSnapshot)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<
  NextResponse<StressTestingCurrentResponse>
> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const snapshot = await loadStressTestingSnapshot(session.client);

    if (!snapshot) {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to load stress testing snapshot";

    console.error("[api/stress-testing/current]", message);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
