import "server-only";

import { buildCommunicationsWorkspaceHref } from "@/lib/crm-v2/communications/routes";
import { loadCrmCommunicationsEngagementSummary } from "@/lib/crm-v2/communications/communications";
import type { CrmFinancialPlanLink } from "@/lib/crm-v2/relationships/types";

export const CRM_COMMUNICATIONS_PHASE_NOTICE =
  "Communications are governed and consent-aware — draft or log only, no automatic external send.";

export async function loadCrmCommunicationsEngagementLink(
  clientId: string,
): Promise<CrmFinancialPlanLink> {
  const statusLabel = await loadCrmCommunicationsEngagementSummary(clientId);
  return {
    label: "Communications",
    href: `${buildCommunicationsWorkspaceHref()}?clientId=${clientId}`,
    statusLabel,
  };
}
