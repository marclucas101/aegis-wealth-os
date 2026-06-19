/**
 * Central client-safe terminology for compliance-oriented UI language.
 * Phase 9B–9F should import from here rather than hard-coding labels.
 */

export const CLIENT_TERMINOLOGY = {
  financialReadinessSnapshot: "Financial Readiness Snapshot",
  financialOverview: "Financial Overview",
  myPlan: "My Plan",
  goalsAndReviews: "Goals & Reviews",
  insightsAndUpdates: "Insights & Updates",
  planningCategory: "Planning category",
  broadStrength: "Broad strength",
  areaForDiscussion: "Area for discussion",
  areaForAdviserReview: "Area for adviser review",
  agreedPriority: "Agreed priority",
  adviserReviewedSummary: "Adviser-reviewed summary",
  educationalIllustration: "Educational illustration",
  basedOnInformationProvided: "Based on information provided",
  dataAsAt: (date: string) => `Data as at ${date}`,
  adviserReviewInProgress: "Adviser review in progress",
  adviserPreparingUpdate: "Your adviser is preparing an update",
  noPublishedSummary: "No current published summary",
  reviewRecommended: "Review recommended",
  budgetSurplusGuidance:
    "Based on the information entered, you may have approximately {amount} available for your financial priorities. Discuss how this may be allocated with your adviser.",
} as const;

/** Wording that must not appear in default client-facing copy. */
export const PROHIBITED_CLIENT_WORDING = [
  "Recommended product",
  "You should buy",
  "Required insurance",
  "Guaranteed",
  "Approved investment",
  "Best product",
  "Exact amount you need",
  "Suitable for you",
  "Suitable investment",
  "AAA financial rating",
  "You must buy",
  "Guaranteed result",
  "Automated recommendation",
] as const;

export const TERMINOLOGY_POLICY = {
  preferred: CLIENT_TERMINOLOGY,
  prohibited: PROHIBITED_CLIENT_WORDING,
  guidance:
    "Client-facing surfaces must use educational and administrative language. " +
    "Personalised conclusions require adviser review and publication before client visibility.",
} as const;
