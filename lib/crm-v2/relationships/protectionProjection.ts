import "server-only";

import { CRM_V2_PROTECTION_MAX_POLICIES } from "@/lib/crm-v2/constants";
import { buildProtectionPortfolioHref } from "@/lib/crm-v2/protection/routes";
import type { CrmFinancialPlanLink } from "@/lib/crm-v2/relationships/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const CRM_PROTECTION_PHASE_NOTICE =
  "Structured protection portfolio — adviser-verified policies only.";

export async function loadCrmProtectionFinancialPlanLink(
  clientId: string,
): Promise<CrmFinancialPlanLink> {
  const admin = createAdminSupabaseClient();
  const { count } = await admin
    .from("protection_policies")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .is("archived_at", null);

  const { count: pendingCount } = await admin
    .from("protection_extractions")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("adviser_review_status", ["provisional", "awaiting_review"]);

  let statusLabel = "Not established";
  if ((count ?? 0) > 0) {
    statusLabel = `${Math.min(count ?? 0, CRM_V2_PROTECTION_MAX_POLICIES)} confirmed policies`;
  }
  if ((pendingCount ?? 0) > 0) {
    statusLabel += ` · ${pendingCount} awaiting verification`;
  }

  return {
    label: "Protection portfolio",
    href: buildProtectionPortfolioHref(clientId),
    statusLabel,
  };
}

export async function loadCrmProtectionOverviewSummary(clientId: string): Promise<string> {
  const link = await loadCrmProtectionFinancialPlanLink(clientId);
  return link.statusLabel;
}
