import "server-only";

import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/supabase/auditLog";

import { privatePromotionJson } from "./legacyPromotionsAuthorization";
import type { LegacyPromotionViewerRole } from "./legacyPromotionsAuthorization";
import {
  LEGACY_PROMOTIONS_RETIRED_BODY,
  LEGACY_PROMOTIONS_RETIRED_CODE,
} from "./legacyPromotionsRetirementConstants";

export {
  LEGACY_PROMOTIONS_RETIRED_API_MESSAGE,
  LEGACY_PROMOTIONS_RETIRED_BODY,
  LEGACY_PROMOTIONS_RETIRED_CODE,
  LEGACY_PROMOTIONS_RETIRED_QUERY_PARAM,
  LEGACY_PROMOTIONS_RETIRED_USER_MESSAGE,
  LEGACY_PROMOTIONS_REPLACEMENT_ADVISER_HREF,
  LEGACY_PROMOTIONS_REPLACEMENT_CLIENT_HREF,
  adviserPromotionsRetiredRedirectTarget,
  clientPromotionsRetiredRedirectTarget,
  isLegacyPromotionsRetiredNoticeRequested,
} from "./legacyPromotionsRetirementConstants";

export type LegacyPromotionsRetirementRouteCategory =
  | "advisor_page"
  | "client_page"
  | "advisor_api_list"
  | "advisor_api_detail"
  | "advisor_api_upload"
  | "advisor_api_mutation";

export function legacyPromotionsRetiredAdvisorResponse(): NextResponse {
  return privatePromotionJson(LEGACY_PROMOTIONS_RETIRED_BODY, 410);
}

export function legacyPromotionsRetiredClientListResponse(): NextResponse {
  return privatePromotionJson({
    ok: true,
    promotions: [],
    retired: true,
    replacement: "insights",
  });
}

/**
 * Application retirement is permanent — adviser mutation APIs stay retired even if
 * legacy_promotions_write is mistakenly enabled.
 */
export function adviserLegacyPromotionsMutationsRetired(): true {
  return true;
}

export async function auditLegacyPromotionsRetirementAccess(input: {
  userId: string;
  role: string;
  routeCategory: LegacyPromotionsRetirementRouteCategory;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  mutationBlocked?: boolean;
}): Promise<void> {
  const action = input.mutationBlocked
    ? "legacy_promotions_retired_mutation_blocked"
    : input.routeCategory === "advisor_page" || input.routeCategory === "client_page"
      ? "legacy_promotions_replacement_redirected"
      : "legacy_promotions_retired_route_accessed";

  await writeAuditLog({
    userId: input.userId,
    action,
    entityType: "promotions",
    entityId: null,
    metadata: {
      adviser_user_id: input.userId,
      action_type: input.routeCategory,
      result_code: LEGACY_PROMOTIONS_RETIRED_CODE,
      role: input.role,
      ...(input.requestId ? { request_id: input.requestId } : {}),
    },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

export function legacyPromotionViewerRoleLabel(
  role: LegacyPromotionViewerRole | string,
): string {
  return role;
}
