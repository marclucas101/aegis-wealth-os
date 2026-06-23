import "server-only";

import {
  buildBinderSectionReadiness,
  type BinderSectionReadiness,
} from "@/lib/binder/binderContentPreparation";
import { evaluateBinderGenerationEligibility } from "@/lib/binder/binderGenerationEligibility";
import {
  defaultSectionsForPurpose,
  type BinderPackPurpose,
} from "@/lib/binder/binderPackPurpose";
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
  purpose: BinderPackPurpose;
  ready: boolean;
  availableSections: string[];
  unavailableSections: Array<{
    sectionId: string;
    reasonCode: BinderSectionReasonCode;
  }>;
  sections: BinderSectionReadiness[];
  summaryMessage: string | null;
  blockingReasons: Array<{
    code: string;
    message: string;
    sectionId?: BinderSection;
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

export function buildBinderReadinessResult(input: {
  sections: SectionAvailability[];
  meetingDate: string | null;
  purpose: BinderPackPurpose;
  clientId: string;
  allPublications: BinderSectionContext["allPublications"];
  hasNextReviewDate: boolean;
  selectedSectionIds?: string[];
}): BinderReadinessResult {
  const availableSections = input.sections
    .filter((entry) => entry.available)
    .map((entry) => entry.sectionId);

  const unavailableSections = input.sections
    .filter((entry) => !entry.available && entry.reasonCode)
    .map((entry) => ({
      sectionId: entry.sectionId,
      reasonCode: entry.reasonCode as BinderSectionReasonCode,
    }));

  const sectionIds = input.sections.map((entry) => entry.sectionId);
  const readinessSections = sectionIds.map((sectionId) =>
    buildBinderSectionReadiness({
      sectionId,
      clientId: input.clientId,
      purpose: input.purpose,
      allPublications: input.allPublications,
      meetingDate: input.meetingDate,
      hasNextReviewDate: input.hasNextReviewDate,
    }),
  );

  const defaultSelected = input.selectedSectionIds ?? defaultSectionsForPurpose(input.purpose);
  const eligibility = evaluateBinderGenerationEligibility({
    purpose: input.purpose,
    meetingDate: input.meetingDate,
    selectedSectionIds: defaultSelected,
    sectionReadiness: readinessSections,
  });
  const ready = eligibility.eligible;

  return {
    purpose: input.purpose,
    ready,
    availableSections,
    unavailableSections,
    sections: readinessSections,
    summaryMessage: eligibility.summaryMessage,
    blockingReasons: eligibility.blockingReasons,
  };
}

export async function assessBinderReadiness(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingDate: string | null;
  purpose?: BinderPackPurpose;
  sections?: BinderSection[];
  selectedSectionIds?: string[];
}): Promise<BinderReadinessAssessment> {
  const purpose = input.purpose ?? "meeting_preparation";
  const context = await loadBinderSectionContext(input);
  const sectionIds = input.sections ?? [...BINDER_DEFAULT_GENERATION_SECTIONS];
  const sections = assessRequestedSections(sectionIds, context);
  const readiness = buildBinderReadinessResult({
    sections,
    meetingDate: input.meetingDate,
    purpose,
    clientId: input.clientId,
    allPublications: context.allPublications,
    hasNextReviewDate: Boolean(context.client.next_review_due),
    selectedSectionIds: input.selectedSectionIds,
  });

  return { readiness, context, sections };
}

/** Legacy contract check used by generation resolvers. */
export function meetsLegacyMinimumContract(
  sections: SectionAvailability[],
  meetingDate: string | null,
): boolean {
  const availableSections = sections
    .filter((entry) => entry.available)
    .map((entry) => entry.sectionId);
  return meetsMinimumGenerationContract({
    meetingDate,
    includedSectionIds: availableSections,
  });
}
