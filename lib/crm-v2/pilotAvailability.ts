import "server-only";

import { assertCrmV2Access } from "@/lib/crm-v2/access";

/**
 * Read-only availability check for legacy adviser UI entry points.
 * Uses the same fail-closed gate as /advisor-v2 layout — does not weaken access rules.
 */
export async function isCrmV2PilotAvailable(): Promise<boolean> {
  const access = await assertCrmV2Access();
  return access.allowed;
}
