/** Prohibited report card fields and signals — projection-only, no ranking or sales logic. */
export const REPORT_PROHIBITED_CARD_FIELDS = [
  "rawSourceRecord",
  "nric",
  "policyNumber",
  "policyNumbers",
  "storagePath",
  "signedUrl",
  "premium",
  "revenue",
  "commission",
  "wealth",
  "advocacyScore",
  "ethnicity",
  "leadScore",
  "salesPriority",
  "productOpportunity",
  "providerError",
  "rawProviderResponse",
  "messageBody",
  "privateNotes",
] as const;

export const REPORT_PROHIBITED_ORDERING_SIGNALS = [
  "advocacy_score",
  "ethnicity",
  "wealth",
  "premium",
  "revenue",
  "lead_quality",
  "sales_priority",
  "product_opportunity",
] as const;
