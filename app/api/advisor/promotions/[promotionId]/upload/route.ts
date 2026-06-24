import { NextResponse } from "next/server";

import {
  auditLegacyPromotionsRetirementAccess,
  legacyPromotionsRetiredAdvisorResponse,
} from "@/lib/promotions/legacyPromotionsRetirement";
import {
  privatePromotionJson,
  resolveLegacyPromotionViewerRole,
} from "@/lib/promotions/legacyPromotionsAuthorization";
import { getRequestMetadata } from "@/lib/security/apiGuards";
import { requireAdvisorAccess } from "@/lib/supabase/advisorAuth";

export const dynamic = "force-dynamic";

export type PromotionUploadResponse =
  | { ok: false; reason: "unauthenticated" | "forbidden" }
  | { error: { code: string; message: string } };

export async function POST(
  request: Request,
): Promise<NextResponse> {
  const access = await requireAdvisorAccess();

  if (!access.allowed) {
    return privatePromotionJson(
      {
        ok: false,
        reason: access.reason === "unauthenticated" ? "unauthenticated" : "forbidden",
      },
      access.reason === "unauthenticated" ? 401 : 403,
    );
  }

  const role = resolveLegacyPromotionViewerRole(access.user.role);
  if (!role) {
    return privatePromotionJson({ ok: false, reason: "forbidden" }, 403);
  }

  const metadata = getRequestMetadata(request);
  await auditLegacyPromotionsRetirementAccess({
    userId: access.authUser.id,
    role,
    routeCategory: "advisor_api_upload",
    mutationBlocked: true,
    ipAddress: metadata.ip_address,
    userAgent: metadata.user_agent,
  });

  return legacyPromotionsRetiredAdvisorResponse();
}
