import { NextResponse } from "next/server";

import {
  loadWealthBlueprintSnapshot,
  type WealthBlueprintSnapshot,
} from "@/lib/supabase/moduleQueries";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type WealthBlueprintCurrentResponse =
  | ({ ok: true } & WealthBlueprintSnapshot)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<
  NextResponse<WealthBlueprintCurrentResponse>
> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const snapshot = await loadWealthBlueprintSnapshot(session.client);

    if (!snapshot) {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to load wealth blueprint snapshot";

    console.error("[api/wealth-blueprint/current]", message);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
