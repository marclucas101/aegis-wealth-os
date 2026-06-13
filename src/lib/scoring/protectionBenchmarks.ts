export const PROTECTION_BENCHMARKS = {
  deathAnnualIncomeMultiple: 10,
  tpdAnnualIncomeMultiple: 9,
  criticalIllnessAnnualIncomeMultiple: 4,
  emergencySavingsMonthlyExpenseMultiple: 6,
} as const;

/** Weights for the display-only protection core aggregate (not used in Shield Score). */
export const PROTECTION_CORE_WEIGHTS = {
  death: 0.3,
  tpd: 0.25,
  critical_illness: 0.25,
  emergency_savings: 0.2,
} as const;

export const PROTECTION_BENCHMARK_LABEL =
  "AEGIS planning benchmark";

export const PROTECTION_BENCHMARK_DISCLAIMER =
  "Benchmarks are planning reference points and do not replace a personalised financial needs analysis.";
