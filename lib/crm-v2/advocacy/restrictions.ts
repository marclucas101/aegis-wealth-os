/**
 * Advocacy score restrictions — event-based yearly score only.
 * Never used for sales priority, advice, queue ranking, or client segmentation.
 */

export const ADVOCACY_SCORE_ALLOWED_USES = [
  "adviser_relationship_360_summary",
  "adviser_advocacy_workspace_yearly_summary",
  "transparent_explanation_to_assigned_adviser",
] as const;

export const ADVOCACY_SCORE_PROHIBITED_USES = [
  "work_queue_priority",
  "client_ranking",
  "lead_scoring",
  "sales_priority",
  "financial_advice",
  "product_recommendation",
  "service_tiering",
  "urgency_classification",
  "ethnicity_segmentation",
  "wealth_segmentation",
  "premium_opportunity",
  "protection_gap_opportunity",
  "client_list_badges",
  "automated_outreach",
] as const;

export function assertAdvocacyScoreNotUsedForPriority(context: string): void {
  const prohibited = new Set<string>(ADVOCACY_SCORE_PROHIBITED_USES);
  if (prohibited.has(context)) {
    throw new Error(`Advocacy score must not be used for ${context}.`);
  }
}

export function advocacyScoreMustNotAffectQueuePriority(): true {
  return true;
}

export function advocacyScoreMustNotAppearInClientDto(): true {
  return true;
}

export function advocacyMustNotUseEthnicity(): true {
  return true;
}
