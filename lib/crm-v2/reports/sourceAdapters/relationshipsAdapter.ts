import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { ReportCardDto } from "../types";

export async function loadRelationshipCoverageReportCards(input: {
  authUserId: string;
  dateRangeLabel: string;
  freshnessAt: string;
  fromIso: string;
  toIso: string;
}): Promise<ReportCardDto[]> {
  const admin = createAdminSupabaseClient();

  const [totalResult, activeResult, reviewDueResult] = await Promise.all([
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("advisor_user_id", input.authUserId),
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("advisor_user_id", input.authUserId)
      .eq("status", "active"),
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("advisor_user_id", input.authUserId)
      .or("status.eq.review_due,next_review_due.lt." + input.toIso.slice(0, 10)),
  ]);

  const total = totalResult.count ?? 0;
  const active = activeResult.count ?? 0;
  const reviewDue = reviewDueResult.count ?? 0;

  return [
    {
      reportKey: "relationship_total",
      title: "Assigned relationships",
      summary: "Clients assigned to you in CRM V2.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: total,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "relationships",
      routeHref: "/advisor-v2/relationships",
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(totalResult.error || activeResult.error || reviewDueResult.error),
    },
    {
      reportKey: "relationship_active",
      title: "Active relationships",
      summary: "Relationships with active servicing status.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: active,
      safePercentage: total > 0 ? Math.round((active / total) * 100) : null,
      trendDirection: "unknown",
      sourceModule: "relationships",
      routeHref: "/advisor-v2/relationships",
      freshnessAt: input.freshnessAt,
      partialDataWarning: false,
    },
    {
      reportKey: "relationship_review_due",
      title: "Reviews due",
      summary: "Relationships needing review attention.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: reviewDue,
      safePercentage: null,
      trendDirection: reviewDue > 0 ? "up" : "flat",
      sourceModule: "relationships",
      routeHref: "/advisor-v2/relationships",
      freshnessAt: input.freshnessAt,
      partialDataWarning: false,
    },
  ];
}
