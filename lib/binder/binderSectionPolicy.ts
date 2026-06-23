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

/** Stable reason codes for adviser-safe readiness responses. */
export type BinderSectionReasonCode =
  | "NO_PUBLISHED_SOURCE"
  | "SOURCE_NOT_CURRENT"
  | "SOURCE_NOT_CLIENT_VISIBLE"
  | "REQUIRED_INPUT_MISSING";

export const BINDER_MANDATORY_SECTIONS = [
  "cover_page",
  "client_adviser_info",
  "meeting_date",
] as const satisfies readonly BinderSection[];

export const BINDER_PLANNING_SECTIONS = [
  "financial_overview",
  "my_plan",
  "agreed_priorities",
  "roadmap",
  "meeting_summary",
] as const satisfies readonly BinderSection[];

export const BINDER_OPTIONAL_SECTIONS = [
  "document_index",
  "next_review_date",
] as const satisfies readonly BinderSection[];

/** Sections requested when the adviser does not pass an explicit list. */
export const BINDER_DEFAULT_GENERATION_SECTIONS: BinderSection[] = [
  "cover_page",
  "client_adviser_info",
  "meeting_date",
  ...BINDER_PLANNING_SECTIONS,
  "document_index",
];

export const BINDER_SECTION_ADVISER_LABELS: Record<BinderSection, string> = {
  cover_page: "Cover page",
  client_adviser_info: "Client and adviser information",
  meeting_date: "Meeting date",
  financial_overview: "Financial overview",
  my_plan: "Current planning position",
  agreed_priorities: "Agreed priorities",
  roadmap: "Wealth roadmap",
  meeting_summary: "Meeting summary",
  document_index: "Document index",
  next_review_date: "Next review date",
};

export const BINDER_READINESS_USER_MESSAGE =
  "This client does not yet have enough published planning information to generate a meeting pack.";

export function isPlanningSection(sectionId: string): sectionId is (typeof BINDER_PLANNING_SECTIONS)[number] {
  return (BINDER_PLANNING_SECTIONS as readonly string[]).includes(sectionId);
}

export function isMandatorySection(sectionId: string): sectionId is (typeof BINDER_MANDATORY_SECTIONS)[number] {
  return (BINDER_MANDATORY_SECTIONS as readonly string[]).includes(sectionId);
}

export function isOptionalSection(sectionId: string): sectionId is (typeof BINDER_OPTIONAL_SECTIONS)[number] {
  return (BINDER_OPTIONAL_SECTIONS as readonly string[]).includes(sectionId);
}

/**
 * Minimum generation contract:
 * - cover + client/adviser info
 * - meeting date provided
 * - at least one planning section resolved
 */
export function meetsMinimumGenerationContract(input: {
  meetingDate: string | null;
  includedSectionIds: string[];
}): boolean {
  const hasMeetingDate = Boolean(input.meetingDate?.trim());
  const hasMandatory = BINDER_MANDATORY_SECTIONS.every((section) =>
    input.includedSectionIds.includes(section),
  );
  const hasPlanning = BINDER_PLANNING_SECTIONS.some((section) =>
    input.includedSectionIds.includes(section),
  );
  return hasMandatory && hasMeetingDate && hasPlanning;
}

export type ResolvableSectionSnapshot = {
  sectionId: BinderSection;
  available: boolean;
  reasonCode: BinderSectionReasonCode | null;
};

export const BINDER_SOURCE_UNAVAILABLE_CODE = "BINDER_SOURCE_UNAVAILABLE";

/**
 * Applies mandatory / optional / minimum-contract rules to assessed sections.
 * Throws Error with message BINDER_SOURCE_UNAVAILABLE_CODE when generation must not proceed.
 */
export function assertSectionsResolvableForGeneration(
  sections: ResolvableSectionSnapshot[],
  meetingDate: string | null,
): ResolvableSectionSnapshot[] {
  const included: ResolvableSectionSnapshot[] = [];

  for (const entry of sections) {
    if (entry.available) {
      included.push(entry);
      continue;
    }

    if (isMandatorySection(entry.sectionId)) {
      throw new Error(BINDER_SOURCE_UNAVAILABLE_CODE);
    }

    if (isOptionalSection(entry.sectionId)) {
      continue;
    }

    if ((BINDER_PLANNING_SECTIONS as readonly string[]).includes(entry.sectionId)) {
      continue;
    }

    throw new Error(BINDER_SOURCE_UNAVAILABLE_CODE);
  }

  const includedIds = included.map((entry) => entry.sectionId);
  if (!meetsMinimumGenerationContract({ meetingDate, includedSectionIds: includedIds })) {
    throw new Error(BINDER_SOURCE_UNAVAILABLE_CODE);
  }

  return included;
}

export function reasonCodeToAdviserPrerequisite(
  sectionId: BinderSection,
  reasonCode: BinderSectionReasonCode,
): string {
  const label = BINDER_SECTION_ADVISER_LABELS[sectionId] ?? sectionId;
  switch (reasonCode) {
    case "REQUIRED_INPUT_MISSING":
      if (sectionId === "meeting_date") return "Meeting date required";
      if (sectionId === "next_review_date") return "Next review date not set";
      return `${label} — required information missing`;
    case "NO_PUBLISHED_SOURCE":
      return `${label} not yet published`;
    case "SOURCE_NOT_CURRENT":
      return `${label} is not currently published to the client`;
    case "SOURCE_NOT_CLIENT_VISIBLE":
      return `${label} is not published for client access`;
    default:
      return `${label} unavailable`;
  }
}
