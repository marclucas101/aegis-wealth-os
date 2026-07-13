import type { CrmMomentsWorkspaceView } from "@/lib/crm-v2/moments/types";

export function parseMomentsWorkspaceView(
  value: string | null | undefined,
): CrmMomentsWorkspaceView {
  const allowed: CrmMomentsWorkspaceView[] = [
    "upcoming",
    "important_dates",
    "review_rhythm",
    "client_preferences",
    "festive_suggestions",
    "past_acknowledgements",
    "data_quality",
  ];
  if (value && (allowed as string[]).includes(value)) {
    return value as CrmMomentsWorkspaceView;
  }
  return "upcoming";
}

export function buildMomentsWorkspaceHref(
  relationshipId: string,
  view?: CrmMomentsWorkspaceView,
  params?: Record<string, string>,
): string {
  const search = new URLSearchParams();
  if (view && view !== "upcoming") search.set("view", view);
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      search.set(key, val);
    }
  }
  const query = search.toString();
  return `/advisor-v2/relationships/${relationshipId}/moments${query ? `?${query}` : ""}`;
}

export function buildClientPreferencesHref(): string {
  return "/preferences";
}
