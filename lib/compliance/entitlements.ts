import "server-only";

import type { NavItem, NavSection } from "@/lib/navigation";
import { NAV_SECTIONS, PROSPECT_NAV_SECTIONS } from "@/lib/navigation";
import type { UserRole } from "@/lib/roles";
import { isAdvisorRole } from "@/lib/roles";
import type { AppClientRow, AppUserRow } from "@/lib/supabase/userProfile";

import { isFeatureEnabled, isFeatureVisibleToRole, FEATURE_DEFAULTS } from "./featureFlags";
import {
  isActiveClientStage,
  isProspectStage,
  resolveRelationshipStage,
} from "./relationshipStage";
import type { ClientFeatureKey, PlatformFeatureKey, RelationshipStage } from "./types";

export type UserExperienceContext = {
  userId: string;
  role: UserRole;
  clientId: string | null;
  relationshipStage: RelationshipStage | null;
  hasAssignedAdviser: boolean;
  isProspect: boolean;
  isActiveClient: boolean;
};

export type ClientEntitlements = {
  features: Record<ClientFeatureKey, boolean>;
  navHrefs: string[];
};

const PROSPECT_FEATURES: ClientFeatureKey[] = [
  "financial_readiness_snapshot",
  "complete_information",
  "meeting_preparation",
  "my_adviser",
  "appointments",
  "limited_documents",
];

const ACTIVE_CLIENT_FEATURES: ClientFeatureKey[] = [
  "financial_overview",
  "my_plan",
  "roadmap",
  "budget",
  "goals_and_reviews",
  "documents",
  "my_adviser",
  "insights_and_updates",
  "promotions",
];

/** Maps nav hrefs to entitlement feature keys. */
const HREF_TO_FEATURE: Record<string, ClientFeatureKey> = {
  "/prospect": "financial_readiness_snapshot",
  "/dashboard": "financial_readiness_snapshot",
  "/discover": "complete_information",
  "/profile": "complete_information",
  "/meeting-preparation": "meeting_preparation",
  "/my-adviser": "my_adviser",
  "/shield-diagnostic": "shield_diagnostic",
  "/stress-testing": "stress_testing",
  "/roadmap": "roadmap",
  "/budget-optimiser": "budget",
  "/annual-review": "goals_and_reviews",
  "/wealth-blueprint": "my_plan",
  "/document-vault": "documents",
  "/promotions": "insights_and_updates",
};

function resolveFeatureForHref(
  href: string,
  features: Record<ClientFeatureKey, boolean>,
): ClientFeatureKey | null {
  if (href === "/document-vault" && features.limited_documents && !features.documents) {
    return "limited_documents";
  }
  return HREF_TO_FEATURE[href] ?? null;
}

function buildFeatureMap(
  stage: RelationshipStage,
  role: UserRole,
  flags: Record<PlatformFeatureKey, boolean>,
): Record<ClientFeatureKey, boolean> {
  const allFalse = (): Record<ClientFeatureKey, boolean> => ({
    financial_readiness_snapshot: false,
    complete_information: false,
    meeting_preparation: false,
    my_adviser: false,
    appointments: false,
    limited_documents: false,
    financial_overview: false,
    my_plan: false,
    roadmap: false,
    budget: false,
    goals_and_reviews: false,
    documents: false,
    insights_and_updates: false,
    shield_diagnostic: false,
    stress_testing: false,
    wealth_blueprint: false,
    promotions: false,
  });

  if (role !== "client") {
    return allFalse();
  }

  const features = allFalse();

  if (isProspectStage(stage)) {
    for (const key of PROSPECT_FEATURES) {
      features[key] = true;
    }
    features.financial_readiness_snapshot =
      flags.prospect_readiness_snapshot ?? true;
    features.limited_documents = true;
    features.meeting_preparation = true;
    features.appointments = true;
    // Red features blocked for prospects
    features.shield_diagnostic = false;
    features.stress_testing = false;
    features.roadmap = false;
    features.wealth_blueprint = false;
    features.my_plan = false;
    features.goals_and_reviews = false;
  }

  if (isActiveClientStage(stage)) {
    for (const key of ACTIVE_CLIENT_FEATURES) {
      features[key] = true;
    }
    features.financial_overview =
      flags.client_published_financial_overview ?? true;
    features.insights_and_updates = flags.insights_and_updates ?? true;
    features.stress_testing = flags.client_stress_test_visibility ?? false;
    // Red features remain off unless legacy flag (dev only)
    features.shield_diagnostic = flags.raw_client_financial_views ?? false;
    features.roadmap = flags.raw_client_financial_views ?? false;
    features.wealth_blueprint = flags.raw_client_financial_views ?? false;
    features.goals_and_reviews = flags.raw_client_financial_views ?? false;
  }

  if (stage === "inactive_client") {
    features.my_adviser = true;
    features.limited_documents = true;
    features.documents = true;
  }

  return features;
}

export async function getUserExperienceContext(input: {
  user: AppUserRow;
  client: AppClientRow | null;
}): Promise<UserExperienceContext> {
  const stage = input.client
    ? resolveRelationshipStage(input.client as AppClientRow & { relationship_stage?: RelationshipStage })
    : null;

  return {
    userId: input.user.id,
    role: input.user.role,
    clientId: input.client?.id ?? null,
    relationshipStage: stage,
    hasAssignedAdviser: Boolean(input.client?.advisor_user_id),
    isProspect: stage ? isProspectStage(stage) : false,
    isActiveClient: stage ? isActiveClientStage(stage) : false,
  };
}

async function loadFeatureFlagMap(): Promise<Record<PlatformFeatureKey, boolean>> {
  const keys: PlatformFeatureKey[] = [
    "raw_client_financial_views",
    "prospect_readiness_snapshot",
    "client_published_financial_overview",
    "client_stress_test_visibility",
    "adviser_publication_workflow",
    "insights_and_updates",
  ];

  const entries = await Promise.all(
    keys.map(async (key) => [key, await isFeatureEnabled(key)] as const),
  );

  return Object.fromEntries(entries) as Record<PlatformFeatureKey, boolean>;
}

function defaultFlagMap(): Record<PlatformFeatureKey, boolean> {
  return Object.fromEntries(
    Object.entries(FEATURE_DEFAULTS).map(([key, value]) => [key, value.enabled]),
  ) as Record<PlatformFeatureKey, boolean>;
}

export async function getClientEntitlements(
  ctx: UserExperienceContext,
): Promise<ClientEntitlements> {
  if (ctx.role !== "client" || !ctx.relationshipStage) {
    return {
      features: buildFeatureMap("prospect", ctx.role, defaultFlagMap()),
      navHrefs: [],
    };
  }

  const flags = await loadFeatureFlagMap();
  const features = buildFeatureMap(ctx.relationshipStage, ctx.role, flags);

  const navHrefs = Object.keys(HREF_TO_FEATURE)
    .filter((href) => {
      const feature = resolveFeatureForHref(href, features);
      return feature ? features[feature] : false;
    })
    .map((href) => href);

  // Prospect home route
  if (features.financial_readiness_snapshot && !navHrefs.includes("/prospect")) {
    navHrefs.unshift("/prospect");
  }

  // Always allow profile
  if (!navHrefs.includes("/profile")) {
    navHrefs.push("/profile");
  }

  return { features, navHrefs };
}

export async function canAccessClientFeature(
  ctx: UserExperienceContext,
  feature: ClientFeatureKey,
): Promise<boolean> {
  const entitlements = await getClientEntitlements(ctx);
  return entitlements.features[feature] ?? false;
}

export async function canAccessInternalClientAnalysis(
  ctx: UserExperienceContext,
): Promise<boolean> {
  if (ctx.role === "admin" || isAdvisorRole(ctx.role)) {
    return true;
  }

  if (ctx.role === "client") {
    return isFeatureEnabled("raw_client_financial_views");
  }

  return false;
}

export async function canPublishClientOutput(input: {
  role: UserRole;
  isAssignedAdviser: boolean;
  isAdmin: boolean;
}): Promise<boolean> {
  const workflowEnabled = await isFeatureEnabled("adviser_publication_workflow");
  if (!workflowEnabled) {
    return false;
  }

  if (input.isAdmin) {
    return true;
  }

  if (isAdvisorRole(input.role) && input.isAssignedAdviser) {
    return true;
  }

  return false;
}

export function isNavItemVisibleForEntitlements(
  item: NavItem,
  role: UserRole | null,
  entitlements: ClientEntitlements | null,
): boolean {
  if (item.adminOnly) {
    return role === "admin";
  }

  if (item.clientOnly) {
    return role === "client";
  }

  if (item.advisorOnly) {
    return role !== null && isAdvisorRole(role);
  }

  if (role === "client" && entitlements) {
    const feature = resolveFeatureForHref(item.href, entitlements.features);
    if (feature) {
      return entitlements.features[feature] ?? false;
    }
  }

  return true;
}

export function getNavSectionsForEntitlements(
  role: UserRole | null,
  entitlements: ClientEntitlements | null,
): NavSection[] {
  if (role === "client" && entitlements) {
    const prospectNav = PROSPECT_NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        isNavItemVisibleForEntitlements(item, role, entitlements),
      ),
    })).filter((section) => section.items.length > 0);

    if (prospectNav.length > 0 && entitlements.features.shield_diagnostic === false) {
      const isProspectExperience =
        entitlements.features.financial_readiness_snapshot &&
        entitlements.features.complete_information &&
        !entitlements.features.financial_overview;

      if (isProspectExperience) {
        return prospectNav;
      }
    }
  }

  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      isNavItemVisibleForEntitlements(item, role, entitlements),
    ),
  })).filter((section) => section.items.length > 0);
}

export async function isClientFeatureKillSwitchActive(
  featureKey: PlatformFeatureKey,
): Promise<{ blockedForClient: boolean; availableForAdviser: boolean }> {
  const enabled = await isFeatureEnabled(featureKey);
  const clientVisible = await isFeatureVisibleToRole(featureKey, "client");
  const adviserVisible = await isFeatureVisibleToRole(featureKey, "advisor");

  return {
    blockedForClient: !enabled || !clientVisible,
    availableForAdviser: enabled && adviserVisible,
  };
}
