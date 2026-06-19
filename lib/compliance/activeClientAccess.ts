import "server-only";

import {
  canAccessClientFeature,
  getUserExperienceContext,
} from "@/lib/compliance/entitlements";
import { isActiveClientStage, isProspectStage } from "@/lib/compliance/relationshipStage";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

export type ActiveClientAccessResult =
  | { allowed: false; status: 403 | 503; reason: string }
  | { allowed: true; ctx: Awaited<ReturnType<typeof getUserExperienceContext>> };

export async function assertActiveClientPortalAccess(input: {
  user: AppUserRow;
  client: AppClientRow;
}): Promise<ActiveClientAccessResult> {
  if (input.user.role !== "client") {
    return {
      allowed: false,
      status: 403,
      reason: "Use adviser APIs for internal client analysis",
    };
  }

  const ctx = await getUserExperienceContext(input);

  if (!ctx.relationshipStage) {
    return {
      allowed: false,
      status: 403,
      reason: "Account setup incomplete",
    };
  }

  if (isProspectStage(ctx.relationshipStage)) {
    return {
      allowed: false,
      status: 403,
      reason: "This page is for active clients only",
    };
  }

  if (!isActiveClientStage(ctx.relationshipStage)) {
    return {
      allowed: false,
      status: 403,
      reason: "Limited access for inactive accounts",
    };
  }

  return { allowed: true, ctx };
}

export async function assertActiveClientFeature(
  ctx: Awaited<ReturnType<typeof getUserExperienceContext>>,
  feature: Parameters<typeof canAccessClientFeature>[1],
): Promise<{ allowed: boolean; reason?: string }> {
  const allowed = await canAccessClientFeature(ctx, feature);
  return allowed
    ? { allowed: true }
    : { allowed: false, reason: "Feature not entitled for your account" };
}

export const CLIENT_API_CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;
