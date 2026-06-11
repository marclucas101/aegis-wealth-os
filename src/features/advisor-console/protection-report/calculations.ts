import type {
  ILPAllocationValidationResult,
  InvestmentFund,
  NumericCoverageResult,
  Policy,
  ProtectionReportInput,
} from "./types";

/** Tolerance for ILP fund allocation totals (must sum to 100%). */
export const ILP_ALLOCATION_TOLERANCE = 0.01;

export function clampNumber(value: number, min = 0, max = Number.POSITIVE_INFINITY): number {
  return Math.max(min, Math.min(max, value));
}

export function formatCurrency(
  value: number,
  options?: { compact?: boolean; currency?: string; locale?: string }
): string {
  const { compact = false, currency = "SGD", locale = "en-SG" } = options ?? {};
  const abs = Math.abs(value);

  if (compact) {
    if (abs >= 1_000_000) {
      return `S$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (abs >= 10_000) {
      return `S$${(value / 1_000).toFixed(1)}K`;
    }
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${value.toFixed(fractionDigits)}%`;
}

function isNumericCoveragePolicy(policy: Policy): boolean {
  return policy.sumAssuredLabel === undefined;
}

export function calculateTotalCoverage(policies: Policy[]): NumericCoverageResult {
  let total = 0;
  let numericPolicyCount = 0;
  const nonNumericLabels: string[] = [];

  for (const policy of policies) {
    if (!isNumericCoveragePolicy(policy)) {
      if (policy.sumAssuredLabel) {
        nonNumericLabels.push(policy.sumAssuredLabel);
      }
      continue;
    }

    total += policy.sumAssured;
    numericPolicyCount += 1;
  }

  return { total, numericPolicyCount, nonNumericLabels };
}

export function calculatePolicyCount(policies: Policy[]): number {
  return policies.length;
}

export function calculateMonthlyPremium(policies: Policy[]): number {
  return policies.reduce((sum, policy) => sum + (policy.monthlyPremium ?? 0), 0);
}

export function calculateAnnualPremium(policies: Policy[]): number {
  return policies.reduce((sum, policy) => {
    if (policy.annualPremium !== undefined) {
      return sum + policy.annualPremium;
    }
    if (policy.monthlyPremium !== undefined) {
      return sum + policy.monthlyPremium * 12;
    }
    return sum;
  }, 0);
}

export function calculateTotalCurrentValue(policies: Policy[]): number {
  return policies.reduce((sum, policy) => sum + (policy.currentValue ?? 0), 0);
}

export function calculateTotalPaidToDate(policies: Policy[]): number {
  return policies.reduce((sum, policy) => sum + (policy.paidToDate ?? 0), 0);
}

export function getPoliciesByInsuredPerson(
  policies: Policy[],
  insuredPersonId: string
): Policy[] {
  return policies.filter((policy) => policy.insuredPersonId === insuredPersonId);
}

export function getFundsByPolicy(
  investmentFunds: InvestmentFund[],
  policyId: string
): InvestmentFund[] {
  return investmentFunds.filter((fund) => fund.policyId === policyId);
}

export function validateILPAllocations(
  investmentFunds: InvestmentFund[],
  policyIds?: string[]
): ILPAllocationValidationResult {
  const targetPolicyIds =
    policyIds ?? [...new Set(investmentFunds.map((fund) => fund.policyId))];

  const policyResults = targetPolicyIds.map((policyId) => {
    const funds = getFundsByPolicy(investmentFunds, policyId);
    const totalPercent = funds.reduce((sum, fund) => sum + fund.allocationPercent, 0);
    const isValid = Math.abs(totalPercent - 100) <= ILP_ALLOCATION_TOLERANCE;

    return { policyId, totalPercent, isValid };
  });

  return {
    isValid: policyResults.every((result) => result.isValid),
    policyResults,
  };
}

export function summarizeProtectionReport(input: ProtectionReportInput) {
  const coverage = calculateTotalCoverage(input.policies);

  return {
    coverageInForce: coverage.total,
    nonNumericCoverageLabels: coverage.nonNumericLabels,
    policyCount: calculatePolicyCount(input.policies),
    monthlyPremium: calculateMonthlyPremium(input.policies),
    annualPremium: calculateAnnualPremium(input.policies),
    valueToday: calculateTotalCurrentValue(input.policies),
    paidToDate: calculateTotalPaidToDate(input.policies),
    ilpAllocationValidation: validateILPAllocations(input.investmentFunds),
  };
}
