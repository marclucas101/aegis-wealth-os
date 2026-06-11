import {
  calculateAnnualPremium,
  calculateMonthlyPremium,
  calculatePolicyCount,
  calculateTotalCoverage,
  calculateTotalCurrentValue,
  calculateTotalPaidToDate,
  clampNumber,
  formatCurrency,
  formatPercent,
  getFundsByPolicy,
  getPoliciesByInsuredPerson,
  summarizeProtectionReport,
  validateILPAllocations,
} from "./calculations";
import { sampleProtectionReport } from "./sampleProtectionReport";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Protection report validation failed: ${message}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, label: string): void {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`
  );
}

/**
 * Self-contained validation checks for protection report calculations.
 * Run via `npx tsx scripts/run-protection-report-validation.ts` (no test framework required).
 */
export function runProtectionReportValidations(): {
  passed: number;
  summary: ReturnType<typeof summarizeProtectionReport>;
} {
  const { policies, investmentFunds } = sampleProtectionReport;
  let passed = 0;

  const coverage = calculateTotalCoverage(policies);
  assertApprox(coverage.total, 1_400_000, 0, "total coverage");
  assert(coverage.numericPolicyCount === 3, "numeric policy count should be 3");
  assert(coverage.nonNumericLabels.includes("As charged"), "non-numeric label captured");
  passed += 1;

  assert(calculatePolicyCount(policies) === 4, "policy count should be 4");
  assertApprox(calculateMonthlyPremium(policies), 1_530, 0, "monthly premium");
  assertApprox(calculateAnnualPremium(policies), 18_360, 0, "annual premium");
  assertApprox(calculateTotalCurrentValue(policies), 37_430, 0, "value today");
  assertApprox(calculateTotalPaidToDate(policies), 73_920, 0, "paid to date");
  passed += 1;

  const jamesPolicies = getPoliciesByInsuredPerson(policies, "person-james");
  assert(jamesPolicies.length === 2, "James Mercer should have 2 policies");
  passed += 1;

  const ilpFunds = getFundsByPolicy(investmentFunds, "policy-ilp");
  assert(ilpFunds.length === 2, "ILP policy should have 2 funds");
  const ilpValidation = validateILPAllocations(investmentFunds, ["policy-ilp"]);
  assert(ilpValidation.isValid, "ILP allocations should total 100%");
  assertApprox(ilpValidation.policyResults[0]?.totalPercent ?? 0, 100, 0.01, "ILP total percent");
  passed += 1;

  const invalidFunds = [
    ...investmentFunds,
    {
      id: "fund-invalid",
      policyId: "policy-invalid",
      fundName: "Invalid Split Fund",
      allocationPercent: 50,
      currentValue: 1_000,
    },
  ];
  const invalidValidation = validateILPAllocations(invalidFunds, ["policy-invalid"]);
  assert(!invalidValidation.isValid, "invalid ILP allocation should fail validation");
  passed += 1;

  assert(clampNumber(150, 0, 100) === 100, "clampNumber should cap at max");
  assert(formatPercent(60) === "60%", "formatPercent should render percent");
  assert(formatCurrency(1_530).includes("1,530"), "formatCurrency should format SGD");
  passed += 1;

  const summary = summarizeProtectionReport(sampleProtectionReport);
  assert(summary.policyCount === 4, "summary policy count");
  assertApprox(summary.coverageInForce, 1_400_000, 0, "summary coverage");
  assertApprox(summary.monthlyPremium, 1_530, 0, "summary monthly premium");
  assert(summary.ilpAllocationValidation.isValid, "sample report ILP validation");
  passed += 1;

  return { passed, summary };
}
