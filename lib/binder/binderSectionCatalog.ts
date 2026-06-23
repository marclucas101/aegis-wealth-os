import type { BinderSection } from "@/lib/binder/binderSectionPolicy";
import type { PublishedOutputType } from "@/lib/compliance/types";
import type { PublishedOutputRow } from "@/lib/supabase/compliancePublication";
import type { AppClientRow } from "@/lib/supabase/userProfile";

import { classifyClientPublicationAvailability } from "./binderPublicationAvailability";
import type { BinderSectionReasonCode } from "./binderSectionPolicy";
export const SECTION_OUTPUT_TYPES: Partial<Record<BinderSection, PublishedOutputType[]>> = {
  financial_overview: ["financial_overview", "financial_readiness_snapshot"],
  my_plan: ["client_plan_summary", "goal_plan_summary", "wealth_blueprint_summary"],
  agreed_priorities: ["goal_plan_summary", "client_plan_summary"],
  roadmap: ["roadmap_summary"],
  meeting_summary: ["meeting_summary", "annual_review_summary"],
};

export type BinderSectionContext = {
  client: AppClientRow;
  meetingDate: string | null;
  allPublications: PublishedOutputRow[];
  currentPublications: PublishedOutputRow[];
};

export type SectionAvailability = {
  sectionId: BinderSection;
  available: boolean;
  reasonCode: BinderSectionReasonCode | null;
  selectedPublication: PublishedOutputRow | null;
};

function formatDisplayDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function classifyPublicationAvailability(
  allPublications: PublishedOutputRow[],
  allowedTypes: PublishedOutputType[],
): { available: PublishedOutputRow | null; reasonCode: BinderSectionReasonCode | null } {
  return classifyClientPublicationAvailability(allPublications, allowedTypes);
}
export function assessSectionAvailability(
  sectionId: BinderSection,
  context: BinderSectionContext,
): SectionAvailability {
  switch (sectionId) {
    case "cover_page":
    case "client_adviser_info":
    case "document_index":
      return {
        sectionId,
        available: true,
        reasonCode: null,
        selectedPublication: null,
      };

    case "meeting_date": {
      const meetingDateLabel = formatDisplayDate(context.meetingDate);
      return {
        sectionId,
        available: Boolean(meetingDateLabel),
        reasonCode: meetingDateLabel ? null : "REQUIRED_INPUT_MISSING",
        selectedPublication: null,
      };
    }

    case "next_review_date": {
      const reviewLabel = formatDisplayDate(context.client.next_review_due);
      return {
        sectionId,
        available: Boolean(reviewLabel),
        reasonCode: reviewLabel ? null : "REQUIRED_INPUT_MISSING",
        selectedPublication: null,
      };
    }

    case "financial_overview":
    case "my_plan":
    case "agreed_priorities":
    case "roadmap":
    case "meeting_summary": {
      const types = SECTION_OUTPUT_TYPES[sectionId] ?? [];
      const { available, reasonCode } = classifyPublicationAvailability(
        context.allPublications,
        types,
      );
      return {
        sectionId,
        available: available !== null,
        reasonCode,
        selectedPublication: available,
      };
    }

    default:
      return {
        sectionId,
        available: false,
        reasonCode: "NO_PUBLISHED_SOURCE",
        selectedPublication: null,
      };
  }
}

export function assessRequestedSections(
  sectionIds: BinderSection[],
  context: BinderSectionContext,
): SectionAvailability[] {
  const unique = Array.from(new Set(sectionIds));
  return unique.map((sectionId) => assessSectionAvailability(sectionId, context));
}
