import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import type { PlatformFeatureKey } from "@/lib/compliance/types";

export async function assertMeetingStudioEnabled(): Promise<void> {
  const enabled = await isFeatureEnabled("adviser_meeting_studio");
  if (!enabled) {
    throw new Error("Meeting Studio is currently unavailable");
  }
}

export async function assertPresentationModeEnabled(): Promise<void> {
  await assertMeetingStudioEnabled();
  const enabled = await isFeatureEnabled("meeting_presentation_mode");
  if (!enabled) {
    throw new Error("Meeting presentation mode is currently unavailable");
  }
}

export async function isExactAmountPresentationEnabled(): Promise<boolean> {
  return isFeatureEnabled("meeting_exact_amount_presentations");
}

export async function assertClientAcknowledgementsEnabled(): Promise<void> {
  await assertMeetingStudioEnabled();
  const enabled = await isFeatureEnabled("meeting_client_acknowledgements");
  if (!enabled) {
    throw new Error("Client acknowledgement capture is currently unavailable");
  }
}

export async function assertMeetingSummaryPublicationEnabled(): Promise<void> {
  await assertMeetingStudioEnabled();
  const enabled = await isFeatureEnabled("meeting_summary_publication");
  if (!enabled) {
    throw new Error("Meeting summary publication is currently unavailable");
  }
}

export async function isMeetingFeatureEnabled(
  key: PlatformFeatureKey,
): Promise<boolean> {
  return isFeatureEnabled(key);
}
