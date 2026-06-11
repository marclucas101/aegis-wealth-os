export const FEEDBACK_STATUSES = [
  "submitted",
  "reviewed",
  "approved_testimonial",
  "archived",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const TESTIMONIAL_DISPLAY_PREFERENCES = [
  "anonymous",
  "first_name",
  "full_name",
] as const;

export type TestimonialDisplayPreference =
  (typeof TESTIMONIAL_DISPLAY_PREFERENCES)[number];

export const FEEDBACK_DISMISS_COOLDOWN_DAYS = 14;

export type AdviserFeedbackRecord = {
  id: string;
  clientUserId: string;
  clientId: string | null;
  adviserUserId: string | null;
  adviserName: string | null;
  clientDisplayName: string | null;
  ratingOverall: number;
  ratingClarity: number | null;
  ratingResponsiveness: number | null;
  ratingTrust: number | null;
  ratingProfessionalism: number | null;
  feedbackText: string | null;
  whatWentWell: string | null;
  whatCouldImprove: string | null;
  permissionToUseAsTestimonial: boolean;
  testimonialDisplayName: string | null;
  testimonialAnonymous: boolean;
  status: FeedbackStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackPromptState = {
  shouldPrompt: boolean;
  adviserName: string | null;
  adviserCompany: string | null;
  alreadySubmitted: boolean;
};

export type AdviserFeedbackSummary = {
  adviserUserId: string;
  adviserName: string | null;
  feedbackCount: number;
  averageOverallRating: number | null;
};

export type AdviserFeedbackInput = {
  ratingOverall: number;
  ratingClarity?: number | null;
  ratingResponsiveness?: number | null;
  ratingTrust?: number | null;
  ratingProfessionalism?: number | null;
  feedbackText?: string | null;
  whatWentWell?: string | null;
  whatCouldImprove?: string | null;
  permissionToUseAsTestimonial?: boolean;
  testimonialDisplayPreference?: TestimonialDisplayPreference;
};
