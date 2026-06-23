import "server-only";

import { NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { privatePromotionJson } from "@/lib/promotions/legacyPromotionsAuthorization";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";

export type PromotionMigrationAdminAccess =
  | { allowed: false; response: NextResponse }
  | { allowed: true; userId: string };

export async function requirePromotionMigrationAdminAccess(): Promise<PromotionMigrationAdminAccess> {
  const access = await requireAdminAccess();
  if (!access.allowed) {
    return {
      allowed: false,
      response: privatePromotionJson(
        { ok: false, reason: access.reason },
        access.reason === "unauthenticated" ? 401 : 403,
      ),
    };
  }

  const enabled = await isFeatureEnabled("admin_content_approval");
  if (!enabled) {
    return {
      allowed: false,
      response: privatePromotionJson(
        { ok: false, error: "Migration review requires content approval" },
        403,
      ),
    };
  }

  return { allowed: true, userId: access.user.id };
}
