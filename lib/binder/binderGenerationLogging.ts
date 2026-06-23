import "server-only";

import { logWarn } from "@/lib/ops/logger";

import type { BinderSectionReasonCode } from "./binderSectionPolicy";

export function logBinderGenerationSourceUnavailable(input: {
  clientId: string;
  adviserUserId: string;
  requestedSectionIds: string[];
  unavailableSections: Array<{ sectionId: string; reasonCode: BinderSectionReasonCode }>;
  requestId: string;
}): void {
  logWarn("binder_generation_source_unavailable", {
    action: "binder_generation_source_unavailable",
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    requestedSectionIds: input.requestedSectionIds,
    unavailableSectionIds: input.unavailableSections.map((entry) => entry.sectionId),
    unavailableReasonCodes: Object.fromEntries(
      input.unavailableSections.map((entry) => [entry.sectionId, entry.reasonCode]),
    ),
    requestId: input.requestId,
  });
}
