import "server-only";

import { generateBinderMeetingPack } from "@/lib/binder/binderGenerationService";
import type { BinderPublicMetadata } from "@/lib/binder/binderPdfTypes";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";

export const BINDER_SECTIONS = [
  "cover_page",
  "client_adviser_info",
  "meeting_date",
  "financial_overview",
  "my_plan",
  "agreed_priorities",
  "roadmap",
  "meeting_summary",
  "document_index",
  "next_review_date",
] as const;

export type BinderSection = (typeof BINDER_SECTIONS)[number];

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
