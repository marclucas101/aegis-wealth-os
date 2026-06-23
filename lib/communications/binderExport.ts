import "server-only";

import { generateBinderMeetingPack } from "@/lib/binder/binderGenerationService";
import type { BinderPublicMetadata } from "@/lib/binder/binderPdfTypes";
import {
  BINDER_SECTIONS,
  type BinderSection,
} from "@/lib/binder/binderSectionPolicy";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";

export { BINDER_SECTIONS, type BinderSection };

export async function generateBinderExport(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingDate?: string | null;
  sections: BinderSection[];
}): Promise<BinderPublicMetadata> {
  const enabled = await isFeatureEnabled("binder_export");
  if (!enabled) {
    throw new Error("Binder export is disabled");
  }

  return generateBinderMeetingPack({
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    userRole: input.userRole,
    meetingDate: input.meetingDate ?? null,
    sections: input.sections,
  });
}
