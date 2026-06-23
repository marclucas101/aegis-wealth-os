import "server-only";

import {
  BINDER_DEFAULT_GENERATION_SECTIONS,
  meetsMinimumGenerationContract,
  type BinderSectionReasonCode,
} from "@/lib/binder/binderSectionPolicy";
import type { BinderSection } from "@/lib/binder/binderSectionPolicy";
import { isCurrentPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { dbListPublishedOutputsForClient } from "@/lib/supabase/compliancePublication";

import { BINDER_ERROR_CODES, BinderServiceError } from "./binderErrors";
import {
  assessRequestedSections,
  type BinderSectionContext,
  type SectionAvailability,
} from "./binderSectionCatalog";

export type BinderReadinessResult = {
  ready: boolean;
  availableSections: string[];
  unavailableSections: Array<{
    sectionId: string;
    reasonCode: BinderSectionReasonCode;
  }>;
};

export type BinderReadinessAssessment = {
  readiness: BinderReadinessResult;
  context: BinderSectionContext;
  sections: SectionAvailability[];
};

export async function loadBinderSectionContext(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingDate: string | null;
}): Promise<BinderSectionContext> {
  const access = await resolveAccessibleClient(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );
  if (access.status !== "ok") {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  const publications = await dbListPublishedOutputsForClient(input.clientId);
  return {
    client: access.client,
    meetingDate: input.meetingDate,
    allPublications: publications,
    currentPublications: publications.filter(isCurrentPublishedOutput),
  };
}

export function buildBinderReadinessResult(
  sections: SectionAvailability[],
  meetingDate: string | null,
): BinderReadinessResult {
  const availableSections = sections
    .filter((entry) => entry.available)
    .map((entry) => entry.sectionId);

  const unavailableSections = sections
    .filter((entry) => !entry.available && entry.reasonCode)
    .map((entry) => ({
      sectionId: entry.sectionId,
      reasonCode: entry.reasonCode as BinderSectionReasonCode,
    }));

  const ready = meetsMinimumGenerationContract({
    meetingDate,
    includedSectionIds: availableSections,
  });

  return {
    ready,
    availableSections,
    unavailableSections,
  };
}

export async function assessBinderReadiness(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingDate: string | null;
  sections?: BinderSection[];
}): Promise<BinderReadinessAssessment> {
  const context = await loadBinderSectionContext(input);
  const sectionIds = input.sections ?? [...BINDER_DEFAULT_GENERATION_SECTIONS];
  const sections = assessRequestedSections(sectionIds, context);
  const readiness = buildBinderReadinessResult(sections, input.meetingDate);

  return { readiness, context, sections };
}
