import { NextResponse } from "next/server";

import {
  legacyPromotionsRetiredClientListResponse,
} from "@/lib/promotions/legacyPromotionsRetirement";
import { privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { ensureUserClientProfile } from "@/lib/supabase/userProfile";

export const dynamic = "force-dynamic";

export type PromotionsListResponse =
  | {
      ok: true;
      promotions: [];
      retired: true;
      replacement: "insights";
    }
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

    if (session.user.role !== "client") {
      return privatePromotionJson(
        { ok: false, error: "Client access required" },
        403,
      );
    }

    return legacyPromotionsRetiredClientListResponse() as NextResponse<PromotionsListResponse>;
  } catch (err) {
    const message = toPublicErrorMessage(err, "Failed to load promotions");
    console.error("[api/promotions GET]", err);

    return privatePromotionJson({ ok: false, error: message }, 500);
  }
}
