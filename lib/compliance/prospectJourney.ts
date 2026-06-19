import type { RelationshipStage } from "./types";

export type ProspectJourneyStatus =
  | "getting_started"
  | "profile_in_progress"
  | "submitted_for_review"
  | "meeting_scheduled"
  | "adviser_review_completed";

export type ProspectPrimaryCta = {
  label: string;
  href: string;
  reason: string;
};

export type ProspectJourneyContext = {
  stage: RelationshipStage;
  hasDiscoverData: boolean;
  profileCompletenessPercent: number;
  hasAssignedAdviser: boolean;
  hasUpcomingAppointment: boolean;
  hasPublishedSnapshot: boolean;
  hasOpenDocumentRequests: boolean;
};

const STATUS_LABELS: Record<ProspectJourneyStatus, string> = {
  getting_started: "Getting started",
  profile_in_progress: "Profile in progress",
  submitted_for_review: "Submitted for adviser review",
  meeting_scheduled: "Meeting scheduled",
  adviser_review_completed: "Adviser review completed",
};

export function resolveProspectJourneyStatus(
  ctx: ProspectJourneyContext,
): ProspectJourneyStatus {
  if (ctx.hasPublishedSnapshot) {
    return "adviser_review_completed";
  }

  if (ctx.stage === "meeting_scheduled" || ctx.hasUpcomingAppointment) {
    return "meeting_scheduled";
  }

  if (
    ctx.stage === "fact_find_complete" ||
    ctx.stage === "adviser_review" ||
    ctx.stage === "recommendation_prepared"
  ) {
    return "submitted_for_review";
  }

  if (!ctx.hasDiscoverData || ctx.profileCompletenessPercent < 25) {
    return "getting_started";
  }

  return "profile_in_progress";
}

export function prospectStatusLabel(status: ProspectJourneyStatus): string {
  return STATUS_LABELS[status];
}

export function resolveProspectPrimaryCta(
  ctx: ProspectJourneyContext,
): ProspectPrimaryCta {
  const status = resolveProspectJourneyStatus(ctx);

  if (status === "adviser_review_completed") {
    return {
      label: "View your adviser-reviewed snapshot",
      href: "/dashboard",
      reason: "published_snapshot",
    };
  }

  if (status === "meeting_scheduled") {
    return {
      label: "Prepare for your meeting",
      href: "/meeting-preparation",
      reason: "meeting_scheduled",
    };
  }

  if (status === "submitted_for_review") {
    if (ctx.hasAssignedAdviser) {
      return {
        label: "Book your review",
        href: "/my-adviser",
        reason: "awaiting_appointment",
      };
    }
    return {
      label: "View submission status",
      href: "/dashboard",
      reason: "submitted_awaiting_adviser",
    };
  }

  if (ctx.profileCompletenessPercent >= 70 && ctx.hasDiscoverData) {
    return {
      label: "Review missing information",
      href: "/discover",
      reason: "near_complete",
    };
  }

  if (ctx.hasDiscoverData || ctx.profileCompletenessPercent >= 10) {
    return {
      label: "Continue your profile",
      href: "/discover",
      reason: "in_progress",
    };
  }

  return {
    label: "Start your financial profile",
    href: "/discover",
    reason: "not_started",
  };
}

export const MEETING_PREP_QUESTIONS = [
  "What financial outcomes matter most to you?",
  "Who depends on your income?",
  "Which financial concerns cause the most uncertainty?",
  "What major changes do you expect in the next few years?",
] as const;
