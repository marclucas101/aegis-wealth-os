import { NextResponse } from "next/server";

import {
  loadShieldDiagnosticSnapshot,
  type ShieldDiagnosticSnapshot,
} from "@/lib/supabase/moduleQueries";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type ShieldDiagnosticCurrentResponse =
  | ({ ok: true } & ShieldDiagnosticSnapshot)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<
  NextResponse<ShieldDiagnosticCurrentResponse>
> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const snapshot = await loadShieldDiagnosticSnapshot(session.client);

    if (!snapshot) {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to load shield diagnostic snapshot";

    console.error("[api/shield-diagnostic/current]", message);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
