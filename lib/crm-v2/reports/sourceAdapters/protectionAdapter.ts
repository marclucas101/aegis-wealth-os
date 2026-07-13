import "server-only";

import { CRM_V2_RELATIONSHIPS_PATH } from "@/lib/crm-v2/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { ReportCardDto } from "../types";

export async function loadProtectionReportCards(input: {
  authUserId: string;
  dateRangeLabel: string;
  freshnessAt: string;
}): Promise<ReportCardDto[]> {
  const admin = createAdminSupabaseClient();

  const clientIds = await admin
    .from("clients")
    .select("id")
    .eq("advisor_user_id", input.authUserId);

  const ids = ((clientIds.data ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (ids.length === 0) {
    return [
      {
        reportKey: "protection_verification_pending",
        title: "Verification pending",
        summary: "Policies awaiting adviser verification.",
        dateRangeLabel: input.dateRangeLabel,
        safeCount: 0,
        safePercentage: null,
        trendDirection: "flat",
        sourceModule: "protection",
        routeHref: CRM_V2_RELATIONSHIPS_PATH,
        freshnessAt: input.freshnessAt,
        partialDataWarning: Boolean(clientIds.error),
      },
    ];
  }

  const [pendingVerificationResult, extractionErrorsResult] = await Promise.all([
    admin
      .from("crm_protection_policies")
      .select("id", { count: "exact", head: true })
      .in("client_id", ids)
      .eq("verification_status", "pending"),
    admin
      .from("crm_protection_extractions")
      .select("id", { count: "exact", head: true })
      .in("client_id", ids)
      .eq("status", "failed"),
  ]);

  return [
    {
      reportKey: "protection_verification_pending",
      title: "Verification pending",
      summary: "Policies awaiting adviser verification — no policy numbers exposed.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: pendingVerificationResult.count ?? 0,
      safePercentage: null,
      trendDirection: (pendingVerificationResult.count ?? 0) > 0 ? "up" : "flat",
      sourceModule: "protection",
      routeHref: CRM_V2_RELATIONSHIPS_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(pendingVerificationResult.error),
    },
    {
      reportKey: "protection_extraction_errors",
      title: "Extraction errors",
      summary: "Protection extractions requiring attention.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: extractionErrorsResult.count ?? 0,
      safePercentage: null,
      trendDirection: (extractionErrorsResult.count ?? 0) > 0 ? "up" : "flat",
      sourceModule: "protection",
      routeHref: CRM_V2_RELATIONSHIPS_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(extractionErrorsResult.error),
    },
  ];
}
