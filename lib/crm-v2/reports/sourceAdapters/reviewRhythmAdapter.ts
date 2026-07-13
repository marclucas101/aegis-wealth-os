import "server-only";

import { CRM_V2_RELATIONSHIPS_PATH } from "@/lib/crm-v2/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { ReportCardDto } from "../types";

export async function loadReviewRhythmReportCards(input: {
  authUserId: string;
  dateRangeLabel: string;
  freshnessAt: string;
  toIso: string;
}): Promise<ReportCardDto[]> {
  const admin = createAdminSupabaseClient();

  const [reviewDueResult, momentsDueResult] = await Promise.all([
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("advisor_user_id", input.authUserId)
      .or("status.eq.review_due,next_review_due.lt." + input.toIso.slice(0, 10)),
    admin
      .from("crm_relationship_moments")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("status", "active")
      .lte("occurs_on", input.toIso.slice(0, 10)),
  ]);

  return [
    {
      reportKey: "review_rhythm_due",
      title: "Reviews due",
      summary: "Relationships with review rhythm due — no ethnicity exposed.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: reviewDueResult.count ?? 0,
      safePercentage: null,
      trendDirection: (reviewDueResult.count ?? 0) > 0 ? "up" : "flat",
      sourceModule: "relationship_moments",
      routeHref: CRM_V2_RELATIONSHIPS_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(reviewDueResult.error),
    },
    {
      reportKey: "relationship_moments_due",
      title: "Relationship moments due",
      summary: "Active moments occurring in this period.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: momentsDueResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "relationship_moments",
      routeHref: CRM_V2_RELATIONSHIPS_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(momentsDueResult.error),
    },
  ];
}
