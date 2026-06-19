import { NextResponse } from "next/server";

import { classifyPromotion, listUnmigratedPromotions, migratePromotionToDraft } from "@/lib/communications/legacyPromotionsMigration";
import type { PromotionMigrationClassification } from "@/lib/communications/types";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const access = await requireAdminAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const promotions = await listUnmigratedPromotions();

    return NextResponse.json({
      ok: true,
      promotions: promotions.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        status: p.status,
        suggestedClassification: classifyPromotion(p),
      })),
    });
  } catch (err) {
    console.error("[api/admin/promotions-migration GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to list promotions") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const rateLimit = rateLimitOrThrow(request, { bucket: "writeHeavy" });
    if (!rateLimit.ok) {
      return rateLimit.response;
    }

    const access = await requireAdminAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { ok: false, reason: access.reason },
        { status: access.reason === "unauthenticated" ? 401 : 403 },
      );
    }

    const enabled = await isFeatureEnabled("admin_content_approval");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Migration requires content approval" }, { status: 403 });
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    rejectUnexpectedFields(parsed.body, { rejectClientId: true });

    if (!parsed.body || typeof parsed.body !== "object") {
      return NextResponse.json({ ok: false, error: "Request body is required" }, { status: 400 });
    }

    const body = parsed.body as Record<string, unknown>;
    const promotionId = typeof body.promotionId === "string" ? body.promotionId : "";
    const classification = (
      typeof body.classification === "string" ? body.classification : "unsuitable"
    ) as PromotionMigrationClassification;

    const result = await migratePromotionToDraft({
      promotionId,
      reviewerUserId: access.user.id,
      classification,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/admin/promotions-migration POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Migration failed") },
      { status: 500 },
    );
  }
}
