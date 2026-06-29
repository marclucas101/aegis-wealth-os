/** Allowlisted internal route builders for CRM V2 relationship workspace. */

const ALLOWED_PREFIXES = [
  "/advisor-v2/relationships",
  "/advisor/clients",
  "/advisor/appointments",
] as const;

export type CrmV2RelationshipTab =
  | "overview"
  | "financial-plan"
  | "engagement"
  | "service"
  | "documents"
  | "profile";

export const CRM_V2_RELATIONSHIP_TABS: CrmV2RelationshipTab[] = [
  "overview",
  "financial-plan",
  "engagement",
  "service",
  "documents",
  "profile",
];

export function buildRelationshipListHref(): string {
  return "/advisor-v2/relationships";
}

export function buildRelationshipDetailHref(
  relationshipId: string,
  tab?: CrmV2RelationshipTab,
): string {
  const base = `/advisor-v2/relationships/${relationshipId}`;
  if (!tab || tab === "overview") {
    return base;
  }
  return `${base}?tab=${tab}`;
}

export function buildLegacyClientHref(clientId: string, section?: string): string {
  const base = `/advisor/clients/${clientId}`;
  if (!section) {
    return base;
  }
  return `${base}?tab=${section}`;
}

export function buildLegacyDiscoverHref(clientId: string): string {
  return `/advisor/clients/${clientId}?tab=discover`;
}

export function buildLegacyPlanningOutputsHref(clientId: string): string {
  return `/advisor/clients/${clientId}/planning-outputs`;
}

export function buildLegacyRoadmapHref(clientId: string): string {
  return `/advisor/clients/${clientId}/roadmap`;
}

export function buildLegacyMeetingStudioHref(clientId: string): string {
  return `/advisor/clients/${clientId}/meeting-studio`;
}

export function buildLegacyDocumentVaultHref(clientId: string): string {
  return `/advisor/clients/${clientId}?tab=documents`;
}

export function buildLegacyTasksHref(clientId: string): string {
  return `/advisor/clients/${clientId}?tab=tasks`;
}

export function isAllowlistedRelationshipLink(href: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`),
  );
}

export function parseRelationshipTab(
  value: string | null | undefined,
): CrmV2RelationshipTab {
  if (value && CRM_V2_RELATIONSHIP_TABS.includes(value as CrmV2RelationshipTab)) {
    return value as CrmV2RelationshipTab;
  }
  return "overview";
}
