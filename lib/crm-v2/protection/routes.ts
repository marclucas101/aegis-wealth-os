import type { CrmProtectionWorkspaceView } from "@/lib/crm-v2/protection/types";

export function parseProtectionWorkspaceView(
  value: string | null | undefined,
): CrmProtectionWorkspaceView {
  const allowed: CrmProtectionWorkspaceView[] = [
    "summary",
    "policies",
    "coverage",
    "awaiting_verification",
    "missing_documents",
    "version_history",
    "review_activity",
  ];
  if (value && (allowed as string[]).includes(value)) {
    return value as CrmProtectionWorkspaceView;
  }
  return "summary";
}

export function buildProtectionPortfolioHref(
  relationshipId: string,
  view?: CrmProtectionWorkspaceView,
  params?: Record<string, string>,
): string {
  const search = new URLSearchParams();
  if (view && view !== "summary") search.set("view", view);
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      search.set(key, val);
    }
  }
  const query = search.toString();
  return `/advisor-v2/relationships/${relationshipId}/protection${query ? `?${query}` : ""}`;
}
