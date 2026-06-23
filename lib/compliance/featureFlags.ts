import "server-only";

import {
  loadFeatureControlsFromDb,
  upsertFeatureControlInDb,
  type FeatureControlRow,
} from "@/lib/supabase/complianceFeatureControls";

import type { PlatformFeatureKey } from "./types";

/** Production-safe code defaults when DB row is absent. Fail-closed for restricted features. */
export const FEATURE_DEFAULTS: Record<
  PlatformFeatureKey,
  Pick<FeatureControlRow, "enabled" | "client_visible" | "adviser_visible">
> = {
  raw_client_financial_views: {
    enabled: false,
    client_visible: false,
    adviser_visible: true,
  },
  prospect_readiness_snapshot: {
    enabled: true,
    client_visible: true,
    adviser_visible: true,
  },
  client_published_financial_overview: {
    enabled: true,
    client_visible: true,
    adviser_visible: true,
  },
  client_stress_test_visibility: {
    enabled: false,
    client_visible: false,
    adviser_visible: true,
  },
  adviser_publication_workflow: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  insights_and_updates: {
    enabled: true,
    client_visible: true,
    adviser_visible: true,
  },
  adviser_meeting_studio: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  meeting_presentation_mode: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  meeting_exact_amount_presentations: {
    enabled: false,
    client_visible: false,
    adviser_visible: true,
  },
  meeting_client_acknowledgements: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  meeting_summary_publication: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  adviser_insight_authoring: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  admin_content_approval: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  market_updates: {
    enabled: true,
    client_visible: true,
    adviser_visible: true,
  },
  product_related_content: {
    enabled: false,
    client_visible: false,
    adviser_visible: true,
  },
  client_in_app_notifications: {
    enabled: true,
    client_visible: true,
    adviser_visible: false,
  },
  client_email_notifications: {
    enabled: true,
    client_visible: true,
    adviser_visible: false,
  },
  document_event_notifications: {
    enabled: true,
    client_visible: true,
    adviser_visible: true,
  },
  communication_preferences: {
    enabled: true,
    client_visible: true,
    adviser_visible: false,
  },
  binder_export: {
    enabled: true,
    client_visible: false,
    adviser_visible: true,
  },
  binder_client_publication: {
    enabled: false,
    client_visible: false,
    adviser_visible: true,
  },
  scheduled_content_automation: {
    enabled: false,
    client_visible: false,
    adviser_visible: true,
  },
  legacy_promotions_write: {
    enabled: false,
    client_visible: false,
    adviser_visible: true,
  },
};

let cachedControls: Map<PlatformFeatureKey, FeatureControlRow> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

export type { FeatureControlRow };

export async function loadFeatureControls(): Promise<
  Map<PlatformFeatureKey, FeatureControlRow>
> {
  const now = Date.now();
  if (cachedControls && now < cacheExpiresAt) {
    return cachedControls;
  }

  const map = new Map<PlatformFeatureKey, FeatureControlRow>();

  for (const key of Object.keys(FEATURE_DEFAULTS) as PlatformFeatureKey[]) {
    const defaults = FEATURE_DEFAULTS[key];
    map.set(key, {
      feature_key: key,
      enabled: defaults.enabled,
      client_visible: defaults.client_visible,
      adviser_visible: defaults.adviser_visible,
      description: null,
    });
  }

  try {
    const data = await loadFeatureControlsFromDb();
    for (const row of data) {
      map.set(row.feature_key, row);
    }
  } catch (error) {
    console.warn(
      "[featureFlags] Using fail-closed code defaults; platform_feature_controls unavailable:",
      error instanceof Error ? error.message : String(error),
    );
  }

  cachedControls = map;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return map;
}

export function clearFeatureControlCache(): void {
  cachedControls = null;
  cacheExpiresAt = 0;
}

export async function isFeatureEnabled(
  featureKey: PlatformFeatureKey,
): Promise<boolean> {
  const controls = await loadFeatureControls();
  return controls.get(featureKey)?.enabled ?? FEATURE_DEFAULTS[featureKey].enabled;
}

export async function isFeatureVisibleToRole(
  featureKey: PlatformFeatureKey,
  role: "client" | "advisor" | "admin",
): Promise<boolean> {
  const controls = await loadFeatureControls();
  const row = controls.get(featureKey) ?? {
    feature_key: featureKey,
    ...FEATURE_DEFAULTS[featureKey],
    description: null,
  };

  if (!row.enabled) {
    return false;
  }

  if (role === "client") {
    return row.client_visible;
  }

  if (role === "advisor" || role === "admin") {
    return row.adviser_visible;
  }

  return false;
}

/** Emergency admin override — persists to DB and clears cache. */
export async function setFeatureControl(
  featureKey: PlatformFeatureKey,
  patch: Partial<Pick<FeatureControlRow, "enabled" | "client_visible" | "adviser_visible">>,
  updatedByUserId: string,
): Promise<FeatureControlRow> {
  const defaults = FEATURE_DEFAULTS[featureKey];
  const current = (await loadFeatureControls()).get(featureKey);

  const next = {
    feature_key: featureKey,
    enabled: patch.enabled ?? current?.enabled ?? defaults.enabled,
    client_visible:
      patch.client_visible ?? current?.client_visible ?? defaults.client_visible,
    adviser_visible:
      patch.adviser_visible ?? current?.adviser_visible ?? defaults.adviser_visible,
    updated_by_user_id: updatedByUserId,
  };

  await upsertFeatureControlInDb(next);

  clearFeatureControlCache();
  return { ...next, description: current?.description ?? null };
}
