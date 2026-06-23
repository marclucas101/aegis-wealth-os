import { classifyClientPublicationAvailability } from "@/lib/binder/binderPublicationAvailability";
import { SECTION_OUTPUT_TYPES } from "@/lib/binder/binderSectionCatalog";
import {
  BINDER_SECTION_ADVISER_LABELS,
  type BinderSection,
} from "@/lib/binder/binderSectionPolicy";
import type { PublishedOutputRow } from "@/lib/supabase/compliancePublication";

import {
  isPostMeetingSection,
  isRequiredForPurpose,
  isSelectedByDefault,
  type BinderPackPurpose,
} from "./binderPackPurpose";

export type BinderSectionReadinessStatus =
  | "available"
  | "draft_available"
  | "not_created"
  | "not_published"
  | "not_current"
  | "not_client_visible";

export type BinderSectionReadinessAction = {
  type: "create" | "review" | "publish" | "open_source";
  label: string;
  href: string;
};

export type BinderSectionReadiness = {
  sectionId: BinderSection;
  label: string;
  status: BinderSectionReadinessStatus;
  requiredForPurpose: boolean;
  selectedByDefault: boolean;
  postMeeting: boolean;
  action?: BinderSectionReadinessAction;
  explanation?: string;
};

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function planningOutputsHref(clientId: string, focus: string): string {
  return `/advisor/clients/${clientId}/planning-outputs?focus=${encodeURIComponent(focus)}&returnTab=meeting-packs`;
}

function workspaceTabHref(clientId: string, tab: string): string {
  return `/advisor/clients/${clientId}?tab=${encodeURIComponent(tab)}&returnTab=meeting-packs`;
}

function meetingStudioHref(clientId: string): string {
  return workspaceTabHref(clientId, "overview");
}

type MutablePublicationState = {
  status: BinderSectionReadinessStatus;
  actionType?: BinderSectionReadinessAction["type"];
  actionLabel?: string;
  href?: string;
  explanation?: string;
};

function resolvePublicationSectionState(
  sectionId: BinderSection,
  clientId: string,
  allPublications: PublishedOutputRow[],
): MutablePublicationState {
  const allowedTypes = SECTION_OUTPUT_TYPES[sectionId] ?? [];
  const candidates = allPublications.filter((row) => allowedTypes.includes(row.output_type));
  const { available, reasonCode } = classifyClientPublicationAvailability(
    allPublications,
    allowedTypes,
  );

  if (available) {
    return { status: "available" };
  }

  const reviewed = candidates.find((row) => row.publication_status === "adviser_reviewed");
  if (reviewed) {
    return {
      status: "not_published",
      actionType: "publish",
      actionLabel: "Review and publish",
      href: planningOutputsHref(clientId, sectionId),
    };
  }

  const draft = candidates.find((row) => row.publication_status === "draft");
  if (draft) {
    return {
      status: "draft_available",
      actionType: "review",
      actionLabel: "Review and publish",
      href: planningOutputsHref(clientId, sectionId),
    };
  }

  if (reasonCode === "SOURCE_NOT_CLIENT_VISIBLE") {
    return {
      status: "not_client_visible",
      actionType: "open_source",
      actionLabel: "Open source screen",
      href: resolveOpenSourceHref(sectionId, clientId),
      explanation: "A draft exists but is not published for client access.",
    };
  }

  if (reasonCode === "SOURCE_NOT_CURRENT" && candidates.length > 0) {
    return {
      status: "not_current",
      actionType: "create",
      actionLabel: resolveCreateLabel(sectionId),
      href: planningOutputsHref(clientId, sectionId),
      explanation: "The previous version is no longer current. Create a new draft.",
    };
  }

  return {
    status: "not_created",
    actionType: "create",
    actionLabel: resolveCreateLabel(sectionId),
    href: resolveCreateHref(sectionId, clientId),
  };
}

function resolveCreateLabel(sectionId: BinderSection): string {
  switch (sectionId) {
    case "financial_overview":
      return "Create financial overview";
    case "my_plan":
      return "Create planning position";
    case "agreed_priorities":
      return "Create agreed priorities";
    case "roadmap":
      return "Create wealth roadmap";
    case "meeting_summary":
      return "Create after meeting";
    default:
      return "Create content";
  }
}

function resolveCreateHref(sectionId: BinderSection, clientId: string): string {
  if (sectionId === "meeting_summary") {
    return meetingStudioHref(clientId);
  }
  return planningOutputsHref(clientId, sectionId);
}

function resolveOpenSourceHref(sectionId: BinderSection, clientId: string): string {
  switch (sectionId) {
    case "financial_overview":
      return workspaceTabHref(clientId, "dashboard");
    case "my_plan":
    case "agreed_priorities":
      return planningOutputsHref(clientId, sectionId);
    case "roadmap":
      return workspaceTabHref(clientId, "overview");
    case "meeting_summary":
      return meetingStudioHref(clientId);
    default:
      return planningOutputsHref(clientId, sectionId);
  }
}

function resolveMetadataSectionState(
  sectionId: BinderSection,
  input: { meetingDate: string | null; hasNextReviewDate: boolean },
): MutablePublicationState {
  if (sectionId === "cover_page" || sectionId === "client_adviser_info" || sectionId === "document_index") {
    return { status: "available" };
  }

  if (sectionId === "meeting_date") {
    if (input.meetingDate?.trim()) {
      return { status: "available" };
    }
    return {
      status: "not_created",
      explanation: "Choose a meeting date above.",
    };
  }

  if (sectionId === "next_review_date") {
    if (input.hasNextReviewDate) {
      return { status: "available" };
    }
    return {
      status: "not_created",
      explanation: "Optional — set a next review date on the client record.",
    };
  }

  return { status: "not_created" };
}

export function buildBinderSectionReadiness(input: {
  sectionId: BinderSection;
  clientId: string;
  purpose: BinderPackPurpose;
  allPublications: PublishedOutputRow[];
  meetingDate: string | null;
  hasNextReviewDate: boolean;
}): BinderSectionReadiness {
  const label = BINDER_SECTION_ADVISER_LABELS[input.sectionId] ?? input.sectionId;
  const postMeeting = isPostMeetingSection(input.sectionId);
  const requiredForPurpose = isRequiredForPurpose(input.sectionId, input.purpose);
  const selectedByDefault = isSelectedByDefault(input.sectionId, input.purpose);

  let state: MutablePublicationState;
  if (
    input.sectionId === "cover_page" ||
    input.sectionId === "client_adviser_info" ||
    input.sectionId === "meeting_date" ||
    input.sectionId === "document_index" ||
    input.sectionId === "next_review_date"
  ) {
    state = resolveMetadataSectionState(input.sectionId, {
      meetingDate: input.meetingDate,
      hasNextReviewDate: input.hasNextReviewDate,
    });
  } else {
    state = resolvePublicationSectionState(
      input.sectionId,
      input.clientId,
      input.allPublications,
    );
  }

  if (postMeeting && input.purpose === "meeting_preparation") {
    if (state.status === "not_created") {
      state = {
        status: "not_created",
        actionType: "create",
        actionLabel: "Create after meeting",
        href: meetingStudioHref(input.clientId),
        explanation: "Not required for a preparation pack.",
      };
    } else if (state.status === "available") {
      state.explanation = "Published — can be included if helpful.";
    } else {
      state.explanation = "Not required for a preparation pack.";
    }
  }

  const readiness: BinderSectionReadiness = {
    sectionId: input.sectionId,
    label,
    status: state.status,
    requiredForPurpose,
    selectedByDefault,
    postMeeting,
    ...(state.explanation ? { explanation: state.explanation } : {}),
  };

  if (state.actionType && state.actionLabel && state.href) {
    readiness.action = {
      type: state.actionType,
      label: state.actionLabel,
      href: state.href,
    };
  }

  return readiness;
}

export function canGenerateWithSelectedSections(input: {
  meetingDate: string | null;
  sections: BinderSectionReadiness[];
  selectedSectionIds: string[];
}): boolean {
  const selected = new Set(input.selectedSectionIds);
  if (!input.meetingDate?.trim()) return false;

  const selectedRows = input.sections.filter((entry) => selected.has(entry.sectionId));
  if (selectedRows.length === 0) return false;

  const allSelectedAvailable = selectedRows.every((entry) => entry.status === "available");
  if (!allSelectedAvailable) return false;

  const hasPlanning = selectedRows.some(
    (entry) =>
      (entry.sectionId === "financial_overview" ||
        entry.sectionId === "my_plan" ||
        entry.sectionId === "agreed_priorities" ||
        entry.sectionId === "roadmap" ||
        entry.sectionId === "meeting_summary") &&
      entry.status === "available",
  );

  return hasPlanning;
}

/** QA helper — readiness payloads must never leak internal identifiers. */
export function assertReadinessResponseSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  if (UUID_PATTERN.test(serialized)) {
    throw new Error("Readiness response must not include database IDs");
  }
  for (const forbidden of [
    "storage_path",
    "storagePath",
    "safe_payload",
    "payload",
    "internalNotes",
    "signedUrl",
  ]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Readiness response must not include ${forbidden}`);
    }
  }
}
