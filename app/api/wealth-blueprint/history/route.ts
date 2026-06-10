import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import {
  loadWealthBlueprintHistory,
  type WealthBlueprintHistoryEntry,
} from "@/lib/supabase/reportPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type WealthBlueprintHistoryResponse =
  | { ok: true; snapshots: WealthBlueprintHistoryEntry[] }
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<
  NextResponse<WealthBlueprintHistoryResponse>
> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const snapshots = await loadWealthBlueprintHistory(session.client);

    return NextResponse.json({ ok: true, snapshots });
  } catch (err) {
    const message = toPublicErrorMessage(
      err,
      "Failed to load wealth blueprint history",
    );

    console.error("[api/wealth-blueprint/history]", err);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
