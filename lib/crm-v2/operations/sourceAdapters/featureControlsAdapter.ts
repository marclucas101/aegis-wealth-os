import "server-only";

import {
  CRM_V2_MASTER_FEATURE_KEY,
  CRM_V2_PILOT_MODE_FEATURE_KEY,
  CRM_V2_REPORTS_FEATURE_KEY,
  CRM_V2_OPERATIONS_FEATURE_KEY,
  CRM_V2_TODAY_FEATURE_KEY,
} from "@/lib/crm-v2/constants";
import { loadFeatureControls } from "@/lib/compliance/featureFlags";
import type { PlatformFeatureKey } from "@/lib/compliance/types";

import type { FeatureControlStatusDto } from "../types";

const CRM_V2_OPERATION_FEATURE_KEYS: PlatformFeatureKey[] = [
  CRM_V2_MASTER_FEATURE_KEY,
  CRM_V2_PILOT_MODE_FEATURE_KEY,
  CRM_V2_TODAY_FEATURE_KEY,
  CRM_V2_REPORTS_FEATURE_KEY,
  CRM_V2_OPERATIONS_FEATURE_KEY,
  "crm_v2_relationships",
  "crm_v2_appointments_adviser",
  "crm_v2_google_calendar",
  "crm_v2_service",
  "crm_v2_protection_portfolio",
  "crm_v2_relationship_moments",
  "crm_v2_advocacy",
  "crm_v2_communications",
  "adviser_work_queue",
];

export async function loadCrmV2FeatureControlStatus(): Promise<FeatureControlStatusDto[]> {
  const controls = await loadFeatureControls();
  return CRM_V2_OPERATION_FEATURE_KEYS.map((key) => {
    const row = controls.get(key);
    return {
      featureKey: key,
      enabled: row?.enabled ?? false,
      adviserVisible: row?.adviser_visible ?? false,
      clientVisible: row?.client_visible ?? false,
      pilotRequired: key !== CRM_V2_MASTER_FEATURE_KEY && key !== CRM_V2_PILOT_MODE_FEATURE_KEY,
      description: row?.description ?? null,
      lastUpdatedAt: null,
    };
  });
}
