import { NextResponse } from "next/server";

import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { listPublishedPromotions } from "@/lib/supabase/promotionsPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type PromotionsListResponse =
  | { ok: true; promotions: Awaited<ReturnType<typeof listPublishedPromotions>> }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<PromotionsListResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const promotions = await listPublishedPromotions();

    return NextResponse.json({ ok: true, promotions });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load promotions");
    console.error("[api/promotions GET]", err);

    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
