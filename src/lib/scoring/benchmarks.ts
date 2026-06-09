import {
  BENCHMARK_CLASSIFICATION_THRESHOLDS,
  BENCHMARK_TABLE,
  EXECUTIVE_INCOME_THRESHOLD,
  FAMILY_OFFICE_NET_WORTH_THRESHOLD,
} from "./constants";
import type { BenchmarkClassification, BenchmarkCohort, BenchmarkResult, ClientProfile } from "./types";

export function selectBenchmarkCohort(profile: ClientProfile): BenchmarkCohort {
  if (profile.isBusinessOwner) {
    return "Business Owner";
  }

  if (profile.netWorth >= FAMILY_OFFICE_NET_WORTH_THRESHOLD) {
    return "Family Office Candidate";
  }

  if (profile.isRetired || profile.age >= 60) {
    return "Retiree";
  }

  if (profile.age >= 50) {
    return "Pre-Retiree";
  }

  if (profile.hasChildren) {
    return "Young Family";
  }

  if (profile.occupation === "Medical Professional") {
    return "Medical Professional";
  }

  if (profile.income >= EXECUTIVE_INCOME_THRESHOLD) {
    return "Executive";
  }

  if (
    profile.maritalStatus === "married" ||
    profile.maritalStatus === "partnered" ||
    profile.hasPartner
  ) {
    return "Dual-Income Couple";
  }

  return "Young Professional";
}

export function classifyBenchmarkDelta(delta: number): BenchmarkClassification {
  for (const threshold of BENCHMARK_CLASSIFICATION_THRESHOLDS) {
    if (delta >= threshold.min) {
      return threshold.classification;
    }
  }

  return "Materially Behind";
}

export function calculateBenchmark(params: {
  adjustedShieldScore: number;
  profile: ClientProfile;
}): BenchmarkResult {
  const cohort = selectBenchmarkCohort(params.profile);
  const benchmark = BENCHMARK_TABLE[cohort];
  const benchmarkDelta = params.adjustedShieldScore - benchmark.average;

  return {
    cohort,
    clientScore: params.adjustedShieldScore,
    cohortAverage: benchmark.average,
    top25: benchmark.top25,
    top10: benchmark.top10,
    benchmarkDelta,
    classification: classifyBenchmarkDelta(benchmarkDelta),
  };
}
