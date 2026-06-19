import { NextResponse } from "next/server";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { toPublicErrorMessage } from "@/lib/security/apiGuards";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
import { dbListAllGovernedContent } from "@/lib/supabase/governedContentPersistence";

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

    const enabled = await isFeatureEnabled("admin_content_approval");
    if (!enabled) {
      return NextResponse.json({ ok: false, error: "Content approval is disabled" }, { status: 403 });
    }

    const rows = await dbListAllGovernedContent();

    const content = rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: row.summary,
      category: row.category,
      contentType: row.content_type,
      audienceScope: row.audience_scope,
      authorUserId: row.author_user_id,
      adviserUserId: row.adviser_user_id,
      approvalStatus: row.approval_status,
      externalUrl: row.external_url,
      externalSourceName: row.external_source_name,
      expiresAt: row.expires_at,
      publishedAt: row.published_at,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({ ok: true, content });
  } catch (err) {
    console.error("[api/admin/communications GET]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Failed to load communications") },
      { status: 500 },
    );
  }
}
