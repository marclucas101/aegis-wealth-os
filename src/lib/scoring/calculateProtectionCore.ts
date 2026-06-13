import {
  PROTECTION_BENCHMARKS,
  PROTECTION_CORE_WEIGHTS,
} from "./protectionBenchmarks";
import type {
  ProtectionCoreInputs,
  ProtectionCoreMetricId,
  ProtectionCoreMetricResult,
  ProtectionCoreResult,
} from "./protectionCoreTypes";
import { clamp } from "./utils";

const METRIC_LABELS: Record<ProtectionCoreMetricId, string> = {
  death: "Death Coverage",
  tpd: "Total & Permanent Disability",
  critical_illness: "Critical Illness",
  emergency_savings: "Emergency Savings",
};

function isPositiveNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

export function parseOptionalAmount(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  if (
    lowered.includes("as charged") ||
    lowered.includes("n/a") ||
    lowered.includes("na") ||
    lowered.includes("unknown")
  ) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed.replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildProtectionCoreInputsFromDiscover(formData: {
  income: {
    primaryIncome: string;
    secondaryIncome: string;
    bonusIncome: string;
  };
  expenses: {
    monthlyEssential: string;
    monthlyDiscretionary: string;
    monthlyHousing: string;
    monthlyInsurance: string;
    monthlyOther: string;
  };
  assets: { cashAssets: string };
  policies: {
    lifeInsurance: string;
    ciCoverage: string;
  };
}): ProtectionCoreInputs {
  const primary = parseOptionalAmount(formData.income.primaryIncome);
  const secondary = parseOptionalAmount(formData.income.secondaryIncome);
  const bonus = parseOptionalAmount(formData.income.bonusIncome);

  const hasIncomeField =
    parseOptionalAmount(formData.income.primaryIncome) !== null ||
    parseOptionalAmount(formData.income.secondaryIncome) !== null ||
    parseOptionalAmount(formData.income.bonusIncome) !== null;

  const annualIncome = hasIncomeField
    ? (primary ?? 0) + (secondary ?? 0) + (bonus ?? 0)
    : null;

  const essential = parseOptionalAmount(formData.expenses.monthlyEssential);
  const discretionary = parseOptionalAmount(formData.expenses.monthlyDiscretionary);
  const housing = parseOptionalAmount(formData.expenses.monthlyHousing);
  const insurance = parseOptionalAmount(formData.expenses.monthlyInsurance);
  const other = parseOptionalAmount(formData.expenses.monthlyOther);

  const hasExpenseField =
    essential !== null ||
    discretionary !== null ||
    housing !== null ||
    insurance !== null ||
    other !== null;

  const monthlyExpenses = hasExpenseField
    ? essential !== null
      ? essential
      : (discretionary ?? 0) +
        (housing ?? 0) +
        (insurance ?? 0) +
        (other ?? 0)
    : null;

  return {
    annualIncome,
    monthlyExpenses,
    deathCoverage: parseOptionalAmount(formData.policies.lifeInsurance),
    tpdCoverage: null,
    criticalIllnessCoverage: parseOptionalAmount(formData.policies.ciCoverage),
    emergencySavings: parseOptionalAmount(formData.assets.cashAssets),
  };
}

type MetricConfig = {
  id: ProtectionCoreMetricId;
  actual: number | null;
  target: number | null;
  benchmarkFormula: string;
  dataSource: string;
  explanation: string;
};

function buildMetricConfig(inputs: ProtectionCoreInputs): MetricConfig[] {
  const deathTarget = isPositiveNumber(inputs.annualIncome)
    ? inputs.annualIncome * PROTECTION_BENCHMARKS.deathAnnualIncomeMultiple
    : null;

  const tpdTarget = isPositiveNumber(inputs.annualIncome)
    ? inputs.annualIncome * PROTECTION_BENCHMARKS.tpdAnnualIncomeMultiple
    : null;

  const ciTarget = isPositiveNumber(inputs.annualIncome)
    ? inputs.annualIncome * PROTECTION_BENCHMARKS.criticalIllnessAnnualIncomeMultiple
    : null;

  const savingsTarget = isPositiveNumber(inputs.monthlyExpenses)
    ? inputs.monthlyExpenses *
      PROTECTION_BENCHMARKS.emergencySavingsMonthlyExpenseMultiple
    : null;

  return [
    {
      id: "death",
      actual: inputs.deathCoverage,
      target: deathTarget,
      benchmarkFormula: `Annual income × ${PROTECTION_BENCHMARKS.deathAnnualIncomeMultiple}`,
      dataSource: "Discover — Life insurance coverage",
      explanation:
        "Death coverage helps replace income and settle obligations if the household loses a breadwinner.",
    },
    {
      id: "tpd",
      actual: inputs.tpdCoverage,
      target: tpdTarget,
      benchmarkFormula: `Annual income × ${PROTECTION_BENCHMARKS.tpdAnnualIncomeMultiple}`,
      dataSource: "Discover — TPD lump-sum coverage (not yet captured)",
      explanation:
        "TPD coverage provides a lump-sum buffer if you cannot work due to total and permanent disability.",
    },
    {
      id: "critical_illness",
      actual: inputs.criticalIllnessCoverage,
      target: ciTarget,
      benchmarkFormula: `Annual income × ${PROTECTION_BENCHMARKS.criticalIllnessAnnualIncomeMultiple}`,
      dataSource: "Discover — Critical illness coverage",
      explanation:
        "Critical illness coverage funds treatment, recovery, and income gaps during a major health event.",
    },
    {
      id: "emergency_savings",
      actual: inputs.emergencySavings,
      target: savingsTarget,
      benchmarkFormula: `Monthly expenses × ${PROTECTION_BENCHMARKS.emergencySavingsMonthlyExpenseMultiple}`,
      dataSource: "Discover — Cash assets & monthly expenses",
      explanation:
        "Emergency savings provide liquidity to absorb shocks without disrupting long-term plans.",
    },
  ];
}

function calculateMetric(config: MetricConfig): ProtectionCoreMetricResult {
  const label = METRIC_LABELS[config.id];

  if (!isPositiveNumber(config.target)) {
    return {
      id: config.id,
      label,
      status: "data_missing",
      actual: config.actual,
      target: null,
      gap: null,
      completionRatio: null,
      score: null,
      benchmarkFormula: config.benchmarkFormula,
      dataSource: config.dataSource,
      explanation: config.explanation,
    };
  }

  if (!isNonNegativeNumber(config.actual)) {
    return {
      id: config.id,
      label,
      status: "data_missing",
      actual: null,
      target: config.target,
      gap: null,
      completionRatio: null,
      score: null,
      benchmarkFormula: config.benchmarkFormula,
      dataSource: config.dataSource,
      explanation: config.explanation,
    };
  }

  const completionRatio = config.actual / config.target;
  const score = clamp(completionRatio * 100, 0, 100);
  const gap = config.actual - config.target;

  return {
    id: config.id,
    label,
    status: "ok",
    actual: config.actual,
    target: config.target,
    gap,
    completionRatio,
    score,
    benchmarkFormula: config.benchmarkFormula,
    dataSource: config.dataSource,
    explanation: config.explanation,
  };
}

export function calculateProtectionCore(
  inputs: ProtectionCoreInputs,
): ProtectionCoreResult {
  const metrics = buildMetricConfig(inputs).map(calculateMetric);

  const scored = metrics.filter(
    (metric): metric is ProtectionCoreMetricResult & { score: number } =>
      metric.status === "ok" && metric.score !== null,
  );

  let aggregateScore: number | null = null;

  if (scored.length > 0) {
    const totalWeight = scored.reduce(
      (sum, metric) => sum + PROTECTION_CORE_WEIGHTS[metric.id],
      0,
    );

    if (totalWeight > 0) {
      aggregateScore = clamp(
        scored.reduce(
          (sum, metric) =>
            sum +
            metric.score * (PROTECTION_CORE_WEIGHTS[metric.id] / totalWeight),
          0,
        ),
      );
    }
  }

  return {
    metrics,
    aggregateScore,
    metricsWithData: scored.length,
    metricsMissing: metrics.length - scored.length,
  };
}
