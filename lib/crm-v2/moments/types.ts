/** CRM V2 relationship moments — allowlisted types and DTOs (Phase 08). */

export const CRM_MOMENT_TYPES = [
  "birthday",
  "wedding_anniversary",
  "child_birthday",
  "policy_anniversary",
  "review_anniversary",
  "festive_greeting",
  "client_preference",
  "life_event_follow_up",
  "custom_adviser_reminder",
] as const;

export type CrmMomentType = (typeof CRM_MOMENT_TYPES)[number];

export const CRM_MOMENT_VISIBILITY = ["adviser_only", "client_visible", "both"] as const;
export type CrmMomentVisibility = (typeof CRM_MOMENT_VISIBILITY)[number];

export const CRM_MOMENT_CONFIRMATION_STATES = [
  "confirmed",
  "suggested",
  "rejected",
  "pending_client",
] as const;
export type CrmMomentConfirmationState = (typeof CRM_MOMENT_CONFIRMATION_STATES)[number];

export const CRM_MOMENT_SENSITIVITY_CLASSES = [
  "standard",
  "cultural_preference",
  "life_event",
] as const;
export type CrmMomentSensitivityClass = (typeof CRM_MOMENT_SENSITIVITY_CLASSES)[number];

export const CRM_REVIEW_TYPES = [
  "annual_review",
  "semi_annual_review",
  "quarterly_review",
  "ad_hoc_review",
  "protection_review",
  "service_review",
  "planning_review",
] as const;
export type CrmReviewType = (typeof CRM_REVIEW_TYPES)[number];

export const CRM_REVIEW_CADENCES = ["annual", "semi_annual", "quarterly", "ad_hoc"] as const;
export type CrmReviewCadence = (typeof CRM_REVIEW_CADENCES)[number];

export const CRM_REVIEW_STATUSES = ["scheduled", "overdue", "completed", "paused"] as const;
export type CrmReviewStatus = (typeof CRM_REVIEW_STATUSES)[number];

export const CRM_CLIENT_ETHNICITY_VALUES = [
  "chinese",
  "malay",
  "indian",
  "eurasian",
  "mixed",
  "other",
  "prefer_not_to_say",
] as const;
export type CrmClientEthnicity = (typeof CRM_CLIENT_ETHNICITY_VALUES)[number];

export const CRM_PREFERENCE_TYPES = [
  "important_date",
  "birthday_acknowledgement_opt_out",
  "festive_acknowledgement_opt_out",
  "greeting_preference",
  "communication_preference",
  "ethnicity_correction",
  "review_request",
] as const;
export type CrmPreferenceType = (typeof CRM_PREFERENCE_TYPES)[number];

export type CrmMomentsWorkspaceView =
  | "upcoming"
  | "important_dates"
  | "review_rhythm"
  | "client_preferences"
  | "festive_suggestions"
  | "past_acknowledgements"
  | "data_quality";

export type AdviserMomentLabel =
  | "confirmed"
  | "unconfirmed"
  | "suggested"
  | "client_visible"
  | "adviser_only"
  | "sensitive_use_restricted";

export type AdviserRelationshipMomentDto = {
  momentId: string;
  clientId: string;
  momentType: CrmMomentType;
  title: string;
  momentDate: string | null;
  nextOccurrenceDate: string | null;
  timezone: string;
  visibility: CrmMomentVisibility;
  confirmationState: CrmMomentConfirmationState;
  sensitivityClass: CrmMomentSensitivityClass;
  reminderPreference: string;
  lastAcknowledgedAt: string | null;
  active: boolean;
  labels: AdviserMomentLabel[];
  holidayKey: string | null;
  linkedAppointmentId: string | null;
  linkedCommitmentId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AdviserFestiveSuggestionDto = {
  holidayKey: string;
  displayName: string;
  suggestedDate: string | null;
  confirmationState: "suggested";
  overrideAction: "include" | "exclude" | null;
  labels: AdviserMomentLabel[];
};

export type AdviserReviewRhythmDto = {
  reviewRhythmId: string;
  clientId: string;
  reviewType: CrmReviewType;
  cadence: CrmReviewCadence;
  nextDueDate: string | null;
  lastCompletedDate: string | null;
  status: CrmReviewStatus;
  clientVisibility: boolean;
  linkedAppointmentId: string | null;
  version: number;
  updatedAt: string;
};

export type AdviserMomentsWorkspaceDto = {
  relationshipId: string;
  upcomingMoments: AdviserRelationshipMomentDto[];
  importantDates: AdviserRelationshipMomentDto[];
  reviewRhythm: AdviserReviewRhythmDto[];
  clientPreferences: ClientSafePreferenceDto[];
  festiveSuggestions: AdviserFestiveSuggestionDto[];
  pastAcknowledgements: AdviserRelationshipMomentDto[];
  dataQualityWarnings: string[];
  bounded: boolean;
};

export type ClientSafePreferenceDto = {
  preferenceType: string;
  label: string;
  value: string;
  clientEditable: boolean;
};

export type ClientRelationshipPreferencesDto = {
  importantDates: Array<{ label: string; date: string; confirmed: boolean }>;
  birthdayAcknowledgementOptOut: boolean;
  festiveAcknowledgementOptOut: boolean;
  greetingPreference: string | null;
  ethnicity: CrmClientEthnicity | null;
  pendingUpdates: number;
};

export type CreateMomentInput = {
  momentType: CrmMomentType;
  title: string;
  momentDate?: string | null;
  recurrenceRule?: string | null;
  timezone?: string;
  visibility?: CrmMomentVisibility;
  reminderPreference?: string;
  holidayKey?: string | null;
  idempotencyKey?: string | null;
};

export type UpdateMomentInput = {
  title?: string;
  momentDate?: string | null;
  visibility?: CrmMomentVisibility;
  reminderPreference?: string;
  expectedVersion: number;
};

export type UpdateReviewRhythmInput = {
  cadence?: CrmReviewCadence;
  nextDueDate?: string | null;
  lastCompletedDate?: string | null;
  status?: CrmReviewStatus;
  clientVisibility?: boolean;
  expectedVersion: number;
};

export type ClientPreferenceUpdateInput = {
  preferenceType: CrmPreferenceType;
  proposedValue: Record<string, unknown>;
  idempotencyKey?: string | null;
};

export function momentTypeLabel(type: CrmMomentType): string {
  return type.replace(/_/g, " ");
}

export function reviewTypeLabel(type: CrmReviewType): string {
  return type.replace(/_/g, " ");
}

export function isValidMomentType(value: string): value is CrmMomentType {
  return (CRM_MOMENT_TYPES as readonly string[]).includes(value);
}

export function isValidReviewType(value: string): value is CrmReviewType {
  return (CRM_REVIEW_TYPES as readonly string[]).includes(value);
}

export function isValidEthnicity(value: string): value is CrmClientEthnicity {
  return (CRM_CLIENT_ETHNICITY_VALUES as readonly string[]).includes(value);
}
