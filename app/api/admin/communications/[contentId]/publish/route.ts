import { NextResponse } from "next/server";

import { publishContent } from "@/lib/communications/contentWorkflow";
import { queueInsightEmailDelivery } from "@/lib/communications/emailDelivery";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";
import {
  parseJsonBodySafely,
  rateLimitOrThrow,
  rejectUnexpectedFields,
  toPublicErrorMessage,
} from "@/lib/security/apiGuards";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { requireAdminAccess } from "@/lib/supabase/adminManagement";
import { dbLoadGovernedContentById } from "@/lib/supabase/governedContentPersistence";
import type { GovernedContentRow } from "@/lib/communications/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ contentId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
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
      return NextResponse.json({ ok: false, error: "Content approval is disabled" }, { status: 403 });
    }

    const { contentId } = await context.params;
    const row = await dbLoadGovernedContentById(contentId);
    if (!row) {
      return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    }

    const parsed = await parseJsonBodySafely(request);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    rejectUnexpectedFields(parsed.body, { rejectClientId: true });

    const body =
      parsed.body && typeof parsed.body === "object"
        ? (parsed.body as Record<string, unknown>)
        : {};

    const updated = await publishContent({
      contentId,
      actorUserId: access.user.id,
      scheduledAt: typeof body.scheduledAt === "string" ? body.scheduledAt : null,
    });

    if (updated.approval_status === "published") {
      const inAppEnabled = await isFeatureEnabled("client_in_app_notifications");
      const targetClientIds = await resolvePublishTargets(updated);

      for (const clientId of targetClientIds) {
        if (inAppEnabled) {
          await dbCreateClientNotification({
            clientId,
            notificationType: "new_insight",
            title: updated.title,
            summary: updated.summary.slice(0, 300),
            referenceType: "governed_content",
            referenceId: updated.id,
          });
          await writeAuditLog({
            clientId,
            userId: access.user.id,
            action: "notification_created",
            entityType: "client_notification",
            entityId: updated.id,
            metadata: { type: "new_insight" },
          });
        }
        await queueInsightEmailDelivery({ content: updated, clientId });
      }
    }

    return NextResponse.json({
      ok: true,
      content: { id: updated.id, approvalStatus: updated.approval_status, publishedAt: updated.published_at },
    });
  } catch (err) {
    console.error("[api/admin/communications/[contentId]/publish POST]", err);
    return NextResponse.json(
      { ok: false, error: toPublicErrorMessage(err, "Publish failed") },
      { status: 500 },
    );
  }
}

async function resolvePublishTargets(row: GovernedContentRow): Promise<string[]> {
  if (row.target_client_ids.length > 0) {
    return row.target_client_ids;
  }

  const admin = createAdminSupabaseClient();
  let query = admin.from("clients").select("id");

  if (row.audience_scope === "assigned_active_clients" && row.adviser_user_id) {
    query = query.eq("advisor_user_id", row.adviser_user_id).eq("relationship_stage", "active_client");
  } else if (row.audience_scope === "all_active_clients") {
    query = query.eq("relationship_stage", "active_client");
  } else if (row.audience_scope === "assigned_prospects" && row.adviser_user_id) {
    query = query.eq("advisor_user_id", row.adviser_user_id).eq("relationship_stage", "prospect");
  } else if (row.audience_scope === "all_prospects") {
    query = query.eq("relationship_stage", "prospect");
  } else {
    return [];
  }

  const { data } = await query;
  return ((data ?? []) as { id: string }[]).map((c) => c.id);
}
