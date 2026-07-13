import "server-only";

import { buildMomentsWorkspaceHref } from "@/lib/crm-v2/moments/routes";
import { loadCrmMomentsEngagementSummary } from "@/lib/crm-v2/moments/moments";
import type { CrmFinancialPlanLink } from "@/lib/crm-v2/relationships/types";

export const CRM_MOMENTS_PHASE_NOTICE =
  "Relationship moments and review rhythm — adviser-confirmed dates only.";

export async function loadCrmMomentsEngagementLink(
  clientId: string,
): Promise<CrmFinancialPlanLink> {
  const statusLabel = await loadCrmMomentsEngagementSummary(clientId);
  return {
    label: "Relationship moments",
    href: buildMomentsWorkspaceHref(clientId),
    statusLabel,
  };
}
