import "server-only";

import { CRM_V2_RELATIONSHIPS_PATH } from "@/lib/crm-v2/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { OperationsPanelDto } from "../types";

export async function loadProtectionExtractionOperationsPanels(input: {
  authUserId: string;
  freshnessAt: string;
}): Promise<OperationsPanelDto[]> {
  const admin = createAdminSupabaseClient();

  const { data: clients } = await admin
    .from("clients")
    .select("id")
    .eq("advisor_user_id", input.authUserId);

  const ids = ((clients ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length === 0) {
    return [
      {
        panelKey: "protection_extraction_none",
        title: "Extraction errors",
        summary: "No assigned relationships — no extraction exceptions.",
        statusLevel: "healthy",
        safeCount: 0,
        sourceModule: "protection",
        routeHref: CRM_V2_RELATIONSHIPS_PATH,
        actionLabel: null,
        freshnessAt: input.freshnessAt,
        partialDataWarning: false,
      },
    ];
  }

  const { count, error } = await admin
    .from("crm_protection_extractions")
    .select("id", { count: "exact", head: true })
    .in("client_id", ids)
    .eq("status", "failed");

  return [
    {
      panelKey: "protection_extraction_errors",
      title: "Extraction errors",
      summary: "Failed extractions — source document content is not exposed.",
      statusLevel: (count ?? 0) > 0 ? "warning" : "healthy",
      safeCount: count ?? 0,
      sourceModule: "protection",
      routeHref: CRM_V2_RELATIONSHIPS_PATH,
      actionLabel: (count ?? 0) > 0 ? "Review protection workspace" : null,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(error),
    },
  ];
}
