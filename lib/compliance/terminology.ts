/**
 * Central client-safe terminology for compliance-oriented UI language.
 * Phase 9B–9F should import from here rather than hard-coding labels.
 */

export const CLIENT_TERMINOLOGY = {
  financialReadinessSnapshot: "Financial Readiness Snapshot",
  financialOverview: "Financial Overview",
  planningCategory: "Planning category",
  broadStrength: "Broad strength",
  areaForAdviserReview: "Area for adviser review",
  adviserReviewedSummary: "Adviser-reviewed summary",
  educationalIllustration: "Educational illustration",
  basedOnInformationProvided: "Based on information provided",
  dataAsAt: (date: string) => `Data as at ${date}`,
  adviserReviewInProgress: "Adviser review in progress",
  noPublishedSummary: "No current published summary",
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
  "AAA financial rating",
] as const;

export const TERMINOLOGY_POLICY = {
  preferred: CLIENT_TERMINOLOGY,
  prohibited: PROHIBITED_CLIENT_WORDING,
  guidance:
    "Client-facing surfaces must use educational and administrative language. " +
    "Personalised conclusions require adviser review and publication before client visibility.",
} as const;
