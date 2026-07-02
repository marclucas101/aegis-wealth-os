/** CRM V2 structured protection portfolio — public DTOs and enums (Phase 07). */

export const CRM_PROTECTION_COVERAGE_CATEGORIES = [
  "death",
  "total_permanent_disability",
  "critical_illness",
  "early_critical_illness",
  "hospitalisation",
  "personal_accident",
  "disability_income",
  "long_term_care",
  "waiver",
  "savings_endowment",
  "investment_linked",
  "other",
] as const;

export type CrmProtectionCoverageCategory =
  (typeof CRM_PROTECTION_COVERAGE_CATEGORIES)[number];

export const CRM_PROTECTION_POLICY_CATEGORIES = [
  "term_life",
  "whole_life",
  "endowment",
  "investment_linked",
  "health",
  "accident",
  "long_term_care",
  "disability_income",
  "other",
] as const;

export type CrmProtectionPolicyCategory =
  (typeof CRM_PROTECTION_POLICY_CATEGORIES)[number];

export const CRM_PROTECTION_POLICY_STATUSES = [
  "in_force",
  "lapsed",
  "surrendered",
  "matured",
  "pending",
  "unknown",
] as const;

export type CrmProtectionPolicyStatus =
  (typeof CRM_PROTECTION_POLICY_STATUSES)[number];

export const CRM_PROTECTION_PREMIUM_FREQUENCIES = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "single",
  "unknown",
] as const;

export type CrmProtectionPremiumFrequency =
  (typeof CRM_PROTECTION_PREMIUM_FREQUENCIES)[number];

export const CRM_PROTECTION_EXTRACTION_METHODS = [
  "protection_report",
  "document_vault",
  "manual",
] as const;

export type CrmProtectionExtractionMethod =
  (typeof CRM_PROTECTION_EXTRACTION_METHODS)[number];

export const CRM_PROTECTION_CORRECTION_CATEGORIES = [
  "coverage_amount",
  "premium",
  "policy_status",
  "owner_or_life_assured",
  "policy_dates",
  "missing_policy",
  "other",
] as const;

export type CrmProtectionCorrectionCategory =
  (typeof CRM_PROTECTION_CORRECTION_CATEGORIES)[number];

export type CrmProtectionCoverageComponentDto = {
  category: CrmProtectionCoverageCategory;
  categoryLabel: string;
  amount: number | null;
  currency: string;
  durationLabel: string | null;
  insurerWording: string | null;
  isRider: boolean;
};

export type CrmProtectionRiderDto = {
  riderLabel: string;
  category: CrmProtectionCoverageCategory | null;
  amount: number | null;
  currency: string;
};

export type AdviserProtectionPolicySummaryDto = {
  policyId: string;
  insurer: string;
  displayName: string;
  policyCategory: CrmProtectionPolicyCategory;
  policyCategoryLabel: string;
  policyOwner: string;
  lifeAssured: string;
  policyStatus: CrmProtectionPolicyStatus;
  policyStatusLabel: string;
  policyRefMasked: string | null;
  policyStartDate: string | null;
  maturityOrExpiryDate: string | null;
  currentVersionNumber: number | null;
  verificationState: string;
  verificationStateLabel: string;
  lastVerifiedAt: string | null;
  premium: number | null;
  premiumFrequency: CrmProtectionPremiumFrequency | null;
  sumAssured: number | null;
  sumAssuredCurrency: string;
  sourceDocumentAvailable: boolean;
  sourceDocumentStatusLabel: string;
  hasProvisionalExtraction: boolean;
  clientCorrectionPending: boolean;
  isStale: boolean;
  workflowHref: string;
};

export type AdviserProtectionPortfolioDto = {
  relationshipId: string;
  clientDisplayName: string;
  portfolioSummary: {
    confirmedPolicyCount: number;
    provisionalExtractionCount: number;
    awaitingVerificationCount: number;
    missingSourceDocumentCount: number;
    pendingCorrectionRequestCount: number;
    lastPortfolioVerifiedAt: string | null;
    upcomingExpiryCount: number;
  };
  policies: AdviserProtectionPolicySummaryDto[];
  awaitingVerification: AdviserProtectionExtractionSummaryDto[];
  missingDocuments: AdviserProtectionPolicySummaryDto[];
  bounded: boolean;
};

export type AdviserProtectionExtractionSummaryDto = {
  extractionId: string;
  extractionMethod: CrmProtectionExtractionMethod;
  extractionMethodLabel: string;
  reviewStatus: string;
  reviewStatusLabel: string;
  insurer: string | null;
  displayName: string | null;
  policyCategory: CrmProtectionPolicyCategory | null;
  confidenceWarnings: string[];
  sourceDocumentAvailable: boolean;
  duplicateCandidatePolicyIds: string[];
  createdAt: string;
  workflowHref: string;
};

export type AdviserProtectionExtractionDetailDto = {
  extractionId: string;
  relationshipId: string;
  reviewStatus: string;
  reviewStatusLabel: string;
  extractionMethod: CrmProtectionExtractionMethod;
  extractedFields: AdviserProtectionExtractedFieldsDto;
  confidenceWarnings: string[];
  duplicateCandidatePolicyIds: string[];
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  sourceDocumentAvailable: boolean;
  resultingPolicyId: string | null;
  resultingVersionId: string | null;
  version: number;
  createdAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
};

export type AdviserProtectionExtractedFieldsDto = {
  insurer: string;
  displayName: string;
  policyCategory: CrmProtectionPolicyCategory;
  policyOwner: string;
  lifeAssured: string;
  policyStatus: CrmProtectionPolicyStatus;
  policyRefMasked: string | null;
  policyStartDate: string | null;
  maturityOrExpiryDate: string | null;
  sumAssured: number | null;
  sumAssuredCurrency: string;
  premium: number | null;
  premiumFrequency: CrmProtectionPremiumFrequency | null;
  policyTerm: string | null;
  premiumTerm: string | null;
  coverageComponents: CrmProtectionCoverageComponentDto[];
  riders: CrmProtectionRiderDto[];
};

export type AdviserProtectionPolicyDetailDto = {
  policyId: string;
  relationshipId: string;
  insurer: string;
  displayName: string;
  policyCategory: CrmProtectionPolicyCategory;
  policyCategoryLabel: string;
  policyOwner: string;
  lifeAssured: string;
  policyStatus: CrmProtectionPolicyStatus;
  policyStatusLabel: string;
  policyRefMasked: string | null;
  policyStartDate: string | null;
  maturityOrExpiryDate: string | null;
  sourceDocumentId: string | null;
  sourceDocumentTitle: string | null;
  sourceDocumentAvailable: boolean;
  currentConfirmedVersion: AdviserProtectionVersionDto | null;
  version: number;
};

export type AdviserProtectionVersionDto = {
  versionId: string;
  versionNumber: number;
  verificationState: string;
  verificationStateLabel: string;
  effectiveDate: string | null;
  sumAssured: number | null;
  sumAssuredCurrency: string;
  premium: number | null;
  premiumFrequency: CrmProtectionPremiumFrequency | null;
  policyTerm: string | null;
  premiumTerm: string | null;
  coverageComponents: CrmProtectionCoverageComponentDto[];
  riders: CrmProtectionRiderDto[];
  confirmedAt: string | null;
  correctionReason: string | null;
  supersededAt: string | null;
};

export type ClientProtectionPolicySummaryDto = {
  policyId: string;
  insurer: string;
  displayName: string;
  policyCategoryLabel: string;
  policyOwner: string;
  lifeAssured: string;
  policyStatusLabel: string;
  coverageSummary: string;
  premium: number | null;
  premiumFrequencyLabel: string | null;
  lastVerifiedAt: string | null;
  sourceDocumentAvailable: boolean;
  detailHref: string;
};

export type ClientProtectionPortfolioDto = {
  policies: ClientProtectionPolicySummaryDto[];
  lastPortfolioVerifiedAt: string | null;
  bounded: boolean;
};

export type ClientProtectionPolicyDetailDto = {
  policyId: string;
  insurer: string;
  displayName: string;
  policyCategoryLabel: string;
  policyOwner: string;
  lifeAssured: string;
  policyStatusLabel: string;
  coverageComponents: Array<{
    categoryLabel: string;
    amountLabel: string;
    durationLabel: string | null;
  }>;
  premium: number | null;
  premiumFrequencyLabel: string | null;
  policyTerm: string | null;
  lastVerifiedAt: string | null;
  sourceDocumentAvailable: boolean;
  correctionRequestHref: string;
};

export type CrmProtectionAppointmentPreparationDto = {
  protectionReviewRequested: boolean;
  portfolioLastVerifiedAt: string | null;
  provisionalExtractionsAwaitingReview: number;
  missingSourceDocuments: number;
  clientCorrectionRequests: number;
  upcomingPolicyExpiryOrMaturity: number;
  protectionReportAvailable: boolean;
};

export type CrmProtectionWorkspaceView =
  | "summary"
  | "policies"
  | "coverage"
  | "awaiting_verification"
  | "missing_documents"
  | "version_history"
  | "review_activity";
