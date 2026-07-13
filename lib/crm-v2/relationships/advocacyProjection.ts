import "server-only";

import { buildAdvocacyWorkspaceHref } from "@/lib/crm-v2/advocacy/routes";
import { loadCrmAdvocacyEngagementSummary } from "@/lib/crm-v2/advocacy/advocacy";
import type { CrmFinancialPlanLink } from "@/lib/crm-v2/relationships/types";

export const CRM_ADVOCACY_PHASE_NOTICE =
  "Advocacy events are consent-aware and non-ranking — not used for sales priority.";

export async function loadCrmAdvocacyEngagementLink(
  clientId: string,
): Promise<CrmFinancialPlanLink> {
  const statusLabel = await loadCrmAdvocacyEngagementSummary(clientId);
  return {
    label: "Advocacy",
    href: buildAdvocacyWorkspaceHref(clientId),
    statusLabel,
  };
}
