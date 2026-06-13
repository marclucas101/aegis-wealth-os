import { calculateProtectionCore } from "./calculateProtectionCore";
import { calculateShieldScore } from "./calculateShieldScore";
import { mockFinancialProfile } from "./mockExample";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Protection core validation failed: ${message}`);
  }
}

function assertApprox(
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
): void {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}, received ${actual}`,
  );
}

export function runProtectionCoreValidations(): { passed: number } {
  let passed = 0;

  const base = calculateProtectionCore({
    annualIncome: 100_000,
    monthlyExpenses: 5_000,
    deathCoverage: 500_000,
    tpdCoverage: 450_000,
    criticalIllnessCoverage: 200_000,
    emergencySavings: 15_000,
  });

  const death = base.metrics.find((metric) => metric.id === "death");
  assert(death?.target === 1_000_000, "death target should be 10× annual income");
  passed += 1;

  const tpd = base.metrics.find((metric) => metric.id === "tpd");
  assert(tpd?.target === 900_000, "TPD target should be 9× annual income");
  passed += 1;

  const ci = base.metrics.find((metric) => metric.id === "critical_illness");
  assert(ci?.target === 400_000, "CI target should be 4× annual income");
  passed += 1;

  const savings = base.metrics.find((metric) => metric.id === "emergency_savings");
  assert(savings?.target === 30_000, "emergency savings target should be 6× monthly expenses");
  passed += 1;

  const half = calculateProtectionCore({
    annualIncome: 100_000,
    monthlyExpenses: 5_000,
    deathCoverage: 500_000,
    tpdCoverage: null,
    criticalIllnessCoverage: null,
    emergencySavings: null,
  });
  assertApprox(half.metrics[0].score ?? -1, 50, 0.01, "50% death completion");
  passed += 1;

  const overfunded = calculateProtectionCore({
    annualIncome: 100_000,
    monthlyExpenses: 5_000,
    deathCoverage: 2_000_000,
    tpdCoverage: null,
    criticalIllnessCoverage: null,
    emergencySavings: null,
  });
  assert(overfunded.metrics[0].score === 100, "overfunded death should cap at 100");
  passed += 1;

  const missing = calculateProtectionCore({
    annualIncome: null,
    monthlyExpenses: 5_000,
    deathCoverage: null,
    tpdCoverage: null,
    criticalIllnessCoverage: null,
    emergencySavings: 10_000,
  });
  assert(
    missing.metrics
      .filter((metric) => metric.id !== "emergency_savings")
      .every((metric) => metric.status === "data_missing"),
    "missing income should mark income-based metrics as data_missing",
  );
  assert(
    missing.metrics.find((metric) => metric.id === "emergency_savings")?.status ===
      "ok",
    "emergency savings can compute when expenses and cash are present",
  );
  passed += 1;

  const zeroIncome = calculateProtectionCore({
    annualIncome: 0,
    monthlyExpenses: 5_000,
    deathCoverage: 100_000,
    tpdCoverage: 100_000,
    criticalIllnessCoverage: 50_000,
    emergencySavings: 10_000,
  });
  assert(
    zeroIncome.metrics
      .filter((metric) => metric.id !== "emergency_savings")
      .every((metric) => metric.status === "data_missing"),
    "zero annual income must not divide by zero",
  );
  passed += 1;

  const zeroExpenses = calculateProtectionCore({
    annualIncome: 120_000,
    monthlyExpenses: 0,
    deathCoverage: 500_000,
    tpdCoverage: null,
    criticalIllnessCoverage: 200_000,
    emergencySavings: 5_000,
  });
  const emergency = zeroExpenses.metrics.find(
    (metric) => metric.id === "emergency_savings",
  );
  assert(
    emergency?.status === "data_missing",
    "zero monthly expenses should not produce emergency savings target",
  );
  passed += 1;

  const shieldBefore = calculateShieldScore(mockFinancialProfile);
  const shieldAfter = calculateShieldScore(mockFinancialProfile);
  assert(
    shieldBefore.adjustedShieldScore === shieldAfter.adjustedShieldScore,
    "existing shield score must remain stable",
  );
  passed += 1;

  return { passed };
}
