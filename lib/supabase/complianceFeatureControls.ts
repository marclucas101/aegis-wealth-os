import "server-only";

import { createAdminSupabaseClient } from "./admin";

import type { PlatformFeatureKey } from "@/lib/compliance/types";

export type FeatureControlRow = {
  feature_key: PlatformFeatureKey;
  enabled: boolean;
  client_visible: boolean;
  adviser_visible: boolean;
  description: string | null;
};

export async function loadFeatureControlsFromDb(): Promise<FeatureControlRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("platform_feature_controls")
    .select("feature_key, enabled, client_visible, adviser_visible, description");

  if (error) {
    throw error;
  }

  return (data ?? []) as FeatureControlRow[];
}

export async function upsertFeatureControlInDb(input: {
  feature_key: PlatformFeatureKey;
  enabled: boolean;
  client_visible: boolean;
  adviser_visible: boolean;
  updated_by_user_id: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("platform_feature_controls").upsert({
    ...input,
    updated_at: new Date().toISOString(),
  } as never);

  if (error) {
    throw new Error(`Failed to update feature control: ${error.message}`);
  }
}
