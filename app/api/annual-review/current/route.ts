import { NextResponse } from "next/server";

import {
  loadAnnualReviewSnapshot,
  type AnnualReviewSnapshot,
} from "@/lib/supabase/moduleQueries";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type AnnualReviewCurrentResponse =
  | ({ ok: true } & AnnualReviewSnapshot)
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<
  NextResponse<AnnualReviewCurrentResponse>
> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const snapshot = await loadAnnualReviewSnapshot(session.client);

    if (!snapshot) {
      return NextResponse.json({ ok: false, reason: "no_profile" });
    }

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to load annual review snapshot";

    console.error("[api/annual-review/current]", message);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
