import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { dbCreateClientNotification } from "@/lib/supabase/clientNotificationsPersistence";
import { writeAuditLog } from "@/lib/supabase/auditLog";

import { queueInsightEmailDelivery } from "./emailDelivery";
import type { GovernedContentRow } from "./types";

/** Resolve target client IDs for a published governed-content row. */
export async function resolvePublishTargets(row: GovernedContentRow): Promise<string[]> {
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

/** Deliver in-app notifications and email for a newly published content row. */
export async function deliverPublicationNotifications(input: {
  content: GovernedContentRow;
  actorUserId: string;
}): Promise<void> {
  const inAppEnabled = await isFeatureEnabled("client_in_app_notifications");
  const targetClientIds = await resolvePublishTargets(input.content);

  for (const clientId of targetClientIds) {
    if (inAppEnabled) {
      await dbCreateClientNotification({
        clientId,
        notificationType: "new_insight",
        title: input.content.title,
        summary: input.content.summary.slice(0, 300),
        referenceType: "governed_content",
        referenceId: input.content.id,
      });
      await writeAuditLog({
        clientId,
        userId: input.actorUserId,
        action: "notification_created",
        entityType: "client_notification",
        entityId: input.content.id,
        metadata: { type: "new_insight" },
      });
    }
    await queueInsightEmailDelivery({ content: input.content, clientId });
  }
}
