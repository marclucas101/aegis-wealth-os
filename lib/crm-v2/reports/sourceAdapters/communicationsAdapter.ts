import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { ReportCardDto } from "../types";

export async function loadCommunicationsReportCards(input: {
  authUserId: string;
  dateRangeLabel: string;
  freshnessAt: string;
  fromIso: string;
  toIso: string;
}): Promise<ReportCardDto[]> {
  const admin = createAdminSupabaseClient();

  const [draftsResult, followUpsResult, failedResult] = await Promise.all([
    admin
      .from("crm_communication_records")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("lifecycle_status", "draft")
      .gte("updated_at", input.fromIso)
      .lte("updated_at", input.toIso),
    admin
      .from("crm_communication_records")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("follow_up_required", true)
      .in("lifecycle_status", ["sent", "delivered"]),
    admin
      .from("crm_communication_records")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("delivery_status", "failed")
      .gte("updated_at", input.fromIso)
      .lte("updated_at", input.toIso),
  ]);

  return [
    {
      reportKey: "communications_drafts",
      title: "Draft communications",
      summary: "Draft messages — bodies not included in aggregate reports.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: draftsResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "communications",
      routeHref: "/advisor-v2/communications",
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(draftsResult.error),
    },
    {
      reportKey: "communications_follow_ups",
      title: "Follow-ups due",
      summary: "Communications requiring adviser follow-up.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: followUpsResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "communications",
      routeHref: "/advisor-v2/communications",
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(followUpsResult.error),
    },
    {
      reportKey: "communications_failed",
      title: "Delivery failures",
      summary: "Failed deliveries in this period — no raw provider payloads.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: failedResult.count ?? 0,
      safePercentage: null,
      trendDirection: (failedResult.count ?? 0) > 0 ? "up" : "flat",
      sourceModule: "communications",
      routeHref: "/advisor-v2/communications",
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(failedResult.error),
    },
  ];
}
