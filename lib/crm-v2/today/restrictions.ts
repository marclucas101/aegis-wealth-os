/** Prohibited ordering signals and card payload fields for Today (Phase 11). */

export const TODAY_PROHIBITED_ORDERING_SIGNALS = [
  "advocacy_score",
  "client_wealth",
  "premium",
  "revenue",
  "commission",
  "sum_assured",
  "protection_gap_value",
  "ethnicity",
  "product_opportunity",
  "lead_quality",
  "sales_potential",
  "hidden_segmentation",
] as const;

export const TODAY_PROHIBITED_CARD_FIELDS = [
  "policyNumber",
  "policy_number",
  "nric",
  "storagePath",
  "storage_path",
  "signedUrl",
  "signed_url",
  "financialValue",
  "premium",
  "revenue",
  "clientWealth",
  "advocacyScore",
  "ethnicity",
  "privateNotes",
  "rawSourceRecord",
  "providerError",
  "communicationBody",
  "workQueuePriorityInternals",
] as const;

export function todayProjectionMustNotPersistCards(): true {
  return true;
}

export function todayProjectionMustNotCreateWorkItemAuthority(): true {
  return true;
}
