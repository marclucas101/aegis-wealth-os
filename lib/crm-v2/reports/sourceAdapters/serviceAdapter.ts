import "server-only";

import { CRM_V2_SERVICE_PATH } from "@/lib/crm-v2/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { ReportCardDto } from "../types";

export async function loadServiceReportCards(input: {
  authUserId: string;
  dateRangeLabel: string;
  freshnessAt: string;
  fromIso: string;
  toIso: string;
}): Promise<ReportCardDto[]> {
  const admin = createAdminSupabaseClient();

  const [commitmentsResult, requestsResult, documentsResult] = await Promise.all([
    admin
      .from("service_commitments")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .in("status", ["open", "in_progress"])
      .gte("updated_at", input.fromIso)
      .lte("updated_at", input.toIso),
    admin
      .from("client_service_requests")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .in("status", ["submitted", "in_review", "in_progress"])
      .gte("updated_at", input.fromIso)
      .lte("updated_at", input.toIso),
    admin
      .from("client_service_requests")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("request_type", "document_request")
      .in("status", ["submitted", "in_review", "in_progress"]),
  ]);

  return [
    {
      reportKey: "service_commitments_open",
      title: "Open commitments",
      summary: "Service commitments updated in this period.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: commitmentsResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "service",
      routeHref: CRM_V2_SERVICE_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(commitmentsResult.error),
    },
    {
      reportKey: "service_requests_open",
      title: "Client requests",
      summary: "Open client service requests in this period.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: requestsResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "service",
      routeHref: CRM_V2_SERVICE_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(requestsResult.error),
    },
    {
      reportKey: "service_document_requests",
      title: "Document requests",
      summary: "Outstanding document requests from clients.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: documentsResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "service",
      routeHref: CRM_V2_SERVICE_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(documentsResult.error),
    },
  ];
}
