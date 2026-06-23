import {
  BINDER_MANDATORY_SECTIONS,
  BINDER_OPTIONAL_SECTIONS,
  BINDER_PLANNING_SECTIONS,
  type BinderSection,
  isMandatorySection,
  isPlanningSection,
} from "@/lib/binder/binderSectionPolicy";

export type BinderPackPurpose =
  | "meeting_preparation"
  | "meeting_record"
  | "annual_review";

/** Purposes exposed in adviser UI — only include when workflow is usable. */
export const BINDER_UI_PACK_PURPOSES: BinderPackPurpose[] = ["meeting_preparation"];

export const BINDER_PACK_PURPOSE_LABELS: Record<BinderPackPurpose, string> = {
  meeting_preparation: "Meeting preparation",
  meeting_record: "Meeting record",
  annual_review: "Annual review",
};

/** Sections normally created after the meeting — not required for preparation packs. */
export const BINDER_POST_MEETING_SECTIONS = ["meeting_summary"] as const satisfies readonly BinderSection[];

/** Pre-meeting core planning sections advisers may include when preparing. */
export const BINDER_PRE_MEETING_CORE_SECTIONS = [
  "financial_overview",
  "my_plan",
  "agreed_priorities",
  "roadmap",
  "document_index",
] as const satisfies readonly BinderSection[];

export function parseBinderPackPurpose(value: string | null | undefined): BinderPackPurpose {
  if (value === "meeting_record" || value === "annual_review") {
    return value;
  }
  return "meeting_preparation";
}

export function isPostMeetingSection(sectionId: BinderSection): boolean {
  return (BINDER_POST_MEETING_SECTIONS as readonly string[]).includes(sectionId);
}

export function isRequiredForPurpose(
  sectionId: BinderSection,
  purpose: BinderPackPurpose,
): boolean {
  if (purpose === "meeting_preparation") {
    if (sectionId === "meeting_date") return true;
    if (isPostMeetingSection(sectionId)) return false;
    return false;
  }
  if (purpose === "meeting_record") {
    return sectionId === "meeting_date" || sectionId === "meeting_summary";
  }
  if (purpose === "annual_review") {
    return (
      sectionId === "meeting_date" ||
      sectionId === "financial_overview" ||
      sectionId === "meeting_summary"
    );
  }
  return false;
}

export function isSelectedByDefault(
  sectionId: BinderSection,
  purpose: BinderPackPurpose,
): boolean {
  if (isMandatorySection(sectionId)) return true;

  if (purpose === "meeting_preparation") {
    if (isPostMeetingSection(sectionId)) return false;
    if (sectionId === "next_review_date") return false;
    if (sectionId === "roadmap") return false;
    if (isPlanningSection(sectionId)) return true;
    if (sectionId === "document_index") return true;
    return false;
  }

  if (purpose === "meeting_record") {
    return (
      sectionId === "meeting_summary" ||
      sectionId === "agreed_priorities" ||
      sectionId === "roadmap"
    );
  }

  if (purpose === "annual_review") {
    return (
      sectionId === "financial_overview" ||
      sectionId === "my_plan" ||
      sectionId === "meeting_summary" ||
      sectionId === "document_index"
    );
  }

  return false;
}

export function defaultSectionsForPurpose(purpose: BinderPackPurpose): BinderSection[] {
  const all = [
    ...BINDER_MANDATORY_SECTIONS,
    ...BINDER_PLANNING_SECTIONS,
    ...BINDER_OPTIONAL_SECTIONS,
  ] as BinderSection[];
  return all.filter((sectionId) => isSelectedByDefault(sectionId, purpose));
}
