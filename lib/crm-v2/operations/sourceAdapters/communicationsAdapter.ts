import "server-only";

import { CRM_V2_COMMUNICATIONS_PATH } from "@/lib/crm-v2/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { OperationsPanelDto } from "../types";

export async function loadCommunicationsOperationsPanels(input: {
  authUserId: string;
  freshnessAt: string;
}): Promise<OperationsPanelDto[]> {
  const admin = createAdminSupabaseClient();

  const [failedResult, draftStuckResult] = await Promise.all([
    admin
      .from("crm_communication_records")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("delivery_status", "failed"),
    admin
      .from("crm_communication_records")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("lifecycle_status", "draft")
      .lt("updated_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  return [
    {
      panelKey: "communications_delivery_failures",
      title: "Delivery failures",
      summary: "Failed communications — no message bodies or provider payloads exposed.",
      statusLevel: (failedResult.count ?? 0) > 0 ? "warning" : "healthy",
      safeCount: failedResult.count ?? 0,
      sourceModule: "communications",
      routeHref: CRM_V2_COMMUNICATIONS_PATH,
      actionLabel: "Open communications",
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(failedResult.error),
    },
    {
      panelKey: "communications_stale_drafts",
      title: "Stale drafts",
      summary: "Drafts unchanged for more than seven days.",
      statusLevel: (draftStuckResult.count ?? 0) > 0 ? "attention" : "healthy",
      safeCount: draftStuckResult.count ?? 0,
      sourceModule: "communications",
      routeHref: CRM_V2_COMMUNICATIONS_PATH,
      actionLabel: "Review drafts",
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(draftStuckResult.error),
    },
  ];
}
