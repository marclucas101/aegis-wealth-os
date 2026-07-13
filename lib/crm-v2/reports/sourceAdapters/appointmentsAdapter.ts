import "server-only";

import { CRM_V2_APPOINTMENTS_PATH } from "@/lib/crm-v2/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import type { ReportCardDto } from "../types";

export async function loadAppointmentReportCards(input: {
  authUserId: string;
  dateRangeLabel: string;
  freshnessAt: string;
  fromIso: string;
  toIso: string;
}): Promise<ReportCardDto[]> {
  const admin = createAdminSupabaseClient();

  const [upcomingResult, prepResult, followUpResult] = await Promise.all([
    admin
      .from("adviser_appointments")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .gte("starts_at", input.fromIso)
      .lte("starts_at", input.toIso)
      .not("crm_lifecycle_status", "in", "(cancelled_by_adviser,cancelled_by_client,closed,no_show)"),
    admin
      .from("adviser_appointments")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .in("crm_lifecycle_status", ["preparing", "ready"]),
    admin
      .from("adviser_appointments")
      .select("id", { count: "exact", head: true })
      .eq("adviser_user_id", input.authUserId)
      .eq("crm_lifecycle_status", "follow_up_required"),
  ]);

  return [
    {
      reportKey: "appointments_upcoming",
      title: "Upcoming appointments",
      summary: "Scheduled appointments in the selected period.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: upcomingResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "appointments",
      routeHref: CRM_V2_APPOINTMENTS_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(upcomingResult.error),
    },
    {
      reportKey: "appointments_preparation",
      title: "Preparation in progress",
      summary: "Appointments in preparing or ready state.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: prepResult.count ?? 0,
      safePercentage: null,
      trendDirection: "unknown",
      sourceModule: "appointments",
      routeHref: CRM_V2_APPOINTMENTS_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(prepResult.error),
    },
    {
      reportKey: "appointments_follow_up",
      title: "Follow-up required",
      summary: "Appointments awaiting adviser follow-up.",
      dateRangeLabel: input.dateRangeLabel,
      safeCount: followUpResult.count ?? 0,
      safePercentage: null,
      trendDirection: (followUpResult.count ?? 0) > 0 ? "up" : "flat",
      sourceModule: "appointments",
      routeHref: CRM_V2_APPOINTMENTS_PATH,
      freshnessAt: input.freshnessAt,
      partialDataWarning: Boolean(followUpResult.error),
    },
  ];
}
