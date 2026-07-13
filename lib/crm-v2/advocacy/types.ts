/** CRM V2 advocacy — allowlisted types and DTOs (Phase 09). */

export const CRM_ADVOCACY_EVENT_TYPES = [
  "introduction_offered",
  "introduction_made",
  "referral_received",
  "referral_contacted",
  "referral_declined",
  "testimonial_offered",
  "testimonial_consented",
  "testimonial_withdrawn",
  "review_requested",
  "review_completed",
  "client_feedback_received",
  "permission_to_mention_granted",
  "permission_withdrawn",
  "thank_you_sent",
  "do_not_ask_recorded",
] as const;

export type CrmAdvocacyEventType = (typeof CRM_ADVOCACY_EVENT_TYPES)[number];

export const CRM_ADVOCACY_CONSENT_STATES = [
  "not_required",
  "pending",
  "granted",
  "limited",
  "withdrawn",
  "declined",
  "unknown",
] as const;

export type CrmAdvocacyConsentState = (typeof CRM_ADVOCACY_CONSENT_STATES)[number];

export const CRM_ADVOCACY_VISIBILITY = ["adviser_only", "client_visible", "both"] as const;
export type CrmAdvocacyVisibility = (typeof CRM_ADVOCACY_VISIBILITY)[number];

export const CRM_ADVOCACY_FOLLOW_UP_STATUSES = [
  "none",
  "pending",
  "completed",
  "declined",
  "overdue",
] as const;

export type CrmAdvocacyFollowUpStatus = (typeof CRM_ADVOCACY_FOLLOW_UP_STATUSES)[number];

export const CRM_ADVOCACY_SOURCE_TYPES = [
  "manual",
  "adviser_feedback",
  "service_request",
  "appointment",
  "relationship_moment",
  "client_preference",
] as const;

export type CrmAdvocacySourceType = (typeof CRM_ADVOCACY_SOURCE_TYPES)[number];

export type CrmAdvocacyWorkspaceView =
  | "history"
  | "introductions"
  | "referrals"
  | "testimonials"
  | "follow_up"
  | "consent"
  | "summary";

export type AdviserAdvocacyLabel =
  | "consent_granted"
  | "consent_pending"
  | "consent_withdrawn"
  | "consent_declined"
  | "client_visible"
  | "adviser_only"
  | "restricted"
  | "do_not_ask"
  | "follow_up_due";

export type AdviserAdvocacyEventDto = {
  eventId: string;
  clientId: string;
  eventType: CrmAdvocacyEventType;
  eventDate: string;
  safeTitle: string;
  consentState: CrmAdvocacyConsentState;
  visibility: CrmAdvocacyVisibility;
  followUpStatus: CrmAdvocacyFollowUpStatus;
  nextFollowUpDate: string | null;
  referredPersonLabel: string | null;
  hasContactDetails: boolean;
  labels: AdviserAdvocacyLabel[];
  linkedAppointmentId: string | null;
  linkedServiceRequestId: string | null;
  linkedRelationshipMomentId: string | null;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AdviserAdvocacySummaryDto = {
  relationshipId: string;
  calendarYear: number;
  eventCount: number;
  yearlyScore: number | null;
  scoreExplanation: string | null;
  consentStatus: CrmAdvocacyConsentState;
  doNotAsk: boolean;
  referralAskOptOut: boolean;
  permissionToMention: boolean;
  followUpDueCount: number;
};

export type AdviserAdvocacyWorkspaceDto = {
  relationshipId: string;
  summary: AdviserAdvocacySummaryDto;
  history: AdviserAdvocacyEventDto[];
  introductions: AdviserAdvocacyEventDto[];
  referrals: AdviserAdvocacyEventDto[];
  testimonials: AdviserAdvocacyEventDto[];
  followUpNeeded: AdviserAdvocacyEventDto[];
  bounded: boolean;
};

export type ClientAdvocacyPreferencesDto = {
  testimonialConsent: CrmAdvocacyConsentState;
  referralAskOptOut: boolean;
  permissionToMention: boolean;
  doNotAsk: boolean;
  safeAcknowledgementHistory: Array<{
    eventType: string;
    occurredAt: string;
    safeTitle: string;
  }>;
  version: number;
};

export type CreateAdvocacyEventInput = {
  eventType: CrmAdvocacyEventType;
  eventDate?: string;
  safeTitle: string;
  notes?: string;
  consentState?: CrmAdvocacyConsentState;
  visibility?: CrmAdvocacyVisibility;
  referredPersonLabel?: string;
  hasContactDetails?: boolean;
  followUpStatus?: CrmAdvocacyFollowUpStatus;
  nextFollowUpDate?: string | null;
  linkedAppointmentId?: string | null;
  linkedServiceRequestId?: string | null;
  linkedRelationshipMomentId?: string | null;
  sourceType?: CrmAdvocacySourceType;
  sourceId?: string | null;
  idempotencyKey?: string;
};

export type UpdateAdvocacyEventInput = {
  expectedVersion: number;
  safeTitle?: string;
  notes?: string | null;
  consentState?: CrmAdvocacyConsentState;
  visibility?: CrmAdvocacyVisibility;
  followUpStatus?: CrmAdvocacyFollowUpStatus;
  nextFollowUpDate?: string | null;
  referredPersonLabel?: string | null;
};

export type TransitionAdvocacyEventInput = {
  expectedVersion: number;
  transition: "deactivate" | "consent_granted" | "consent_withdrawn" | "thank_you_sent";
  idempotencyKey?: string;
};

export type UpdateClientAdvocacyPreferencesInput = {
  expectedVersion: number;
  testimonialConsent?: CrmAdvocacyConsentState;
  referralAskOptOut?: boolean;
  permissionToMention?: boolean;
  doNotAsk?: boolean;
  idempotencyKey?: string;
};

const EVENT_TYPE_LABELS: Record<CrmAdvocacyEventType, string> = {
  introduction_offered: "Introduction offered",
  introduction_made: "Introduction made",
  referral_received: "Referral received",
  referral_contacted: "Referral contacted",
  referral_declined: "Referral declined",
  testimonial_offered: "Testimonial offered",
  testimonial_consented: "Testimonial consent granted",
  testimonial_withdrawn: "Testimonial consent withdrawn",
  review_requested: "Review requested",
  review_completed: "Review completed",
  client_feedback_received: "Client feedback received",
  permission_to_mention_granted: "Permission to mention granted",
  permission_withdrawn: "Permission withdrawn",
  thank_you_sent: "Thank-you recorded",
  do_not_ask_recorded: "Do-not-ask preference recorded",
};

export function isValidAdvocacyEventType(value: string): value is CrmAdvocacyEventType {
  return (CRM_ADVOCACY_EVENT_TYPES as readonly string[]).includes(value);
}

export function isValidAdvocacyConsentState(value: string): value is CrmAdvocacyConsentState {
  return (CRM_ADVOCACY_CONSENT_STATES as readonly string[]).includes(value);
}

export function advocacyEventTypeLabel(eventType: CrmAdvocacyEventType): string {
  return EVENT_TYPE_LABELS[eventType] ?? "Advocacy event";
}

export function isIntroductionEventType(eventType: CrmAdvocacyEventType): boolean {
  return eventType === "introduction_offered" || eventType === "introduction_made";
}

export function isReferralEventType(eventType: CrmAdvocacyEventType): boolean {
  return (
    eventType === "referral_received" ||
    eventType === "referral_contacted" ||
    eventType === "referral_declined"
  );
}

export function isTestimonialEventType(eventType: CrmAdvocacyEventType): boolean {
  return (
    eventType === "testimonial_offered" ||
    eventType === "testimonial_consented" ||
    eventType === "testimonial_withdrawn"
  );
}

export function requiresExplicitConsent(eventType: CrmAdvocacyEventType): boolean {
  return (
    eventType === "testimonial_offered" ||
    eventType === "testimonial_consented" ||
    eventType === "permission_to_mention_granted"
  );
}
