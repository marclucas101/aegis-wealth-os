import {
  MAX_MITIGATION_CREDIT,
  MITIGATION_CREDITS,
  SEVERITY_MULTIPLIERS,
  STRESS_EVENT_PILLAR_WEIGHTS,
  STRESS_PENALTY_FACTOR,
} from "./constants";
import type {
  MitigationInputs,
  PillarScores,
  ShieldPillar,
  StressScenario,
  StressSeverity,
  StressTestResult,
} from "./types";
import { clamp } from "./utils";

export function calculateMitigationCredit(
  mitigation: MitigationInputs
): number {
  let total = 0;

  if (mitigation.emergencyFundMonths >= 6) {
    total += MITIGATION_CREDITS.emergencyFundSixMonths;
  }
  if (mitigation.ciCoverageMultipleOfIncome >= 3) {
    total += MITIGATION_CREDITS.ciCoverageThreeTimesIncome;
  }
  if (mitigation.hasDisabilityIncomeCoverage) {
    total += MITIGATION_CREDITS.disabilityIncomeCoverage;
  }
  if (mitigation.hasValidWill) {
    total += MITIGATION_CREDITS.validWill;
  }
  if (mitigation.hasDiversifiedPortfolio) {
    total += MITIGATION_CREDITS.diversifiedPortfolio;
  }
  if (mitigation.hasHealthcareFundingReserve) {
    total += MITIGATION_CREDITS.healthcareFundingReserve;
  }
  if (mitigation.hasBusinessSuccessionPlan) {
    total += MITIGATION_CREDITS.businessSuccessionPlan;
  }
  if (mitigation.hasEstateLiquidityPlan) {
    total += MITIGATION_CREDITS.estateLiquidityPlan;
  }

  return Math.min(total, MAX_MITIGATION_CREDIT);
}

export function calculateStressPenalty(
  pillarScores: PillarScores,
  scenario: StressScenario,
  severity: StressSeverity
): number {
  const weights = STRESS_EVENT_PILLAR_WEIGHTS[scenario];
  const severityMultiplier = SEVERITY_MULTIPLIERS[severity];

  const penalty = (Object.keys(weights) as ShieldPillar[]).reduce(
    (sum, pillar) => {
      const pillarVulnerability = 100 - pillarScores[pillar];
      const eventWeight = weights[pillar];
      return (
        sum +
        pillarVulnerability * eventWeight * severityMultiplier * STRESS_PENALTY_FACTOR
      );
    },
    0
  );

  return clamp(penalty);
}

export function getAffectedPillars(
  pillarScores: PillarScores,
  scenario: StressScenario,
  severity: StressSeverity
): Partial<PillarScores> {
  const weights = STRESS_EVENT_PILLAR_WEIGHTS[scenario];
  const severityMultiplier = SEVERITY_MULTIPLIERS[severity];
  const affected: Partial<PillarScores> = {};

  (Object.keys(weights) as ShieldPillar[]).forEach((pillar) => {
    const eventWeight = weights[pillar];
    if (eventWeight <= 0) {
      return;
    }

    const pillarImpact = clamp(
      (100 - pillarScores[pillar]) *
        eventWeight *
        severityMultiplier *
        STRESS_PENALTY_FACTOR
    );

    affected[pillar] = pillarImpact;
  });

  return affected;
}

export function runStressTest(params: {
  adjustedShieldScore: number;
  pillarScores: PillarScores;
  scenario: StressScenario;
  severity: StressSeverity;
  mitigation?: MitigationInputs;
}): StressTestResult {
  const stressPenalty = calculateStressPenalty(
    params.pillarScores,
    params.scenario,
    params.severity
  );

  const mitigationCredit = params.mitigation
    ? calculateMitigationCredit(params.mitigation)
    : 0;

  const postStressScore = clamp(
    params.adjustedShieldScore - stressPenalty + mitigationCredit
  );

  return {
    scenario: params.scenario,
    severity: params.severity,
    preStressScore: params.adjustedShieldScore,
    postStressScore,
    stressPenalty,
    mitigationCredit,
    affectedPillars: getAffectedPillars(
      params.pillarScores,
      params.scenario,
      params.severity
    ),
  };
}

export function runAllStressTests(params: {
  adjustedShieldScore: number;
  pillarScores: PillarScores;
  severity?: StressSeverity;
  mitigation?: MitigationInputs;
}): StressTestResult[] {
  const scenarios = Object.keys(
    STRESS_EVENT_PILLAR_WEIGHTS
  ) as StressScenario[];
  const severity = params.severity ?? "moderate";

  return scenarios.map((scenario) =>
    runStressTest({
      adjustedShieldScore: params.adjustedShieldScore,
      pillarScores: params.pillarScores,
      scenario,
      severity,
      mitigation: params.mitigation,
    })
  );
}
