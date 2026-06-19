import "server-only";

import { CLIENT_TERMINOLOGY } from "./terminology";
import type { ClientSafeFallbackReason, RelationshipStage } from "./types";

export type ClientSafeFallbackState = {
  reason: ClientSafeFallbackReason;
  message: string;
  suggestedAction: string | null;
  appointmentCta: { label: string; href: string } | null;
};

export function resolveFallbackState(input: {
  stage: RelationshipStage;
  hasDiscoverData: boolean;
  hasAssignedAdviser: boolean;
  hasPublishedSummary: boolean;
  featureDisabled?: boolean;
}): ClientSafeFallbackState {
  if (input.featureDisabled) {
    return {
      reason: "feature_disabled",
      message: "This feature is temporarily unavailable.",
      suggestedAction: "Contact your adviser for assistance.",
      appointmentCta: input.hasAssignedAdviser
        ? { label: "Contact my adviser", href: "/my-adviser" }
        : null,
    };
  }

  if (!input.hasDiscoverData) {
    return {
      reason: "additional_information_required",
      message: "Please complete your information so your adviser can prepare a review.",
      suggestedAction: "Continue your financial profile in Discover.",
      appointmentCta: null,
    };
  }

  if (input.hasPublishedSummary) {
    return {
      reason: "no_current_published_summary",
      message: CLIENT_TERMINOLOGY.noPublishedSummary,
      suggestedAction: null,
      appointmentCta: null,
    };
  }

  if (
    input.stage === "prospect" ||
    input.stage === "fact_find_complete"
  ) {
    return {
      reason: "analysis_submitted",
      message: "Your information has been submitted for adviser review.",
      suggestedAction: input.hasAssignedAdviser
        ? "Your adviser will contact you to schedule a review."
        : "An adviser will be assigned to review your information.",
      appointmentCta: input.hasAssignedAdviser
        ? { label: "Book an appointment", href: "/my-adviser" }
        : null,
    };
  }

  if (
    input.stage === "adviser_review" ||
    input.stage === "meeting_scheduled" ||
    input.stage === "recommendation_prepared"
  ) {
    return {
      reason: "adviser_review_in_progress",
      message: CLIENT_TERMINOLOGY.adviserReviewInProgress,
      suggestedAction: "Your adviser is preparing your reviewed summary.",
      appointmentCta: input.hasAssignedAdviser
        ? { label: "View appointments", href: "/my-adviser" }
        : null,
    };
  }

  if (input.stage === "active_client") {
    return {
      reason: "no_current_published_summary",
      message: CLIENT_TERMINOLOGY.noPublishedSummary,
      suggestedAction: "Your adviser will publish an updated summary after your next review.",
      appointmentCta: input.hasAssignedAdviser
        ? { label: "Contact my adviser", href: "/my-adviser" }
        : null,
    };
  }

  return {
    reason: "review_appointment_recommended",
    message: "A review appointment is recommended to update your planning summary.",
    suggestedAction: null,
    appointmentCta: input.hasAssignedAdviser
      ? { label: "Book an appointment", href: "/my-adviser" }
      : null,
  };
}
