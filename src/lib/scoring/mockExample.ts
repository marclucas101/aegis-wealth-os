import { calculateAWRI } from "./calculateAWRI";
import { calculateShieldScore, evaluateFamilyOfficeEligibility } from "./calculateShieldScore";
import { calculateBenchmark } from "./benchmarks";
import { calculateProjectedShield, sortRoadmapByPriority } from "./roadmap";
import { runAllStressTests } from "./stressTests";
import type { ClientFinancialProfile, ClientProfile, RoadmapItem } from "./types";
import { getStrongestPillar, getWeakestPillar } from "./utils";

export const mockClientProfile: ClientProfile = {
  age: 42,
  income: 320_000,
  netWorth: 1_850_000,
  maritalStatus: "married",
  hasChildren: true,
  hasPartner: true,
  occupation: "Business Owner",
  isBusinessOwner: true,
  isRetired: false,
  hasMultipleProperties: true,
  hasCrossBorderAssets: false,
  hasTrustStructure: false,
  hasMultiGenerationDependants: false,
  hasPhilanthropicGoals: false,
};

export const mockFinancialProfile: ClientFinancialProfile = {
  foundation: {
    liquidEmergencyAssets: 72_000,
    monthlyEssentialExpenses: 12_000,
    hospitalisationCoverage: "isp_with_rider",
    incomeStability: "stable_with_side_income",
    monthlySurplus: 6_500,
    monthlyIncome: 26_000,
    protectedDebtAmount: 280_000,
    totalDebt: 420_000,
    liquidityPosition: "three_to_six_months",
  },
  protect: {
    outstandingDebt: 420_000,
    dependantsAnnualExpense: 96_000,
    yearsOfSupportRequired: 15,
    educationFundingNeeds: 180_000,
    finalExpenses: 25_000,
    existingLiquidAssets: 120_000,
    existingLifeCoverage: 900_000,
    annualIncome: 312_000,
    existingCICoverage: 600_000,
    monthlyIncome: 26_000,
    monthlyDisabilityIncomeBenefit: 12_000,
    availableFamilyContinuationCapital: 450_000,
    annualFamilyExpenses: 180_000,
    estimatedEstateCosts: 80_000,
    taxesOrFees: 40_000,
    outstandingLiabilities: 420_000,
    immediateFamilyLiquidityNeeds: 150_000,
    availableEstateLiquidity: 220_000,
    isBusinessOwner: true,
    businessContinuityStatus: "buy_sell_or_succession",
    hasDependants: true,
    estateLiquidityAdequate: false,
  },
  grow: {
    savingsRate: 0.22,
    monthlyInvestmentContribution: 4_500,
    monthlyIncome: 26_000,
    assetAllocationQuality: "diversified_multi_asset",
    assetClassDiversification: 78,
    geographicDiversification: 65,
    sectorDiversification: 70,
    projectedRetirementAssets: 2_400_000,
    requiredRetirementAssets: 3_200_000,
    riskAlignment: "acceptable",
  },
  optimise: {
    highInterestDebtRatio: 0.18,
    totalDebt: 420_000,
    taxEfficiency: "uses_deductions",
    annualInsurancePremiums: 18_000,
    annualIncome: 312_000,
    hasProtectionGaps: false,
    cashAssets: 180_000,
    targetLiquidityReserve: 72_000,
    totalInvestableAssets: 1_200_000,
    investmentCostLevel: "low",
    policyDuplication: "minor",
  },
  transition: {
    marriageReadiness: 85,
    childrenPlanning: 70,
    propertyReadiness: 75,
    parentCareReadiness: 55,
    careerChangeReadiness: 80,
    businessExitReadiness: 60,
    retirementTransition: 65,
    applicable: {
      marriage: true,
      children: true,
      property: true,
      parentCare: true,
      careerChange: true,
      businessExit: true,
      retirement: true,
    },
  },
  preserve: {
    projectedRetirementIncome: 14_000,
    requiredRetirementIncome: 18_000,
    inflationProtection: "balanced",
    healthcareFunding: "reserve_included",
    projectedAssetsLastUntilAge: 92,
    targetPlanningAge: 95,
    drawdownStrategy: "sustainable",
    assetProtection: "insurance_estate_coordination",
  },
  legacy: {
    willScore: 100,
    cpfNominationScore: 80,
    insuranceNominationScore: 90,
    beneficiaryClarityScore: 75,
    trustPlanningScore: 40,
    businessSuccessionScore: 80,
    familyGovernanceScore: 55,
    estateLiquidityScore: 60,
    businessSuccessionApplicable: true,
  },
  discover: {
    personalInfo: 100,
    familyInfo: 90,
    income: 95,
    expenses: 85,
    assets: 90,
    liabilities: 80,
    policies: 75,
    investments: 85,
    retirementGoals: 70,
    estate: 65,
    businessGovernance: 60,
  },
  resilience: {
    liquidityScore: 72,
    incomeDiversityScore: 78,
    assetDiversityScore: 70,
    emergencyFundingScore: 68,
    insuranceAdequacyScore: 74,
    debtBurdenScore: 65,
  },
  behaviour: {
    spendingDiscipline: 75,
    investmentDiscipline: 80,
    goalConsistency: 70,
    emergencyPreparedness: 72,
    emotionalDecisionMaking: 68,
    financialConfidence: 78,
  },
  governance: {
    familyMeetings: 45,
    successorReadiness: 50,
    financialEducation: 60,
    decisionMakingStructure: 55,
    familyConstitution: 30,
    governancePractices: 40,
  },
  continuity: {
    legacyPlanning: 65,
    successionPlanning: 70,
    familyGovernance: 55,
    trustStructures: 40,
    estateLiquidity: 60,
    educationLegacy: 50,
  },
  mitigation: {
    emergencyFundMonths: 6,
    ciCoverageMultipleOfIncome: 1.9,
    hasDisabilityIncomeCoverage: true,
    hasValidWill: true,
    hasDiversifiedPortfolio: true,
    hasHealthcareFundingReserve: true,
    hasBusinessSuccessionPlan: true,
    hasEstateLiquidityPlan: false,
  },
  profile: mockClientProfile,
};

export const mockRoadmapItems: RoadmapItem[] = [
  {
    id: "rm-001",
    title: "Increase emergency reserve to 9 months",
    pillar: "foundation",
    currentScore: 0,
    targetScore: 85,
    estimatedImpact: 8,
    timelineMonths: 6,
    difficulty: "medium",
    priority: "high",
    status: "not_started",
    gapSeverity: 75,
    stressExposure: 80,
    impactPotential: 8,
    urgency: 70,
  },
  {
    id: "rm-002",
    title: "Close critical illness coverage gap",
    pillar: "protect",
    currentScore: 0,
    targetScore: 80,
    estimatedImpact: 7,
    timelineMonths: 3,
    difficulty: "low",
    priority: "high",
    status: "not_started",
    gapSeverity: 65,
    stressExposure: 85,
    impactPotential: 7,
    urgency: 75,
  },
  {
    id: "rm-003",
    title: "Complete trust planning review",
    pillar: "legacy",
    currentScore: 0,
    targetScore: 75,
    estimatedImpact: 10,
    timelineMonths: 12,
    difficulty: "high",
    priority: "medium",
    status: "not_started",
    gapSeverity: 60,
    stressExposure: 55,
    impactPotential: 10,
    urgency: 50,
  },
];

export function runMockScoringDemo() {
  const shield = calculateShieldScore(mockFinancialProfile);

  const awri = calculateAWRI({
    adjustedShieldScore: shield.adjustedShieldScore,
    resilience: mockFinancialProfile.resilience!,
    behaviour: mockFinancialProfile.behaviour!,
    governance: mockFinancialProfile.governance!,
    continuity: mockFinancialProfile.continuity!,
  });

  const benchmark = calculateBenchmark({
    adjustedShieldScore: shield.adjustedShieldScore,
    profile: mockFinancialProfile.profile!,
  });

  const stressTests = runAllStressTests({
    adjustedShieldScore: shield.adjustedShieldScore,
    pillarScores: shield.pillarScores,
    severity: "moderate",
    mitigation: mockFinancialProfile.mitigation,
  });

  const roadmap = sortRoadmapByPriority(mockRoadmapItems);
  const projected = calculateProjectedShield(
    shield.pillarScores,
    roadmap,
    shield.dataConfidenceFactor
  );

  const familyOffice = evaluateFamilyOfficeEligibility({
    adjustedShieldScore: shield.adjustedShieldScore,
    legacyScore: shield.pillarScores.legacy,
    governanceScore: awri.governanceScore,
    continuityScore: awri.continuityScore,
    netWorth: mockFinancialProfile.profile!.netWorth,
    profile: mockFinancialProfile.profile!,
  });

  return {
    shield,
    awri,
    benchmark,
    stressTests,
    roadmap,
    projected,
    familyOffice,
    insights: {
      weakestPillar: getWeakestPillar(shield.pillarScores),
      strongestPillar: getStrongestPillar(shield.pillarScores),
    },
  };
}

