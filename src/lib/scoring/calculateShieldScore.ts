import {
  DISABILITY_INCOME_REPLACEMENT,
  EMERGENCY_FUND_TARGET_MONTHS,
  FAMILY_CONTINUITY_TARGET_YEARS,
  FAMILY_OFFICE_NET_WORTH_THRESHOLD,
  FOUNDATION_SUBFACTOR_WEIGHTS,
  GROW_SUBFACTOR_WEIGHTS,
  LEGACY_SUBFACTOR_WEIGHTS,
  OPTIMISE_SUBFACTOR_WEIGHTS,
  PRESERVE_SUBFACTOR_WEIGHTS,
  PROTECT_SUBFACTOR_WEIGHTS,
  REQUIRED_CI_INCOME_MULTIPLE,
  TARGET_INVESTMENT_RATE,
  TARGET_PLANNING_AGE,
  TARGET_SAVINGS_RATE,
  TRANSITION_SUBFACTOR_WEIGHTS,
} from "./constants";
import { calculateDiscoverScore } from "./calculateDiscoverScore";
import type {
  AssetAllocationQuality,
  AssetProtectionLevel,
  BusinessContinuityStatus,
  ClientFinancialProfile,
  ClientProfile,
  DrawdownStrategyLevel,
  FamilyOfficeEligibilityResult,
  FoundationInputs,
  GrowInputs,
  HealthcareFundingLevel,
  HospitalisationCoverage,
  IncomeStabilityProfile,
  InflationProtectionLevel,
  InvestmentCostLevel,
  LegacyInputs,
  LiquidityPosition,
  OptimiseInputs,
  PillarScores,
  PolicyDuplicationLevel,
  PreserveInputs,
  ProtectInputs,
  RiskAlignmentLevel,
  ShieldScoreResult,
  TaxEfficiencyLevel,
  TransitionInputs,
} from "./types";
import {
  calculateAdjustedShieldScore,
  calculateRawShieldScore,
  clamp,
  getRating,
  ratioScore,
  weightedAverage,
} from "./utils";

const HOSPITALISATION_SCORES: Record<HospitalisationCoverage, number> = {
  none: 0,
  basic_public: 40,
  isp_without_rider: 70,
  isp_with_rider: 90,
  comprehensive_reviewed: 100,
};

const INCOME_STABILITY_SCORES: Record<IncomeStabilityProfile, number> = {
  unemployed_unstable: 20,
  single_variable: 45,
  stable_employment: 70,
  stable_with_side_income: 85,
  multiple_reliable_streams: 100,
};

const LIQUIDITY_POSITION_SCORES: Record<LiquidityPosition, number> = {
  none: 0,
  limited: 40,
  one_to_three_months: 60,
  three_to_six_months: 80,
  six_plus_months: 100,
};

const BUSINESS_CONTINUITY_SCORES: Record<BusinessContinuityStatus, number> = {
  none: 0,
  informal: 30,
  key_person_only: 60,
  buy_sell_or_succession: 80,
  formal_funded: 100,
};

const ASSET_ALLOCATION_SCORES: Record<AssetAllocationQuality, number> = {
  none: 0,
  cash_concentrated: 30,
  basic: 60,
  diversified_multi_asset: 80,
  goals_based_strategic: 100,
};

const RISK_ALIGNMENT_SCORES: Record<RiskAlignmentLevel, number> = {
  severe_mismatch: 20,
  moderate_mismatch: 50,
  acceptable: 75,
  strong: 90,
  documented_ips: 100,
};

const TAX_EFFICIENCY_SCORES: Record<TaxEfficiencyLevel, number> = {
  none: 40,
  basic_awareness: 60,
  uses_deductions: 75,
  structured: 90,
  advanced_coordination: 100,
};

const INVESTMENT_COST_SCORES: Record<InvestmentCostLevel, number> = {
  unknown: 40,
  high: 50,
  moderate: 70,
  low: 90,
  institutional: 100,
};

const POLICY_DUPLICATION_SCORES: Record<PolicyDuplicationLevel, number> = {
  significant: 30,
  moderate: 60,
  minor: 80,
  none: 100,
};

const INFLATION_PROTECTION_SCORES: Record<InflationProtectionLevel, number> = {
  none: 20,
  mostly_cash: 40,
  some_growth: 65,
  balanced: 85,
  strong_linked: 100,
};

const HEALTHCARE_FUNDING_SCORES: Record<HealthcareFundingLevel, number> = {
  none: 20,
  basic: 50,
  good_hospitalisation: 75,
  reserve_included: 90,
  long_term_care: 100,
};

const DRAWDOWN_STRATEGY_SCORES: Record<DrawdownStrategyLevel, number> = {
  none: 20,
  basic_estimate: 50,
  sustainable: 75,
  dynamic: 90,
  tax_aware_multi_bucket: 100,
};

const ASSET_PROTECTION_SCORES: Record<AssetProtectionLevel, number> = {
  none: 30,
  basic_beneficiary: 50,
  insurance_estate_coordination: 75,
  trust_considered: 90,
  formal_structure: 100,
};

export function calculateEmergencyFundScore(input: FoundationInputs): number {
  if (input.monthlyEssentialExpenses <= 0) {
    return input.liquidEmergencyAssets > 0 ? 100 : 0;
  }

  const months =
    input.liquidEmergencyAssets / input.monthlyEssentialExpenses;

  return clamp((months / EMERGENCY_FUND_TARGET_MONTHS) * 100);
}

export function calculateFoundationScore(input: FoundationInputs): number {
  const savingsRate =
    input.monthlyIncome > 0
      ? input.monthlySurplus / input.monthlyIncome
      : 0;

  const debtProtectionScore =
    input.totalDebt <= 0
      ? 100
      : clamp((input.protectedDebtAmount / input.totalDebt) * 100);

  return weightedAverage([
    {
      score: calculateEmergencyFundScore(input),
      weight: FOUNDATION_SUBFACTOR_WEIGHTS.emergencyFund,
    },
    {
      score: HOSPITALISATION_SCORES[input.hospitalisationCoverage],
      weight: FOUNDATION_SUBFACTOR_WEIGHTS.hospitalisation,
    },
    {
      score: INCOME_STABILITY_SCORES[input.incomeStability],
      weight: FOUNDATION_SUBFACTOR_WEIGHTS.incomeStability,
    },
    {
      score: clamp((savingsRate / TARGET_SAVINGS_RATE) * 100),
      weight: FOUNDATION_SUBFACTOR_WEIGHTS.savingsBuffer,
    },
    {
      score: debtProtectionScore,
      weight: FOUNDATION_SUBFACTOR_WEIGHTS.debtProtection,
    },
    {
      score: LIQUIDITY_POSITION_SCORES[input.liquidityPosition],
      weight: FOUNDATION_SUBFACTOR_WEIGHTS.liquidityAccess,
    },
  ]);
}

export function calculateLifeCoverageScore(input: ProtectInputs): number {
  if (!input.hasDependants && input.outstandingDebt <= 0) {
    if (input.estateLiquidityAdequate) {
      return 100;
    }
    return 80;
  }

  const requiredLifeCoverage = Math.max(
    0,
    input.outstandingDebt +
      input.dependantsAnnualExpense * input.yearsOfSupportRequired +
      input.educationFundingNeeds +
      input.finalExpenses -
      input.existingLiquidAssets
  );

  return ratioScore(input.existingLifeCoverage, requiredLifeCoverage);
}

export function calculateProtectScore(input: ProtectInputs): number {
  const requiredCiCoverage = input.annualIncome * REQUIRED_CI_INCOME_MULTIPLE;
  const requiredDisabilityIncome =
    input.monthlyIncome * DISABILITY_INCOME_REPLACEMENT;

  const familyIncomeContinuityYears =
    input.annualFamilyExpenses > 0
      ? input.availableFamilyContinuationCapital / input.annualFamilyExpenses
      : 0;

  const estateLiquidityNeed =
    input.estimatedEstateCosts +
    input.taxesOrFees +
    input.outstandingLiabilities +
    input.immediateFamilyLiquidityNeeds;

  const businessContinuityScore = input.isBusinessOwner
    ? BUSINESS_CONTINUITY_SCORES[
        input.businessContinuityStatus ?? "none"
      ]
    : 100;

  return weightedAverage([
    {
      score: calculateLifeCoverageScore(input),
      weight: PROTECT_SUBFACTOR_WEIGHTS.lifeCoverage,
    },
    {
      score: ratioScore(input.existingCICoverage, requiredCiCoverage),
      weight: PROTECT_SUBFACTOR_WEIGHTS.criticalIllness,
    },
    {
      score: ratioScore(
        input.monthlyDisabilityIncomeBenefit,
        requiredDisabilityIncome
      ),
      weight: PROTECT_SUBFACTOR_WEIGHTS.disabilityIncome,
    },
    {
      score: clamp(
        (familyIncomeContinuityYears / FAMILY_CONTINUITY_TARGET_YEARS) * 100
      ),
      weight: PROTECT_SUBFACTOR_WEIGHTS.familyIncomeContinuity,
    },
    {
      score: ratioScore(input.availableEstateLiquidity, estateLiquidityNeed),
      weight: PROTECT_SUBFACTOR_WEIGHTS.estateLiquidity,
    },
    {
      score: businessContinuityScore,
      weight: PROTECT_SUBFACTOR_WEIGHTS.businessContinuity,
    },
  ]);
}

export function calculateGrowScore(input: GrowInputs): number {
  const investmentRate =
    input.monthlyIncome > 0
      ? input.monthlyInvestmentContribution / input.monthlyIncome
      : 0;

  const diversificationScore = clamp(
    input.assetClassDiversification * 0.5 +
      input.geographicDiversification * 0.25 +
      input.sectorDiversification * 0.25
  );

  return weightedAverage([
    {
      score: clamp((input.savingsRate / TARGET_SAVINGS_RATE) * 100),
      weight: GROW_SUBFACTOR_WEIGHTS.savingsRate,
    },
    {
      score: clamp((investmentRate / TARGET_INVESTMENT_RATE) * 100),
      weight: GROW_SUBFACTOR_WEIGHTS.investmentRate,
    },
    {
      score: ASSET_ALLOCATION_SCORES[input.assetAllocationQuality],
      weight: GROW_SUBFACTOR_WEIGHTS.assetAllocation,
    },
    {
      score: diversificationScore,
      weight: GROW_SUBFACTOR_WEIGHTS.diversification,
    },
    {
      score: ratioScore(
        input.projectedRetirementAssets,
        input.requiredRetirementAssets
      ),
      weight: GROW_SUBFACTOR_WEIGHTS.retirementFunding,
    },
    {
      score: RISK_ALIGNMENT_SCORES[input.riskAlignment],
      weight: GROW_SUBFACTOR_WEIGHTS.riskAlignment,
    },
  ]);
}

export function calculatePremiumEfficiencyScore(input: OptimiseInputs): number {
  if (input.annualIncome <= 0) {
    return input.hasProtectionGaps ? 30 : 100;
  }

  const premiumLoadRatio =
    input.annualInsurancePremiums / input.annualIncome;

  if (premiumLoadRatio === 0 && input.hasProtectionGaps) {
    return 30;
  }
  if (premiumLoadRatio > 0 && premiumLoadRatio <= 0.1) {
    return 100;
  }
  if (premiumLoadRatio <= 0.15) {
    return 80;
  }
  if (premiumLoadRatio <= 0.2) {
    return 60;
  }
  return 40;
}

export function calculateCashDragScore(input: OptimiseInputs): number {
  const excessCash = Math.max(0, input.cashAssets - input.targetLiquidityReserve);

  if (input.totalInvestableAssets <= 0) {
    return excessCash > 0 ? 0 : 100;
  }

  const cashDragRatio = excessCash / input.totalInvestableAssets;
  return clamp(100 - clamp((cashDragRatio / 0.5) * 100));
}

export function calculateOptimiseScore(input: OptimiseInputs): number {
  const debtCostEfficiencyScore =
    input.totalDebt <= 0
      ? 100
      : clamp(100 - clamp(input.highInterestDebtRatio * 100));

  return weightedAverage([
    {
      score: debtCostEfficiencyScore,
      weight: OPTIMISE_SUBFACTOR_WEIGHTS.debtCostEfficiency,
    },
    {
      score: TAX_EFFICIENCY_SCORES[input.taxEfficiency],
      weight: OPTIMISE_SUBFACTOR_WEIGHTS.taxEfficiency,
    },
    {
      score: calculatePremiumEfficiencyScore(input),
      weight: OPTIMISE_SUBFACTOR_WEIGHTS.premiumEfficiency,
    },
    {
      score: calculateCashDragScore(input),
      weight: OPTIMISE_SUBFACTOR_WEIGHTS.cashDrag,
    },
    {
      score: INVESTMENT_COST_SCORES[input.investmentCostLevel],
      weight: OPTIMISE_SUBFACTOR_WEIGHTS.investmentCostEfficiency,
    },
    {
      score: POLICY_DUPLICATION_SCORES[input.policyDuplication],
      weight: OPTIMISE_SUBFACTOR_WEIGHTS.policyDuplication,
    },
  ]);
}

export function calculateTransitionScore(input: TransitionInputs): number {
  const applicable = input.applicable ?? {};

  return weightedAverage([
    {
      score: input.marriageReadiness ?? 0,
      weight: TRANSITION_SUBFACTOR_WEIGHTS.marriage,
      applicable: applicable.marriage ?? true,
    },
    {
      score: input.childrenPlanning ?? 0,
      weight: TRANSITION_SUBFACTOR_WEIGHTS.children,
      applicable: applicable.children ?? true,
    },
    {
      score: input.propertyReadiness ?? 0,
      weight: TRANSITION_SUBFACTOR_WEIGHTS.property,
      applicable: applicable.property ?? true,
    },
    {
      score: input.parentCareReadiness ?? 0,
      weight: TRANSITION_SUBFACTOR_WEIGHTS.parentCare,
      applicable: applicable.parentCare ?? true,
    },
    {
      score: input.careerChangeReadiness ?? 0,
      weight: TRANSITION_SUBFACTOR_WEIGHTS.careerChange,
      applicable: applicable.careerChange ?? true,
    },
    {
      score: input.businessExitReadiness ?? 0,
      weight: TRANSITION_SUBFACTOR_WEIGHTS.businessExit,
      applicable: applicable.businessExit ?? true,
    },
    {
      score: input.retirementTransition ?? 0,
      weight: TRANSITION_SUBFACTOR_WEIGHTS.retirement,
      applicable: applicable.retirement ?? true,
    },
  ]);
}

export function calculatePreserveScore(input: PreserveInputs): number {
  const targetPlanningAge = input.targetPlanningAge ?? TARGET_PLANNING_AGE;
  const longevityBufferYears =
    input.projectedAssetsLastUntilAge - targetPlanningAge;

  return weightedAverage([
    {
      score: ratioScore(
        input.projectedRetirementIncome,
        input.requiredRetirementIncome
      ),
      weight: PRESERVE_SUBFACTOR_WEIGHTS.retirementSustainability,
    },
    {
      score: INFLATION_PROTECTION_SCORES[input.inflationProtection],
      weight: PRESERVE_SUBFACTOR_WEIGHTS.inflationProtection,
    },
    {
      score: HEALTHCARE_FUNDING_SCORES[input.healthcareFunding],
      weight: PRESERVE_SUBFACTOR_WEIGHTS.healthcareFunding,
    },
    {
      score: clamp(((longevityBufferYears + 5) / 20) * 100),
      weight: PRESERVE_SUBFACTOR_WEIGHTS.longevityBuffer,
    },
    {
      score: DRAWDOWN_STRATEGY_SCORES[input.drawdownStrategy],
      weight: PRESERVE_SUBFACTOR_WEIGHTS.drawdownStrategy,
    },
    {
      score: ASSET_PROTECTION_SCORES[input.assetProtection],
      weight: PRESERVE_SUBFACTOR_WEIGHTS.assetProtection,
    },
  ]);
}

export function calculateLegacyScore(input: LegacyInputs): number {
  const businessApplicable = input.businessSuccessionApplicable ?? true;

  return weightedAverage([
    {
      score: input.willScore,
      weight: LEGACY_SUBFACTOR_WEIGHTS.will,
    },
    {
      score: input.cpfNominationScore,
      weight: LEGACY_SUBFACTOR_WEIGHTS.cpfNomination,
    },
    {
      score: input.insuranceNominationScore,
      weight: LEGACY_SUBFACTOR_WEIGHTS.insuranceNomination,
    },
    {
      score: input.beneficiaryClarityScore,
      weight: LEGACY_SUBFACTOR_WEIGHTS.beneficiaryClarity,
    },
    {
      score: input.trustPlanningScore,
      weight: LEGACY_SUBFACTOR_WEIGHTS.trustPlanning,
    },
    {
      score: input.businessSuccessionScore ?? 0,
      weight: LEGACY_SUBFACTOR_WEIGHTS.businessSuccession,
      applicable: businessApplicable,
    },
    {
      score: input.familyGovernanceScore,
      weight: LEGACY_SUBFACTOR_WEIGHTS.familyGovernance,
    },
    {
      score: input.estateLiquidityScore,
      weight: LEGACY_SUBFACTOR_WEIGHTS.estateLiquidity,
    },
  ]);
}

export function calculatePillarScores(
  profile: ClientFinancialProfile
): PillarScores {
  return {
    foundation: calculateFoundationScore(profile.foundation),
    protect: calculateProtectScore(profile.protect),
    grow: calculateGrowScore(profile.grow),
    optimise: calculateOptimiseScore(profile.optimise),
    transition: calculateTransitionScore(profile.transition),
    preserve: calculatePreserveScore(profile.preserve),
    legacy: calculateLegacyScore(profile.legacy),
  };
}

export function calculateShieldScore(
  profile: ClientFinancialProfile
): ShieldScoreResult {
  const pillarScores = calculatePillarScores(profile);
  const rawShieldScore = calculateRawShieldScore(pillarScores);

  const discoverResult = profile.discover
    ? calculateDiscoverScore(profile.discover)
    : { discoverScore: 100, dataConfidenceFactor: 1 };

  const adjustedShieldScore = calculateAdjustedShieldScore(
    rawShieldScore,
    discoverResult.dataConfidenceFactor
  );

  return {
    rawShieldScore,
    adjustedShieldScore,
    dataConfidenceFactor: discoverResult.dataConfidenceFactor,
    discoverScore: discoverResult.discoverScore,
    rating: getRating(adjustedShieldScore),
    pillarScores,
  };
}

export function evaluateFamilyOfficeEligibility(params: {
  adjustedShieldScore: number;
  legacyScore: number;
  governanceScore: number;
  continuityScore: number;
  netWorth: number;
  profile: ClientProfile;
  netWorthThreshold?: number;
}): FamilyOfficeEligibilityResult {
  const threshold = params.netWorthThreshold ?? FAMILY_OFFICE_NET_WORTH_THRESHOLD;
  const reasons: string[] = [];

  if (params.adjustedShieldScore < 90) {
    reasons.push("Adjusted Shield Score must be at least 90.");
  }
  if (params.legacyScore < 80) {
    reasons.push("Legacy Score must be at least 80.");
  }
  if (params.governanceScore < 80) {
    reasons.push("Governance Score must be at least 80.");
  }
  if (params.continuityScore < 80) {
    reasons.push("Continuity Score must be at least 80.");
  }
  if (params.netWorth < threshold) {
    reasons.push(`Net worth must be at least ${threshold}.`);
  }

  const complexityConditionMet =
    params.profile.isBusinessOwner ||
    params.profile.hasMultipleProperties === true ||
    params.profile.hasCrossBorderAssets === true ||
    params.profile.hasTrustStructure === true ||
    params.profile.hasMultiGenerationDependants === true ||
    params.profile.hasPhilanthropicGoals === true;

  if (!complexityConditionMet) {
    reasons.push("At least one family office complexity condition must be met.");
  }

  const complexityScore = clamp(
    (params.profile.isBusinessOwner ? 25 : 0) +
      (params.profile.hasMultipleProperties ? 15 : 0) +
      (params.profile.hasCrossBorderAssets ? 15 : 0) +
      (params.profile.hasTrustStructure ? 20 : 0) +
      (params.profile.hasMultiGenerationDependants ? 15 : 0) +
      (params.profile.hasPhilanthropicGoals ? 10 : 0)
  );

  const familyOfficeReadinessScore = clamp(
    params.adjustedShieldScore * 0.3 +
      params.legacyScore * 0.2 +
      params.governanceScore * 0.2 +
      params.continuityScore * 0.2 +
      complexityScore * 0.1
  );

  const eligible =
    params.adjustedShieldScore >= 90 &&
    params.legacyScore >= 80 &&
    params.governanceScore >= 80 &&
    params.continuityScore >= 80 &&
    params.netWorth >= threshold &&
    complexityConditionMet;

  return {
    eligible,
    familyOfficeReadinessScore,
    reasons: eligible ? [] : reasons,
  };
}
