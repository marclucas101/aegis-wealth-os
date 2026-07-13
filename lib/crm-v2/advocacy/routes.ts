import type { CrmAdvocacyWorkspaceView } from "@/lib/crm-v2/advocacy/types";

const VALID_VIEWS = new Set<CrmAdvocacyWorkspaceView>([
  "history",
  "introductions",
  "referrals",
  "testimonials",
  "follow_up",
  "consent",
  "summary",
]);

export function parseAdvocacyWorkspaceView(value: string | undefined): CrmAdvocacyWorkspaceView {
  if (value && VALID_VIEWS.has(value as CrmAdvocacyWorkspaceView)) {
    return value as CrmAdvocacyWorkspaceView;
  }
  return "history";
}

export function buildAdvocacyWorkspaceHref(relationshipId: string, view?: CrmAdvocacyWorkspaceView): string {
  const base = `/advisor-v2/relationships/${relationshipId}/advocacy`;
  if (!view || view === "history") return base;
  return `${base}?view=${view}`;
}

export function buildClientAdvocacyPreferencesHref(): string {
  return "/preferences/advocacy";
}
