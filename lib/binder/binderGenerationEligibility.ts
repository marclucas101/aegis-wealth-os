import type { BinderSectionReadiness } from "@/lib/binder/binderContentPreparation";
import type { BinderPackPurpose } from "@/lib/binder/binderPackPurpose";
import {
  BINDER_MANDATORY_SECTIONS,
  BINDER_PLANNING_SECTIONS,
  type BinderSection,
} from "@/lib/binder/binderSectionPolicy";

export type BinderBlockingReason = {
  code: string;
  message: string;
  sectionId?: BinderSection;
};

export type BinderGenerationEligibility = {
  eligible: boolean;
  blockingReasons: BinderBlockingReason[];
  selectedAvailableSections: BinderSection[];
  contentSectionCount: number;
  totalPackSectionCount: number;
  summaryMessage: string | null;
};

const AUTO_INCLUDED_SECTIONS: BinderSection[] = [
  "cover_page",
  "client_adviser_info",
  "meeting_date",
];

const CONTENT_PLANNING_SECTIONS = new Set<string>(BINDER_PLANNING_SECTIONS);

const OPTIONAL_CONTENT_SECTIONS = new Set<BinderSection>(["document_index"]);

function isContentSection(sectionId: BinderSection): boolean {
  return CONTENT_PLANNING_SECTIONS.has(sectionId) || OPTIONAL_CONTENT_SECTIONS.has(sectionId);
}

export function evaluateBinderGenerationEligibility(input: {
  purpose: BinderPackPurpose;
  meetingDate: string | null;
  selectedSectionIds: string[];
  sectionReadiness: BinderSectionReadiness[];
}): BinderGenerationEligibility {
  const blockingReasons: BinderBlockingReason[] = [];
  const selected = new Set(input.selectedSectionIds);
  const readinessById = new Map(
    input.sectionReadiness.map((section) => [section.sectionId, section]),
  );

  if (!input.meetingDate?.trim()) {
    blockingReasons.push({
      code: "MEETING_DATE_REQUIRED",
      message: "Choose a meeting date before generating.",
      sectionId: "meeting_date",
    });
  }

  for (const mandatory of BINDER_MANDATORY_SECTIONS) {
    const row = readinessById.get(mandatory);
    if (mandatory === "meeting_date") {
      if (input.meetingDate?.trim() && row && row.status !== "available") {
        blockingReasons.push({
          code: "MEETING_DATE_UNAVAILABLE",
          message: "Meeting date is required before generating.",
          sectionId: mandatory,
        });
      }
      continue;
    }
    if (row && row.status !== "available") {
      blockingReasons.push({
        code: "MANDATORY_SECTION_UNAVAILABLE",
        message: `${row.label} is required but unavailable.`,
        sectionId: mandatory,
      });
    }
  }

  const selectedRows = input.sectionReadiness.filter((section) =>
    selected.has(section.sectionId),
  );

  for (const row of selectedRows) {
    if (row.status !== "available") {
      blockingReasons.push({
        code: "SELECTED_SECTION_UNAVAILABLE",
        message: `${row.label} is selected but not published.`,
        sectionId: row.sectionId,
      });
    }
  }

  const selectedAvailableSections = selectedRows
    .filter((row) => row.status === "available")
    .map((row) => row.sectionId);

  const selectedAvailablePlanning = selectedAvailableSections.filter((sectionId) =>
    CONTENT_PLANNING_SECTIONS.has(sectionId),
  );

  if (input.purpose === "meeting_preparation" && selectedAvailablePlanning.length === 0) {
    blockingReasons.push({
      code: "NO_PUBLISHED_PLANNING_SECTION",
      message: "Select at least one published planning section to include in the pack.",
    });
  }

  const contentSectionCount = selectedAvailableSections.filter((sectionId) =>
    isContentSection(sectionId),
  ).length;

  const totalPackSectionCount = AUTO_INCLUDED_SECTIONS.length + contentSectionCount;

  const eligible = blockingReasons.length === 0;

  return {
    eligible,
    blockingReasons,
    selectedAvailableSections,
    contentSectionCount,
    totalPackSectionCount,
    summaryMessage: eligible
      ? `Ready to generate with ${contentSectionCount} content section${contentSectionCount === 1 ? "" : "s"}. Cover, client information and meeting date are included automatically.`
      : null,
  };
}

/** @deprecated Use evaluateBinderGenerationEligibility */
export function canGenerateWithSelectedSections(input: {
  meetingDate: string | null;
  sections: BinderSectionReadiness[];
  selectedSectionIds: string[];
}): boolean {
  return evaluateBinderGenerationEligibility({
    purpose: "meeting_preparation",
    meetingDate: input.meetingDate,
    selectedSectionIds: input.selectedSectionIds,
    sectionReadiness: input.sections,
  }).eligible;
}
