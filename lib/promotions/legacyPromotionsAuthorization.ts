import "server-only";

import { NextResponse } from "next/server";

import type { PromotionRecord, ClientSafePromotionRecord } from "@/lib/aegis/promotions";

export type { ClientSafePromotionRecord };
import { canAccessClientFeature, getUserExperienceContext } from "@/lib/compliance/entitlements";
import { isFeatureEnabled, isFeatureVisibleToRole } from "@/lib/compliance/featureFlags";
import type { ClientFeatureKey } from "@/lib/compliance/types";
import { privateNoStoreHeaders } from "@/lib/security/apiGuards";
import type { RequireAdvisorAccessResult } from "@/lib/supabase/advisorAuth";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import type { EnsureUserClientProfileResult } from "@/lib/supabase/userProfile";

export const LEGACY_PROMOTIONS_WRITE_FEATURE = "legacy_promotions_write" as const;

export const LEGACY_PROMOTIONS_WRITE_DISABLED_BODY = {
  error: {
    code: "LEGACY_PROMOTIONS_WRITE_DISABLED",
    message: "Legacy Promotions is read-only while content is being migrated.",
  },
} as const;

export const LEGACY_PROMOTIONS_READ_ONLY_MESSAGE =
  "Legacy Promotions is now read-only. New client communications should be created through Governed Communications.";

export const LEGACY_PROMOTIONS_REPLACEMENT_HREF = "/advisor/insights";

export const CLIENT_PROMOTIONS_MAX_RESULTS = 50;

export type LegacyPromotionViewerRole = "advisor" | "admin";

export type LegacyPromotionWriteGuardResult =
  | { allowed: true; writeEnabled: true }
  | { allowed: false; writeEnabled: false; response: NextResponse };

export type LegacyPromotionOwnershipResult =
  | { allowed: true; role: LegacyPromotionViewerRole }
  | { allowed: false; reason: "not_found" | "forbidden"; response: NextResponse };

export type ClientPromotionsAccessResult =
  | { allowed: true }
  | { allowed: false; response: NextResponse };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPromotionId(promotionId: string): boolean {
  return UUID_RE.test(promotionId);
}

export function resolveLegacyPromotionViewerRole(
  role: string,
): LegacyPromotionViewerRole | null {
  if (role === "advisor" || role === "admin") {
    return role;
  }

  return null;
}

export async function isLegacyPromotionsWriteEnabled(): Promise<boolean> {
  return isFeatureEnabled(LEGACY_PROMOTIONS_WRITE_FEATURE);
}

export function adviserOwnsPromotion(
  promotion: Pick<PromotionRecord, "createdBy">,
  adviserUserId: string,
  role: LegacyPromotionViewerRole,
): boolean {
  if (role === "admin") {
    return true;
  }

  return promotion.createdBy === adviserUserId;
}

export function privatePromotionJson<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: privateNoStoreHeaders(),
  });
}

export function legacyPromotionsWriteDisabledResponse(): NextResponse {
  return privatePromotionJson(LEGACY_PROMOTIONS_WRITE_DISABLED_BODY, 403);
}

export async function requireLegacyPromotionsWriteAccess(input?: {
  userId?: string;
  promotionId?: string | null;
  actionType?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<LegacyPromotionWriteGuardResult> {
  const writeEnabled = await isLegacyPromotionsWriteEnabled();
  if (writeEnabled) {
    return { allowed: true, writeEnabled: true };
  }

  if (input?.userId) {
    await writeAuditLog({
      userId: input.userId,
      action: "legacy_promotion_write_blocked",
      entityType: "promotions",
      entityId: input.promotionId ?? null,
      metadata: {
        promotion_id: input.promotionId ?? null,
        adviser_user_id: input.userId,
        action_type: input.actionType ?? "mutation",
        result_code: LEGACY_PROMOTIONS_WRITE_DISABLED_BODY.error.code,
      },
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  }

  return {
    allowed: false,
    writeEnabled: false,
    response: legacyPromotionsWriteDisabledResponse(),
  };
}

export function requireAdviserPromotionOwnership(input: {
  access: RequireAdvisorAccessResult & { allowed: true };
  promotion: PromotionRecord;
}): LegacyPromotionOwnershipResult {
  const role = resolveLegacyPromotionViewerRole(input.access.user.role);
  if (!role) {
    return {
      allowed: false,
      reason: "forbidden",
      response: privatePromotionJson(
        { ok: false, reason: "forbidden", error: "Advisor access required" },
        403,
      ),
    };
  }

  if (!adviserOwnsPromotion(input.promotion, input.access.authUser.id, role)) {
    return {
      allowed: false,
      reason: "not_found",
      response: privatePromotionJson(
        { ok: false, reason: "not_found", error: "Promotion not found" },
        404,
      ),
    };
  }

  return { allowed: true, role };
}

/**
 * Client legacy Promotions policy (Phase 9F.4):
 * - Authenticated client only (not adviser/admin on this route).
 * - Requires client `promotions` entitlement AND `product_related_content` platform flag.
 * - Entitlement is fail-closed (active clients: promotions=false in entitlements.ts).
 * - When denied, callers return `{ ok: true, promotions: [] }` — no firm-wide leak.
 */
export async function evaluateClientPromotionsAccess(
  session: EnsureUserClientProfileResult & { authenticated: true },
): Promise<ClientPromotionsAccessResult> {
  if (session.user.role !== "client") {
    return {
      allowed: false,
      response: privatePromotionJson(
        { ok: false, error: "Client access required" },
        403,
      ),
    };
  }

  const ctx = await getUserExperienceContext({
    user: session.user,
    client: session.client,
  });

  const entitled = await canAccessClientFeature(ctx, "promotions" satisfies ClientFeatureKey);
  const productEnabled = await isFeatureEnabled("product_related_content");
  const productVisible = await isFeatureVisibleToRole("product_related_content", "client");

  if (!entitled || !productEnabled || !productVisible) {
    return { allowed: false, response: privatePromotionJson({ ok: true, promotions: [] }) };
  }

  return { allowed: true };
}

export function toClientSafePromotionRecord(
  promotion: PromotionRecord,
): ClientSafePromotionRecord {
  return {
    id: promotion.id,
    title: promotion.title,
    subtitle: promotion.subtitle,
    summary: promotion.summary,
    details: promotion.details,
    category: promotion.category,
    ctaLabel: promotion.ctaLabel,
    ctaUrl: promotion.ctaUrl,
    imageSignedUrl: promotion.imageSignedUrl,
    attachmentSignedUrl: promotion.attachmentSignedUrl,
    status: promotion.status,
    priority: promotion.priority,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
  };
}

export async function auditLegacyPromotionViewed(input: {
  userId: string;
  promotionId: string;
  role: LegacyPromotionViewerRole;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (input.role !== "admin") {
    return;
  }

  await writeAuditLog({
    userId: input.userId,
    action: "legacy_promotion_viewed",
    entityType: "promotions",
    entityId: input.promotionId,
    metadata: {
      promotion_id: input.promotionId,
      adviser_user_id: input.userId,
      action_type: "admin_view",
      result_code: "ok",
    },
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}
