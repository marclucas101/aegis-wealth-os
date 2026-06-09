import { NextResponse } from "next/server";

import {
  loadAnnualReviewHistory,
  type AnnualReviewHistoryEntry,
} from "@/lib/supabase/reportPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type AnnualReviewHistoryResponse =
  | { ok: true; snapshots: AnnualReviewHistoryEntry[] }
  | { ok: false; reason: "no_profile" | "unauthenticated"; error?: string };

export async function GET(): Promise<NextResponse<AnnualReviewHistoryResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, reason: "unauthenticated" },
        { status: 401 },
      );
    }

    const snapshots = await loadAnnualReviewHistory(session.client);

    return NextResponse.json({ ok: true, snapshots });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to load annual review history";

    console.error("[api/annual-review/history]", message);

    return NextResponse.json(
      { ok: false, reason: "no_profile", error: message },
      { status: 500 },
    );
  }
}
