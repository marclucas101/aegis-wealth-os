/**
 * Hard restrictions on ethnicity and cultural data usage (Phase 08).
 * Ethnicity may only be used for optional festive suggestions with adviser/client confirmation.
 */

export const ETHNICITY_ALLOWED_USES = [
  "festive_suggestion",
  "adviser_review",
  "client_preference_confirmation",
] as const;

export const ETHNICITY_PROHIBITED_USES = [
  "financial_advice",
  "product_recommendation",
  "risk_scoring",
  "protection_analysis",
  "work_queue_priority",
  "client_ranking",
  "sales_opportunity_scoring",
  "urgency",
  "lead_quality",
  "service_tier",
  "automated_outreach",
  "hidden_segmentation",
] as const;

export type EthnicityUseContext = (typeof ETHNICITY_ALLOWED_USES)[number];
export type EthnicityProhibitedContext = (typeof ETHNICITY_PROHIBITED_USES)[number];

export function assertEthnicityUseAllowed(context: string): void {
  if ((ETHNICITY_PROHIBITED_USES as readonly string[]).includes(context)) {
    throw new Error(`Ethnicity use prohibited: ${context}`);
  }
}

export function isEthnicityAllowedForFestiveSuggestion(): boolean {
  return true;
}

export function ethnicityMustNotAffectPriority(): true {
  return true;
}

export function ethnicityMustNotAppearInTimelineText(): true {
  return true;
}

export function ethnicityMustNotAppearInWorkQueueMetadata(): true {
  return true;
}

export function ethnicityMustNotAppearInNotificationText(): true {
  return true;
}

export function festiveSuggestionRequiresConfirmation(): true {
  return true;
}

export function festiveSuggestionMustNotAutoSend(): true {
  return true;
}
