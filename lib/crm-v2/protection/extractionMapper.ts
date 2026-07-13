/**
 * Maps protection report structured output to extraction fields (Phase 07).
 * Reuses existing report generator structured output only.
 */

import type { Policy, ProtectionReportInput } from "@/src/features/advisor-console/protection-report/types";
import { maskPolicyNumber } from "@/lib/crm-v2/protection/deduplication";
import type {
  AdviserProtectionExtractedFieldsDto,
  CrmProtectionCoverageCategory,
  CrmProtectionPolicyCategory,
  CrmProtectionPolicyStatus,
  CrmProtectionPremiumFrequency,
} from "@/lib/crm-v2/protection/types";
import { CRM_PROTECTION_COVERAGE_CATEGORIES } from "@/lib/crm-v2/protection/types";

function mapPolicyCategory(policyType: string): CrmProtectionPolicyCategory {
  const normalized = policyType.trim().toLowerCase();
  if (normalized.includes("term")) return "term_life";
  if (normalized.includes("whole")) return "whole_life";
  if (normalized.includes("endowment") || normalized.includes("savings")) return "endowment";
  if (normalized.includes("ilp") || normalized.includes("investment")) return "investment_linked";
  if (normalized.includes("health") || normalized.includes("hospital")) return "health";
  if (normalized.includes("accident")) return "accident";
  if (normalized.includes("long-term") || normalized.includes("ltc")) return "long_term_care";
  if (normalized.includes("disability")) return "disability_income";
  return "other";
}

function inferCoverageCategory(text: string): CrmProtectionCoverageCategory {
  const normalized = text.toLowerCase();
  if (normalized.includes("death") || normalized.includes("life")) return "death";
  if (normalized.includes("tpd") || normalized.includes("total permanent")) {
    return "total_permanent_disability";
  }
  if (normalized.includes("early critical") || normalized.includes("eci")) {
    return "early_critical_illness";
  }
  if (normalized.includes("critical") || normalized.includes(" ci")) return "critical_illness";
  if (normalized.includes("hospital")) return "hospitalisation";
  if (normalized.includes("accident")) return "personal_accident";
  if (normalized.includes("disability income") || normalized.includes("income")) {
    return "disability_income";
  }
  if (normalized.includes("long-term care") || normalized.includes("ltc")) return "long_term_care";
  if (normalized.includes("waiver")) return "waiver";
  if (normalized.includes("endowment") || normalized.includes("savings")) return "savings_endowment";
  if (normalized.includes("ilp") || normalized.includes("investment")) return "investment_linked";
  return "other";
}

function categoryLabel(category: CrmProtectionCoverageCategory): string {
  return category.replace(/_/g, " ");
}

function mapPremiumFrequency(policy: Policy): CrmProtectionPremiumFrequency {
  if (policy.annualPremium && !policy.monthlyPremium) return "annual";
  if (policy.monthlyPremium) return "monthly";
  return "unknown";
}

function mapPolicyStatus(): CrmProtectionPolicyStatus {
  return "in_force";
}

function buildCoverageComponents(policy: Policy): AdviserProtectionExtractedFieldsDto["coverageComponents"] {
  const text = policy.whatItCovers || policy.planName || "";
  const category = inferCoverageCategory(text);
  if (!(CRM_PROTECTION_COVERAGE_CATEGORIES as readonly string[]).includes(category)) {
    return [];
  }
  return [
    {
      category,
      categoryLabel: categoryLabel(category),
      amount: Number.isFinite(policy.sumAssured) ? policy.sumAssured : null,
      currency: "SGD",
      durationLabel: policy.policyTerm ?? null,
      insurerWording: policy.whatItCovers?.slice(0, 500) ?? null,
      isRider: false,
    },
  ];
}

export function mapReportPolicyToExtractedFields(
  policy: Policy,
  insuredPersons: ProtectionReportInput["insuredPersons"],
): AdviserProtectionExtractedFieldsDto {
  const insured = insuredPersons.find((p) => p.id === policy.insuredPersonId);
  const lifeAssured = insured?.fullName?.trim() || "Unknown";
  const warnings: string[] = [];
  if (!policy.insurer?.trim()) warnings.push("missing_insurer");
  if (!policy.planName?.trim()) warnings.push("missing_plan_name");
  if (!policy.policyNumber?.trim()) warnings.push("missing_policy_ref");

  return {
    insurer: policy.insurer?.trim() || "Unknown insurer",
    displayName: policy.planName?.trim() || "Unnamed policy",
    policyCategory: mapPolicyCategory(policy.policyType || policy.planName || ""),
    policyOwner: lifeAssured,
    lifeAssured,
    policyStatus: mapPolicyStatus(),
    policyRefMasked: policy.policyNumber ? maskPolicyNumber(policy.policyNumber) : null,
    policyStartDate: policy.policyStart ?? null,
    maturityOrExpiryDate: null,
    sumAssured: Number.isFinite(policy.sumAssured) ? policy.sumAssured : null,
    sumAssuredCurrency: "SGD",
    premium: policy.monthlyPremium ?? policy.annualPremium ?? null,
    premiumFrequency: mapPremiumFrequency(policy),
    policyTerm: policy.policyTerm ?? null,
    premiumTerm: policy.premiumTerm ?? null,
    coverageComponents: buildCoverageComponents(policy),
    riders: [],
  };
}

export function mapProtectionReportToExtractions(
  report: ProtectionReportInput,
): Array<{ sourcePolicyKey: string; fields: AdviserProtectionExtractedFieldsDto; warnings: string[] }> {
  return report.policies.map((policy) => {
    const fields = mapReportPolicyToExtractedFields(policy, report.insuredPersons);
    const warnings: string[] = [];
    if (!fields.policyRefMasked) warnings.push("policy_ref_unavailable");
    if (fields.sumAssured === null && !policy.sumAssuredLabel) {
      warnings.push("sum_assured_non_numeric");
    }
    return {
      sourcePolicyKey: policy.id,
      fields,
      warnings,
    };
  });
}

export function buildExtractionConfidenceWarnings(
  fields: AdviserProtectionExtractedFieldsDto,
  extraWarnings: string[] = [],
): string[] {
  const warnings = [...extraWarnings];
  if (!fields.insurer || fields.insurer === "Unknown insurer") {
    warnings.push("insurer_uncertain");
  }
  if (fields.coverageComponents.length === 0) {
    warnings.push("coverage_category_uncertain");
  }
  if (!fields.policyRefMasked) {
    warnings.push("policy_ref_masked_only");
  }
  return Array.from(new Set(warnings)).slice(0, 20);
}
