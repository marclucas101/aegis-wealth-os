import { NextResponse } from "next/server";

import {
  CLIENT_PROMOTIONS_MAX_RESULTS,
  evaluateClientPromotionsAccess,
  privatePromotionJson,
  toClientSafePromotionRecord,
  type ClientSafePromotionRecord,
} from "@/lib/promotions/legacyPromotionsAuthorization";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { listPublishedPromotions } from "@/lib/supabase/promotionsPersistence";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type PromotionsListResponse =
  | { ok: true; promotions: ClientSafePromotionRecord[] }
  | { ok: false; error: string };

export async function GET(): Promise<NextResponse<PromotionsListResponse>> {
  try {
    const session = await ensureUserClientProfile();

    if (!session.authenticated) {
      return privatePromotionJson(
        { ok: false, error: "Authentication required" },
        401,
      );
    }

    const access = await evaluateClientPromotionsAccess(session);
    if (!access.allowed) {
      return access.response as NextResponse<PromotionsListResponse>;
    }

    const promotions = await listPublishedPromotions();
    const safe = promotions
      .slice(0, CLIENT_PROMOTIONS_MAX_RESULTS)
      .map(toClientSafePromotionRecord);

    return privatePromotionJson({ ok: true, promotions: safe });
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load promotions");
    console.error("[api/promotions GET]", err);

    return privatePromotionJson({ ok: false, error: message }, 500);
  }
}
