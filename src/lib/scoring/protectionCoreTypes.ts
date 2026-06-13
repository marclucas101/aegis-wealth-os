export type ProtectionCoreMetricId =
  | "death"
  | "tpd"
  | "critical_illness"
  | "emergency_savings";

export type ProtectionCoreMetricStatus = "ok" | "data_missing";

export type ProtectionCoreMetricResult = {
  id: ProtectionCoreMetricId;
  label: string;
  status: ProtectionCoreMetricStatus;
  actual: number | null;
  target: number | null;
  gap: number | null;
  completionRatio: number | null;
  score: number | null;
  benchmarkFormula: string;
  dataSource: string;
  explanation: string;
};

export type ProtectionCoreInputs = {
  annualIncome: number | null;
  monthlyExpenses: number | null;
  deathCoverage: number | null;
  tpdCoverage: number | null;
  criticalIllnessCoverage: number | null;
  emergencySavings: number | null;
};

export type ProtectionCoreResult = {
  metrics: ProtectionCoreMetricResult[];
  aggregateScore: number | null;
  metricsWithData: number;
  metricsMissing: number;
};
