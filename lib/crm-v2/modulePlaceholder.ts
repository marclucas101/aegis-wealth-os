import type { CrmV2AccessDeniedReason } from "@/lib/crm-v2/access";

/**
 * Adviser-facing copy when a CRM V2 sub-module is unavailable inside the pilot shell.
 * Does not expose feature keys, env configuration, or allowlist details.
 */
export function crmV2ModuleUnavailableMessage(
  moduleLabel: string,
  reason: CrmV2AccessDeniedReason,
): string {
  if (reason === "feature_disabled") {
    return `${moduleLabel} is not enabled for your pilot session yet. Continue in another CRM V2 area, or use the classic adviser workspace for full book operations.`;
  }

  return `${moduleLabel} is not available in your current session. If you believe this is an error, contact your platform operator.`;
}
