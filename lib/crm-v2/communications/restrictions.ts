/** Prohibited communication uses — no automated outreach or ranking. */

export const COMMUNICATION_PROHIBITED_USES = [
  "automated_outreach",
  "campaign_automation",
  "advocacy_score_priority",
  "ethnicity_targeting",
  "wealth_segmentation",
  "protection_gap_trigger",
  "sales_opportunity_ranking",
  "product_recommendation",
] as const;

export function communicationMustNotUseAdvocacyScore(): void {
  // Static guard — enforced in work queue and UI; no score field in communication schema.
}

export function communicationMustNotAutoSend(): boolean {
  return true;
}

export function isCampaignStyleBlocked(marketingOptOut: boolean, doNotContact: boolean): boolean {
  return marketingOptOut || doNotContact;
}

export function buildPreferenceWarnings(input: {
  doNotContact: boolean;
  marketingOptOut: boolean;
  festiveAcknowledgementOptOut: boolean;
  adviserMessagesEnabled: boolean;
}): string[] {
  const warnings: string[] = [];
  if (input.doNotContact) warnings.push("do_not_contact");
  if (input.marketingOptOut) warnings.push("marketing_opt_out");
  if (input.festiveAcknowledgementOptOut) warnings.push("festive_acknowledgement_opt_out");
  if (!input.adviserMessagesEnabled) warnings.push("adviser_messages_disabled");
  return warnings;
}
