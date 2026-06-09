import {
  AWRI_WEIGHTS,
  BEHAVIOUR_SUBFACTOR_WEIGHTS,
  CONTINUITY_SUBFACTOR_WEIGHTS,
  GOVERNANCE_SUBFACTOR_WEIGHTS,
  RESILIENCE_SUBFACTOR_WEIGHTS,
} from "./constants";
import type {
  AWRIResult,
  BehaviourInputs,
  ContinuityInputs,
  GovernanceInputs,
  ResilienceInputs,
} from "./types";
import { clamp, getRating, weightedAverage } from "./utils";

export function calculateResilienceScore(input: ResilienceInputs): number {
  return weightedAverage([
    {
      score: input.liquidityScore,
      weight: RESILIENCE_SUBFACTOR_WEIGHTS.liquidity,
    },
    {
      score: input.incomeDiversityScore,
      weight: RESILIENCE_SUBFACTOR_WEIGHTS.incomeDiversity,
    },
    {
      score: input.assetDiversityScore,
      weight: RESILIENCE_SUBFACTOR_WEIGHTS.assetDiversity,
    },
    {
      score: input.emergencyFundingScore,
      weight: RESILIENCE_SUBFACTOR_WEIGHTS.emergencyFunding,
    },
    {
      score: input.insuranceAdequacyScore,
      weight: RESILIENCE_SUBFACTOR_WEIGHTS.insuranceAdequacy,
    },
    {
      score: input.debtBurdenScore,
      weight: RESILIENCE_SUBFACTOR_WEIGHTS.debtBurden,
    },
  ]);
}

export function calculateBehaviourScore(input: BehaviourInputs): number {
  return weightedAverage([
    {
      score: input.spendingDiscipline,
      weight: BEHAVIOUR_SUBFACTOR_WEIGHTS.spendingDiscipline,
    },
    {
      score: input.investmentDiscipline,
      weight: BEHAVIOUR_SUBFACTOR_WEIGHTS.investmentDiscipline,
    },
    {
      score: input.goalConsistency,
      weight: BEHAVIOUR_SUBFACTOR_WEIGHTS.goalConsistency,
    },
    {
      score: input.emergencyPreparedness,
      weight: BEHAVIOUR_SUBFACTOR_WEIGHTS.emergencyPreparedness,
    },
    {
      score: input.emotionalDecisionMaking,
      weight: BEHAVIOUR_SUBFACTOR_WEIGHTS.emotionalDecisionMaking,
    },
    {
      score: input.financialConfidence,
      weight: BEHAVIOUR_SUBFACTOR_WEIGHTS.financialConfidence,
    },
  ]);
}

export function calculateGovernanceScore(input: GovernanceInputs): number {
  return weightedAverage([
    {
      score: input.familyMeetings,
      weight: GOVERNANCE_SUBFACTOR_WEIGHTS.familyMeetings,
    },
    {
      score: input.successorReadiness,
      weight: GOVERNANCE_SUBFACTOR_WEIGHTS.successorReadiness,
    },
    {
      score: input.financialEducation,
      weight: GOVERNANCE_SUBFACTOR_WEIGHTS.financialEducation,
    },
    {
      score: input.decisionMakingStructure,
      weight: GOVERNANCE_SUBFACTOR_WEIGHTS.decisionMakingStructure,
    },
    {
      score: input.familyConstitution,
      weight: GOVERNANCE_SUBFACTOR_WEIGHTS.familyConstitution,
    },
    {
      score: input.governancePractices,
      weight: GOVERNANCE_SUBFACTOR_WEIGHTS.governancePractices,
    },
  ]);
}

export function calculateContinuityScore(input: ContinuityInputs): number {
  return weightedAverage([
    {
      score: input.legacyPlanning,
      weight: CONTINUITY_SUBFACTOR_WEIGHTS.legacyPlanning,
    },
    {
      score: input.successionPlanning,
      weight: CONTINUITY_SUBFACTOR_WEIGHTS.successionPlanning,
    },
    {
      score: input.familyGovernance,
      weight: CONTINUITY_SUBFACTOR_WEIGHTS.familyGovernance,
    },
    {
      score: input.trustStructures,
      weight: CONTINUITY_SUBFACTOR_WEIGHTS.trustStructures,
    },
    {
      score: input.estateLiquidity,
      weight: CONTINUITY_SUBFACTOR_WEIGHTS.estateLiquidity,
    },
    {
      score: input.educationLegacy,
      weight: CONTINUITY_SUBFACTOR_WEIGHTS.educationLegacy,
    },
  ]);
}

export function calculateAWRI(params: {
  adjustedShieldScore: number;
  resilience: ResilienceInputs;
  behaviour: BehaviourInputs;
  governance: GovernanceInputs;
  continuity: ContinuityInputs;
}): AWRIResult {
  const resilienceScore = calculateResilienceScore(params.resilience);
  const behaviourScore = calculateBehaviourScore(params.behaviour);
  const governanceScore = calculateGovernanceScore(params.governance);
  const continuityScore = calculateContinuityScore(params.continuity);

  const awri = clamp(
    params.adjustedShieldScore * AWRI_WEIGHTS.adjustedShieldScore +
      resilienceScore * AWRI_WEIGHTS.resilience +
      behaviourScore * AWRI_WEIGHTS.behaviour +
      governanceScore * AWRI_WEIGHTS.governance +
      continuityScore * AWRI_WEIGHTS.continuity
  );

  return {
    awri,
    rating: getRating(awri),
    adjustedShieldScore: params.adjustedShieldScore,
    resilienceScore,
    behaviourScore,
    governanceScore,
    continuityScore,
  };
}
