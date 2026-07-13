import type { CrmCommunicationWorkspaceView } from "@/lib/crm-v2/communications/types";
import { CRM_V2_COMMUNICATIONS_PATH } from "@/lib/crm-v2/navigation";

const VALID_VIEWS = new Set<CrmCommunicationWorkspaceView>([
  "inbox",
  "drafts",
  "needs_review",
  "recent",
  "templates",
  "follow_ups",
  "preferences",
  "action_required",
]);

export function parseCommunicationsWorkspaceView(
  value: string | undefined,
): CrmCommunicationWorkspaceView {
  if (value && VALID_VIEWS.has(value as CrmCommunicationWorkspaceView)) {
    return value as CrmCommunicationWorkspaceView;
  }
  return "drafts";
}

export function buildCommunicationsWorkspaceHref(view?: CrmCommunicationWorkspaceView): string {
  const base = CRM_V2_COMMUNICATIONS_PATH;
  if (!view || view === "drafts") return base;
  return `${base}?view=${view}`;
}

export function buildClientMessagesHref(): string {
  return "/messages";
}

export function buildRelationshipCommunicationsHref(relationshipId: string): string {
  return `${CRM_V2_COMMUNICATIONS_PATH}?clientId=${relationshipId}`;
}
