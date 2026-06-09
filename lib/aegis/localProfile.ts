import {
  calculateAWRI,
  calculateDiscoverScore,
  calculatePillarScores,
  calculateProjectedShield,
  calculateShieldScore,
  calculateBenchmark,
  estimatePillarGapSeverity,
  getStrongestPillar,
  getWeakestPillar,
  runAllStressTests,
  sortRoadmapByPriority,
} from "@/src/lib/scoring";
import type {
  AssetAllocationQuality,
  AWRIResult,
  BehaviourInputs,
  BenchmarkResult,
  BusinessContinuityStatus,
  ClientFinancialProfile,
  ClientProfile,
  ContinuityInputs,
  DiscoverCompleteness,
  GovernanceInputs,
  HospitalisationCoverage,
  IncomeStabilityProfile,
  LiquidityPosition,
  MitigationInputs,
  PillarScores,
  ProjectedShieldResult,
  ResilienceInputs,
  RiskAlignmentLevel,
  RoadmapItem,
  ShieldPillar,
  ShieldRating,
  ShieldScoreResult,
  StressSeverity,
  StressTestResult,
} from "@/src/lib/scoring/types";

const STORAGE_KEY = "aegis-discover-profile-v1";
const ROADMAP_STATUS_KEY = "aegis-roadmap-status-v1";

export interface DiscoverFormData {
  personal: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    nationality: string;
    maritalStatus: string;
    occupation: string;
    residency: string;
  };
  family: {
    hasPartner: boolean;
    partnerName: string;
    numberOfChildren: string;
    dependantDetails: string;
    caregivingResponsibilities: string;
  };
  income: {
    primaryIncome: string;
    secondaryIncome: string;
    incomeType: string;
    employer: string;
    bonusIncome: string;
  };
  expenses: {
    monthlyEssential: string;
    monthlyDiscretionary: string;
    monthlyHousing: string;
    monthlyInsurance: string;
    monthlyOther: string;
  };
  assets: {
    cashAssets: string;
    cpfBalance: string;
    propertyValue: string;
    investmentProperty: string;
    otherAssets: string;
  };
  liabilities: {
    mortgageBalance: string;
    personalLoans: string;
    creditCardDebt: string;
    otherLiabilities: string;
    totalDebt: string;
  };
  policies: {
    lifeInsurance: string;
    healthInsurance: string;
    ciCoverage: string;
    disabilityCoverage: string;
    hasPolicyReview: boolean;
  };
  investments: {
    investmentAccounts: string;
    totalInvestments: string;
    assetAllocation: string;
    riskProfile: string;
    monthlyContribution: string;
  };
  retirement: {
    targetRetirementAge: string;
    desiredRetirementIncome: string;
    currentRetirementSavings: string;
    retirementPriority: string;
    cpfLifePlan: string;
  };
  estate: {
    hasWill: boolean;
    hasCpfNomination: boolean;
    hasTrust: boolean;
    beneficiaryDocumented: boolean;
    estatePlanReviewed: boolean;
  };
  business: {
    isBusinessOwner: boolean;
    businessName: string;
    successionPlan: string;
    familyGovernance: string;
    familyMeetings: string;
  };
}

export interface DiscoverStoredProfile {
  version: 1;
  completedAt: string;
  formData: DiscoverFormData;
  completeness: DiscoverCompleteness;
  discoverScore: number;
  dataConfidenceFactor: number;
}

export type SaveDiscoverProfileInput = Pick<
  DiscoverStoredProfile,
  "formData" | "completeness" | "discoverScore" | "dataConfidenceFactor"
>;

const PILLAR_LABELS: Record<ShieldPillar, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

function isFilled(value: string | boolean | undefined): boolean {
  if (typeof value === "boolean") return true;
  if (value === undefined) return false;
  return value.trim().length > 0;
}

function sectionScore(filled: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

export function computeCompleteness(data: DiscoverFormData): DiscoverCompleteness {
  const personalFields = [
    data.personal.firstName,
    data.personal.lastName,
    data.personal.dateOfBirth,
    data.personal.nationality,
    data.personal.maritalStatus,
    data.personal.occupation,
    data.personal.residency,
  ];
  const personalFilled = personalFields.filter((field) => isFilled(field)).length;

  const familyFields = [
    data.family.numberOfChildren,
    data.family.dependantDetails,
    data.family.hasPartner ? data.family.partnerName : "n/a",
    data.family.caregivingResponsibilities,
  ];
  const familyFilled = familyFields.filter((field) => isFilled(field)).length;

  const incomeFields = [
    data.income.primaryIncome,
    data.income.incomeType,
    data.income.employer,
  ];
  const incomeFilled = incomeFields.filter((field) => isFilled(field)).length;
  const incomeBonus = [data.income.secondaryIncome, data.income.bonusIncome].filter(
    (field) => isFilled(field)
  ).length;

  const expenseFields = Object.values(data.expenses);
  const expenseFilled = expenseFields.filter((field) => isFilled(field)).length;

  const assetFields = Object.values(data.assets);
  const assetFilled = assetFields.filter((field) => isFilled(field)).length;

  const liabilityFields = Object.values(data.liabilities);
  const liabilityFilled = liabilityFields.filter((field) => isFilled(field)).length;

  const policyFields = [
    data.policies.lifeInsurance,
    data.policies.healthInsurance,
    data.policies.ciCoverage,
    data.policies.disabilityCoverage,
  ];
  const policyFilled = policyFields.filter((field) => isFilled(field)).length;
  const policyBonus = data.policies.hasPolicyReview ? 1 : 0;

  const investmentFields = Object.values(data.investments);
  const investmentFilled = investmentFields.filter((field) => isFilled(field)).length;

  const retirementFields = Object.values(data.retirement);
  const retirementFilled = retirementFields.filter((field) => isFilled(field)).length;

  const estateBooleans = Object.values(data.estate);
  const estateFilled = estateBooleans.filter(Boolean).length;

  const businessFields = data.business.isBusinessOwner
    ? [
        data.business.businessName,
        data.business.successionPlan,
        data.business.familyGovernance,
        data.business.familyMeetings,
      ]
    : [data.business.familyGovernance, data.business.familyMeetings];
  const businessFilled = businessFields.filter((field) => isFilled(field)).length;
  const businessBonus = data.business.isBusinessOwner ? 0 : 1;

  return {
    personalInfo: Math.min(100, sectionScore(personalFilled, personalFields.length)),
    familyInfo: Math.min(100, sectionScore(familyFilled, familyFields.length)),
    income: Math.min(
      100,
      sectionScore(incomeFilled + incomeBonus, incomeFields.length + 2)
    ),
    expenses: Math.min(100, sectionScore(expenseFilled, expenseFields.length)),
    assets: Math.min(100, sectionScore(assetFilled, assetFields.length)),
    liabilities: Math.min(
      100,
      sectionScore(liabilityFilled, liabilityFields.length)
    ),
    policies: Math.min(
      100,
      sectionScore(policyFilled + policyBonus, policyFields.length + 1)
    ),
    investments: Math.min(
      100,
      sectionScore(investmentFilled, investmentFields.length)
    ),
    retirementGoals: Math.min(
      100,
      sectionScore(retirementFilled, retirementFields.length)
    ),
    estate: Math.min(100, sectionScore(estateFilled, estateBooleans.length)),
    businessGovernance: Math.min(
      100,
      sectionScore(businessFilled + businessBonus, businessFields.length + 1)
    ),
  };
}

function parseNum(value: string): number {
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return 40;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return Math.max(18, age);
}

function mapMaritalStatus(
  value: string
): ClientProfile["maritalStatus"] {
  const allowed: ClientProfile["maritalStatus"][] = [
    "single",
    "married",
    "partnered",
    "divorced",
    "widowed",
  ];
  return allowed.includes(value as ClientProfile["maritalStatus"])
    ? (value as ClientProfile["maritalStatus"])
    : "single";
}

function mapHospitalisation(value: string): HospitalisationCoverage {
  const map: Record<string, HospitalisationCoverage> = {
    none: "none",
    basic_public: "basic_public",
    isp_without_rider: "isp_without_rider",
    isp_with_rider: "isp_with_rider",
    comprehensive: "comprehensive_reviewed",
  };
  return map[value] ?? "none";
}

function mapIncomeStability(
  incomeType: string,
  hasSecondaryIncome: boolean
): IncomeStabilityProfile {
  switch (incomeType) {
    case "business":
      return "single_variable";
    case "investment":
    case "mixed":
      return "multiple_reliable_streams";
    case "employment":
      return hasSecondaryIncome ? "stable_with_side_income" : "stable_employment";
    default:
      return "stable_employment";
  }
}

function mapLiquidityPosition(
  liquidAssets: number,
  monthlyEssential: number
): LiquidityPosition {
  if (monthlyEssential <= 0) {
    return liquidAssets > 0 ? "six_plus_months" : "none";
  }

  const months = liquidAssets / monthlyEssential;
  if (months <= 0) return "none";
  if (months < 1) return "limited";
  if (months < 3) return "one_to_three_months";
  if (months < 6) return "three_to_six_months";
  return "six_plus_months";
}

function mapAssetAllocation(value: string): AssetAllocationQuality {
  const map: Record<string, AssetAllocationQuality> = {
    cash_heavy: "cash_concentrated",
    conservative: "basic",
    balanced: "diversified_multi_asset",
    growth: "diversified_multi_asset",
    strategic: "goals_based_strategic",
  };
  return map[value] ?? "basic";
}

function mapRiskAlignment(
  riskProfile: string,
  assetAllocation: string
): RiskAlignmentLevel {
  if (assetAllocation === "strategic") return "documented_ips";
  if (riskProfile === "conservative" && assetAllocation === "growth") {
    return "severe_mismatch";
  }
  if (riskProfile === "aggressive" && assetAllocation === "cash_heavy") {
    return "severe_mismatch";
  }
  if (riskProfile === "moderate" || riskProfile === "balanced") {
    return "acceptable";
  }
  return "strong";
}

function mapBusinessContinuity(value: string): BusinessContinuityStatus {
  const map: Record<string, BusinessContinuityStatus> = {
    none: "none",
    informal: "informal",
    key_person: "key_person_only",
    formal: "buy_sell_or_succession",
  };
  return map[value] ?? "none";
}

function mapGovernanceMaturity(value: string): number {
  const map: Record<string, number> = {
    none: 25,
    basic: 45,
    structured: 70,
    formal: 90,
  };
  return map[value] ?? 30;
}

function mapSuccessionScore(value: string): number {
  const map: Record<string, number> = {
    none: 20,
    informal: 45,
    key_person: 65,
    formal: 85,
  };
  return map[value] ?? 30;
}

function diversificationFromAllocation(allocation: string): {
  assetClass: number;
  geographic: number;
  sector: number;
} {
  switch (allocation) {
    case "cash_heavy":
      return { assetClass: 35, geographic: 30, sector: 25 };
    case "conservative":
      return { assetClass: 55, geographic: 45, sector: 40 };
    case "balanced":
      return { assetClass: 75, geographic: 60, sector: 65 };
    case "growth":
      return { assetClass: 70, geographic: 55, sector: 60 };
    case "strategic":
      return { assetClass: 85, geographic: 75, sector: 78 };
    default:
      return { assetClass: 50, geographic: 45, sector: 45 };
  }
}

function buildClientFinancialProfile(
  stored: DiscoverStoredProfile
): ClientFinancialProfile {
  const { formData, completeness } = stored;
  const data = formData;

  const annualIncome =
    parseNum(data.income.primaryIncome) +
    parseNum(data.income.secondaryIncome) +
    parseNum(data.income.bonusIncome);
  const monthlyIncome = annualIncome / 12;

  const monthlyEssential = parseNum(data.expenses.monthlyEssential);
  const monthlyExpenses =
    monthlyEssential +
    parseNum(data.expenses.monthlyDiscretionary) +
    parseNum(data.expenses.monthlyHousing) +
    parseNum(data.expenses.monthlyInsurance) +
    parseNum(data.expenses.monthlyOther);
  const monthlySurplus = Math.max(0, monthlyIncome - monthlyExpenses);

  const cashAssets = parseNum(data.assets.cashAssets);
  const cpfBalance = parseNum(data.assets.cpfBalance);
  const propertyValue = parseNum(data.assets.propertyValue);
  const investmentProperty = parseNum(data.assets.investmentProperty);
  const otherAssets = parseNum(data.assets.otherAssets);
  const totalInvestments = parseNum(data.investments.totalInvestments);
  const totalDebt =
    parseNum(data.liabilities.totalDebt) ||
    parseNum(data.liabilities.mortgageBalance) +
      parseNum(data.liabilities.personalLoans) +
      parseNum(data.liabilities.creditCardDebt) +
      parseNum(data.liabilities.otherLiabilities);

  const highInterestDebt =
    parseNum(data.liabilities.creditCardDebt) +
    parseNum(data.liabilities.personalLoans);
  const highInterestDebtRatio =
    totalDebt > 0 ? highInterestDebt / totalDebt : 0;

  const netWorth =
    cashAssets +
    cpfBalance +
    propertyValue +
    investmentProperty +
    otherAssets +
    totalInvestments -
    totalDebt;

  const numberOfChildren = parseNum(data.family.numberOfChildren);
  const hasDependants =
    numberOfChildren > 0 || isFilled(data.family.dependantDetails);
  const hasSecondaryIncome = parseNum(data.income.secondaryIncome) > 0;

  const targetRetirementAge = parseNum(data.retirement.targetRetirementAge) || 65;
  const currentAge = calculateAge(data.personal.dateOfBirth);
  const yearsToRetirement = Math.max(1, targetRetirementAge - currentAge);
  const desiredRetirementIncome = parseNum(data.retirement.desiredRetirementIncome);
  const currentRetirementSavings = parseNum(data.retirement.currentRetirementSavings);
  const requiredRetirementAssets = Math.max(
    desiredRetirementIncome * 12 * 25,
    currentRetirementSavings
  );
  const projectedRetirementAssets =
    currentRetirementSavings +
    parseNum(data.investments.monthlyContribution) * 12 * yearsToRetirement;

  const diversification = diversificationFromAllocation(
    data.investments.assetAllocation
  );
  const savingsRate =
    monthlyIncome > 0 ? monthlySurplus / monthlyIncome : 0;

  const annualFamilyExpenses = monthlyExpenses * 12;
  const dependantsAnnualExpense = hasDependants
    ? Math.max(monthlyEssential * 12, annualFamilyExpenses * 0.6)
    : 0;
  const educationFundingNeeds = numberOfChildren * 90_000;

  const clientProfile: ClientProfile = {
    age: currentAge,
    income: annualIncome,
    netWorth,
    maritalStatus: mapMaritalStatus(data.personal.maritalStatus),
    hasChildren: numberOfChildren > 0,
    hasPartner: data.family.hasPartner,
    occupation: data.personal.occupation,
    isBusinessOwner: data.business.isBusinessOwner,
    isRetired: false,
    hasMultipleProperties: investmentProperty > 0,
    hasTrustStructure: data.estate.hasTrust,
    hasMultiGenerationDependants: isFilled(data.family.caregivingResponsibilities),
  };

  return {
    foundation: {
      liquidEmergencyAssets: cashAssets,
      monthlyEssentialExpenses: monthlyEssential || monthlyExpenses,
      hospitalisationCoverage: mapHospitalisation(data.policies.healthInsurance),
      incomeStability: mapIncomeStability(data.income.incomeType, hasSecondaryIncome),
      monthlySurplus,
      monthlyIncome,
      protectedDebtAmount: Math.min(parseNum(data.policies.lifeInsurance), totalDebt),
      totalDebt,
      liquidityPosition: mapLiquidityPosition(
        cashAssets,
        monthlyEssential || monthlyExpenses
      ),
    },
    protect: {
      outstandingDebt: totalDebt,
      dependantsAnnualExpense,
      yearsOfSupportRequired: 15,
      educationFundingNeeds,
      finalExpenses: 25_000,
      existingLiquidAssets: cashAssets + totalInvestments * 0.2,
      existingLifeCoverage: parseNum(data.policies.lifeInsurance),
      annualIncome,
      existingCICoverage: parseNum(data.policies.ciCoverage),
      monthlyIncome,
      monthlyDisabilityIncomeBenefit: parseNum(data.policies.disabilityCoverage),
      availableFamilyContinuationCapital:
        cashAssets + parseNum(data.policies.lifeInsurance) * 0.35,
      annualFamilyExpenses,
      estimatedEstateCosts: Math.max(50_000, netWorth * 0.03),
      taxesOrFees: Math.max(20_000, netWorth * 0.015),
      outstandingLiabilities: totalDebt,
      immediateFamilyLiquidityNeeds: monthlyEssential * 6,
      availableEstateLiquidity: cashAssets + cpfBalance * 0.5,
      isBusinessOwner: data.business.isBusinessOwner,
      businessContinuityStatus: mapBusinessContinuity(data.business.successionPlan),
      hasDependants,
      estateLiquidityAdequate: data.estate.hasWill && cashAssets > monthlyEssential * 12,
    },
    grow: {
      savingsRate,
      monthlyInvestmentContribution: parseNum(data.investments.monthlyContribution),
      monthlyIncome,
      assetAllocationQuality: mapAssetAllocation(data.investments.assetAllocation),
      assetClassDiversification: diversification.assetClass,
      geographicDiversification: diversification.geographic,
      sectorDiversification: diversification.sector,
      projectedRetirementAssets,
      requiredRetirementAssets,
      riskAlignment: mapRiskAlignment(
        data.investments.riskProfile,
        data.investments.assetAllocation
      ),
    },
    optimise: {
      highInterestDebtRatio,
      totalDebt,
      taxEfficiency: data.income.incomeType === "business" ? "uses_deductions" : "basic_awareness",
      annualInsurancePremiums: parseNum(data.expenses.monthlyInsurance) * 12,
      annualIncome,
      hasProtectionGaps:
        parseNum(data.policies.lifeInsurance) < totalDebt && hasDependants,
      cashAssets,
      targetLiquidityReserve: (monthlyEssential || monthlyExpenses) * 6,
      totalInvestableAssets: totalInvestments + cashAssets,
      investmentCostLevel:
        parseNum(data.investments.investmentAccounts) >= 3 ? "low" : "moderate",
      policyDuplication: data.policies.hasPolicyReview ? "minor" : "moderate",
    },
    transition: {
      marriageReadiness:
        data.personal.maritalStatus === "married" ||
        data.personal.maritalStatus === "partnered"
          ? 85
          : 55,
      childrenPlanning: completeness.familyInfo,
      propertyReadiness: propertyValue > 0 ? 75 : 40,
      parentCareReadiness: completeness.familyInfo,
      careerChangeReadiness: completeness.income,
      businessExitReadiness: mapSuccessionScore(data.business.successionPlan),
      retirementTransition: completeness.retirementGoals,
      applicable: {
        marriage: true,
        children: numberOfChildren > 0 || isFilled(data.family.dependantDetails),
        property: propertyValue > 0 || investmentProperty > 0,
        parentCare: isFilled(data.family.caregivingResponsibilities),
        careerChange: true,
        businessExit: data.business.isBusinessOwner,
        retirement: true,
      },
    },
    preserve: {
      projectedRetirementIncome:
        desiredRetirementIncome > 0
          ? desiredRetirementIncome * (projectedRetirementAssets / requiredRetirementAssets)
          : monthlyIncome * 0.6,
      requiredRetirementIncome: desiredRetirementIncome || monthlyIncome * 0.7,
      inflationProtection:
        data.investments.assetAllocation === "cash_heavy"
          ? "mostly_cash"
          : data.investments.assetAllocation === "strategic"
            ? "strong_linked"
            : "balanced",
      healthcareFunding: (() => {
        const coverage = mapHospitalisation(data.policies.healthInsurance);
        if (
          coverage === "isp_with_rider" ||
          coverage === "isp_without_rider" ||
          coverage === "comprehensive_reviewed"
        ) {
          return "good_hospitalisation" as const;
        }
        return "basic" as const;
      })(),
      projectedAssetsLastUntilAge: targetRetirementAge + 25,
      drawdownStrategy:
        data.retirement.retirementPriority === "legacy_focus"
          ? "tax_aware_multi_bucket"
          : "sustainable",
      assetProtection: data.estate.hasTrust
        ? "formal_structure"
        : data.estate.hasWill
          ? "insurance_estate_coordination"
          : "basic_beneficiary",
    },
    legacy: {
      willScore: data.estate.hasWill ? 100 : 0,
      cpfNominationScore: data.estate.hasCpfNomination ? 80 : 0,
      insuranceNominationScore: data.policies.hasPolicyReview ? 90 : 50,
      beneficiaryClarityScore: data.estate.beneficiaryDocumented ? 75 : 20,
      trustPlanningScore: data.estate.hasTrust ? 100 : 25,
      businessSuccessionScore: mapSuccessionScore(data.business.successionPlan),
      familyGovernanceScore: mapGovernanceMaturity(data.business.familyGovernance),
      estateLiquidityScore: data.estate.estatePlanReviewed ? 75 : 45,
      businessSuccessionApplicable: data.business.isBusinessOwner,
    },
    discover: completeness,
    profile: clientProfile,
  };
}

export function saveDiscoverProfile(input: SaveDiscoverProfileInput): void {
  if (typeof window === "undefined") return;

  const profile: DiscoverStoredProfile = {
    version: 1,
    completedAt: new Date().toISOString(),
    ...input,
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function loadDiscoverProfile(): DiscoverStoredProfile | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DiscoverStoredProfile;
    if (parsed.version !== 1 || !parsed.formData) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDiscoverProfile(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function mapDiscoverProfileToPillarScores(
  profile: DiscoverStoredProfile
): PillarScores {
  const financialProfile = buildClientFinancialProfile(profile);
  return calculatePillarScores(financialProfile);
}

export function computeShieldDiagnosticResult(
  profile: DiscoverStoredProfile
): ShieldScoreResult {
  const financialProfile = buildClientFinancialProfile(profile);
  return calculateShieldScore(financialProfile);
}

export function getWeakestPillars(
  scores: PillarScores,
  count = 3
): Array<{ pillar: ShieldPillar; label: string; score: number }> {
  return (Object.entries(scores) as Array<[ShieldPillar, number]>)
    .sort(([, a], [, b]) => a - b)
    .slice(0, count)
    .map(([pillar, score]) => ({
      pillar,
      label: PILLAR_LABELS[pillar],
      score,
    }));
}

export function refreshDiscoverScores(
  profile: DiscoverStoredProfile
): DiscoverStoredProfile {
  const completeness = computeCompleteness(profile.formData);
  const discoverResult = calculateDiscoverScore(completeness);
  return {
    ...profile,
    completeness,
    discoverScore: discoverResult.discoverScore,
    dataConfidenceFactor: discoverResult.dataConfidenceFactor,
  };
}

const GAP_TITLES: Record<ShieldPillar, string> = {
  foundation: "Strengthen emergency reserve and liquidity buffer",
  protect: "Close protection and coverage gaps",
  grow: "Improve savings rate and investment alignment",
  optimise: "Reduce inefficiencies and structural drag",
  transition: "Prepare for upcoming life transitions",
  preserve: "Strengthen retirement income sustainability",
  legacy: "Advance estate and succession planning",
};

function deriveResilienceInputs(
  financial: ClientFinancialProfile,
  pillarScores: PillarScores
): ResilienceInputs {
  const { foundation, grow, optimise } = financial;

  return {
    liquidityScore: pillarScores.foundation,
    incomeDiversityScore: clampScore(
      pillarScores.foundation * 0.4 +
        (foundation.incomeStability === "multiple_reliable_streams" ? 85 : 65)
    ),
    assetDiversityScore: clampScore(
      (grow.assetClassDiversification +
        grow.geographicDiversification +
        grow.sectorDiversification) /
        3
    ),
    emergencyFundingScore: pillarScores.foundation,
    insuranceAdequacyScore: pillarScores.protect,
    debtBurdenScore: clampScore(
      100 - optimise.highInterestDebtRatio * 100 * 0.6
    ),
  };
}

function deriveBehaviourInputs(
  financial: ClientFinancialProfile,
  completeness: DiscoverCompleteness
): BehaviourInputs {
  const savingsDiscipline = clampScore(financial.grow.savingsRate * 250);
  const completenessAvg =
    Object.values(completeness).reduce((sum, value) => sum + value, 0) /
    Object.values(completeness).length;

  return {
    spendingDiscipline: clampScore(completeness.expenses * 0.7 + savingsDiscipline * 0.3),
    investmentDiscipline: clampScore(
      completeness.investments * 0.6 + pillarScoreAverage(financial, "grow") * 0.4
    ),
    goalConsistency: clampScore(completeness.retirementGoals),
    emergencyPreparedness: pillarScoreAverage(financial, "foundation"),
    emotionalDecisionMaking: clampScore(completenessAvg * 0.85),
    financialConfidence: clampScore(completenessAvg),
  };
}

function deriveGovernanceInputs(
  formData: DiscoverFormData,
  completeness: DiscoverCompleteness
): GovernanceInputs {
  const governanceMaturity = mapGovernanceMaturity(formData.business.familyGovernance);
  const meetingScore =
    formData.business.familyMeetings === "formal"
      ? 90
      : formData.business.familyMeetings === "structured"
        ? 70
        : formData.business.familyMeetings === "basic"
          ? 45
          : 25;

  return {
    familyMeetings: meetingScore,
    successorReadiness: mapSuccessionScore(formData.business.successionPlan),
    financialEducation: clampScore(completeness.investments * 0.8),
    decisionMakingStructure: governanceMaturity,
    familyConstitution: clampScore(governanceMaturity * 0.7),
    governancePractices: clampScore(
      completeness.businessGovernance * 0.6 + governanceMaturity * 0.4
    ),
  };
}

function deriveContinuityInputs(
  financial: ClientFinancialProfile,
  completeness: DiscoverCompleteness
): ContinuityInputs {
  const { legacy, preserve } = financial;

  return {
    legacyPlanning: clampScore(
      (legacy.willScore +
        legacy.cpfNominationScore +
        legacy.beneficiaryClarityScore) /
        3
    ),
    successionPlanning: legacy.businessSuccessionApplicable
      ? (legacy.businessSuccessionScore ?? mapSuccessionScore("none"))
      : mapSuccessionScore("none"),
    familyGovernance: legacy.familyGovernanceScore,
    trustStructures: legacy.trustPlanningScore,
    estateLiquidity: legacy.estateLiquidityScore,
    educationLegacy: clampScore(
      completeness.familyInfo * 0.5 +
        (preserve.healthcareFunding === "good_hospitalisation" ? 75 : 50) * 0.5
    ),
  };
}

function deriveMitigationInputs(
  financial: ClientFinancialProfile,
  formData: DiscoverFormData
): MitigationInputs {
  const monthlyEssential = financial.foundation.monthlyEssentialExpenses;
  const emergencyFundMonths =
    monthlyEssential > 0
      ? financial.foundation.liquidEmergencyAssets / monthlyEssential
      : 0;
  const annualIncome = financial.protect.annualIncome;
  const ciCoverageMultipleOfIncome =
    annualIncome > 0 ? financial.protect.existingCICoverage / annualIncome : 0;

  const allocation = formData.investments.assetAllocation;
  const hasDiversifiedPortfolio =
    allocation === "balanced" ||
    allocation === "growth" ||
    allocation === "strategic";

  return {
    emergencyFundMonths,
    ciCoverageMultipleOfIncome,
    hasDisabilityIncomeCoverage: parseNum(formData.policies.disabilityCoverage) > 0,
    hasValidWill: formData.estate.hasWill,
    hasDiversifiedPortfolio,
    hasHealthcareFundingReserve:
      financial.preserve.healthcareFunding === "good_hospitalisation" ||
      financial.preserve.healthcareFunding === "reserve_included",
    hasBusinessSuccessionPlan:
      formData.business.isBusinessOwner &&
      (formData.business.successionPlan === "formal" ||
        formData.business.successionPlan === "key_person"),
    hasEstateLiquidityPlan:
      formData.estate.estatePlanReviewed && formData.estate.hasWill,
  };
}

function pillarScoreAverage(
  financial: ClientFinancialProfile,
  pillar: keyof PillarScores
): number {
  switch (pillar) {
    case "foundation":
      return clampScore(
        (financial.foundation.liquidEmergencyAssets /
          Math.max(financial.foundation.monthlyEssentialExpenses * 6, 1)) *
          20
      );
    case "grow":
      return clampScore(financial.grow.savingsRate * 250);
    default:
      return 60;
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createRoadmapItem(params: {
  id: string;
  title: string;
  pillar: ShieldPillar;
  currentScore: number;
  targetScore?: number;
  estimatedImpact: number;
  timelineMonths: number;
  difficulty: RoadmapItem["difficulty"];
}): RoadmapItem {
  const targetScore = params.targetScore ?? 80;
  const gapSeverity = estimatePillarGapSeverity(params.currentScore, targetScore);
  const estimatedImpact = clampScore(params.estimatedImpact);

  return {
    id: params.id,
    title: params.title,
    pillar: params.pillar,
    currentScore: params.currentScore,
    targetScore,
    estimatedImpact,
    timelineMonths: params.timelineMonths,
    difficulty: params.difficulty,
    priority: "medium",
    status: "not_started",
    gapSeverity,
    stressExposure: clampScore(100 - params.currentScore),
    impactPotential: estimatedImpact,
    urgency: clampScore(gapSeverity * 0.85),
  };
}

function buildActionsForPillar(
  pillar: ShieldPillar,
  currentScore: number,
  financial: ClientFinancialProfile,
  formData: DiscoverFormData
): RoadmapItem[] {
  const actions: RoadmapItem[] = [];
  const monthlyEssential = financial.foundation.monthlyEssentialExpenses;
  const emergencyMonths =
    monthlyEssential > 0
      ? financial.foundation.liquidEmergencyAssets / monthlyEssential
      : 0;

  switch (pillar) {
    case "foundation":
      if (emergencyMonths < 6) {
        actions.push(
          createRoadmapItem({
            id: "foundation-emergency-fund",
            title: "Improve emergency fund",
            pillar,
            currentScore,
            estimatedImpact: emergencyMonths < 3 ? 9 : 6,
            timelineMonths: emergencyMonths < 3 ? 9 : 6,
            difficulty: emergencyMonths < 3 ? "high" : "medium",
          })
        );
      }
      break;

    case "protect":
      actions.push(
        createRoadmapItem({
          id: "protect-adequacy-review",
          title: "Review protection adequacy",
          pillar,
          currentScore,
          estimatedImpact: 5,
          timelineMonths: 3,
          difficulty: "low",
        })
      );
      if (parseNum(formData.policies.disabilityCoverage) <= 0) {
        actions.push(
          createRoadmapItem({
            id: "protect-disability",
            title: "Improve disability protection",
            pillar,
            currentScore,
            estimatedImpact: 6,
            timelineMonths: 4,
            difficulty: "medium",
          })
        );
      }
      break;

    case "grow":
      if (financial.grow.projectedRetirementAssets < financial.grow.requiredRetirementAssets) {
        actions.push(
          createRoadmapItem({
            id: "grow-retirement-funding",
            title: "Improve retirement funding",
            pillar,
            currentScore,
            estimatedImpact: 8,
            timelineMonths: 12,
            difficulty: "medium",
          })
        );
      }
      break;

    case "optimise":
      if (formData.investments.assetAllocation === "cash_heavy") {
        actions.push(
          createRoadmapItem({
            id: "optimise-cash-drag",
            title: "Reduce cash drag",
            pillar,
            currentScore,
            estimatedImpact: 5,
            timelineMonths: 6,
            difficulty: "medium",
          })
        );
      }
      break;

    case "preserve":
      if (financial.grow.projectedRetirementAssets < financial.grow.requiredRetirementAssets) {
        actions.push(
          createRoadmapItem({
            id: "preserve-retirement-funding",
            title: "Improve retirement funding",
            pillar,
            currentScore,
            estimatedImpact: 7,
            timelineMonths: 12,
            difficulty: "medium",
          })
        );
      }
      break;

    case "legacy":
      if (!formData.estate.hasWill) {
        actions.push(
          createRoadmapItem({
            id: "legacy-will",
            title: "Complete will",
            pillar,
            currentScore,
            estimatedImpact: 8,
            timelineMonths: 4,
            difficulty: "medium",
          })
        );
      }
      if (!formData.estate.hasCpfNomination || !formData.policies.hasPolicyReview) {
        actions.push(
          createRoadmapItem({
            id: "legacy-nominations",
            title: "Add CPF / insurance nominations",
            pillar,
            currentScore,
            estimatedImpact: 5,
            timelineMonths: 2,
            difficulty: "low",
          })
        );
      }
      if (
        formData.business.isBusinessOwner &&
        formData.business.successionPlan !== "formal"
      ) {
        actions.push(
          createRoadmapItem({
            id: "legacy-business-succession",
            title: "Establish business succession plan",
            pillar,
            currentScore,
            estimatedImpact: 12,
            timelineMonths: 12,
            difficulty: "high",
          })
        );
      }
      if (
        formData.business.familyGovernance === "none" ||
        formData.business.familyGovernance === "basic"
      ) {
        actions.push(
          createRoadmapItem({
            id: "legacy-family-governance",
            title: "Strengthen family governance",
            pillar,
            currentScore,
            estimatedImpact: 8,
            timelineMonths: 9,
            difficulty: "high",
          })
        );
      }
      break;

    case "transition":
      if (
        formData.business.isBusinessOwner &&
        formData.business.successionPlan !== "formal"
      ) {
        actions.push(
          createRoadmapItem({
            id: "transition-business-succession",
            title: "Establish business succession plan",
            pillar,
            currentScore,
            estimatedImpact: 10,
            timelineMonths: 12,
            difficulty: "high",
          })
        );
      }
      break;
  }

  if (actions.length === 0) {
    const gapSeverity = estimatePillarGapSeverity(currentScore);
    actions.push(
      createRoadmapItem({
        id: `gap-${pillar}-fallback`,
        title: GAP_TITLES[pillar],
        pillar,
        currentScore,
        estimatedImpact: clampScore(gapSeverity * 0.15),
        timelineMonths: gapSeverity >= 50 ? 12 : gapSeverity >= 30 ? 6 : 3,
        difficulty: gapSeverity >= 50 ? "high" : gapSeverity >= 30 ? "medium" : "low",
      })
    );
  }

  return actions.slice(0, 2);
}

function buildRoadmapFromPillars(
  pillarScores: PillarScores,
  financial: ClientFinancialProfile,
  formData: DiscoverFormData,
  count = 3
): RoadmapItem[] {
  const weakest = getWeakestPillars(pillarScores, count);
  const seenIds = new Set<string>();

  return weakest.flatMap(({ pillar, score }) =>
    buildActionsForPillar(pillar, score, financial, formData).filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    })
  );
}

export type RoadmapItemStatus = RoadmapItem["status"];

export function loadRoadmapStatuses(): Record<string, RoadmapItemStatus> {
  if (typeof window === "undefined") return {};

  const raw = window.localStorage.getItem(ROADMAP_STATUS_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, RoadmapItemStatus>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function saveRoadmapStatus(id: string, status: RoadmapItemStatus): void {
  if (typeof window === "undefined") return;

  const current = loadRoadmapStatuses();
  current[id] = status;
  window.localStorage.setItem(ROADMAP_STATUS_KEY, JSON.stringify(current));
}

export function applyRoadmapStatuses(
  items: RoadmapItem[],
  statuses: Record<string, RoadmapItemStatus>
): RoadmapItem[] {
  return items.map((item) => ({
    ...item,
    status: statuses[item.id] ?? item.status,
  }));
}

export interface RoadmapPageResults {
  shield: ShieldScoreResult;
  roadmap: RoadmapItem[];
  projected: ProjectedShieldResult;
  client: ClientProfile;
  completedAt: string;
}

export function computeRoadmapFromProfile(
  profile: DiscoverStoredProfile,
  statuses: Record<string, RoadmapItemStatus> = {}
): RoadmapPageResults {
  const refreshed = refreshDiscoverScores(profile);
  const financialProfile = buildClientFinancialProfile(refreshed);
  const shield = calculateShieldScore(financialProfile);

  const roadmap = sortRoadmapByPriority(
    applyRoadmapStatuses(
      buildRoadmapFromPillars(
        shield.pillarScores,
        financialProfile,
        refreshed.formData
      ),
      statuses
    )
  );

  const projected = calculateProjectedShield(
    shield.pillarScores,
    roadmap,
    shield.dataConfidenceFactor
  );

  return {
    shield,
    roadmap,
    projected,
    client: financialProfile.profile!,
    completedAt: refreshed.completedAt,
  };
}

export interface DashboardResults {
  shield: ShieldScoreResult;
  awri: AWRIResult;
  benchmark: BenchmarkResult;
  stressTests: StressTestResult[];
  roadmap: RoadmapItem[];
  client: ClientProfile;
  insights: {
    weakestPillar: ShieldPillar;
    strongestPillar: ShieldPillar;
    weakestPillars: ReturnType<typeof getWeakestPillars>;
  };
  completedAt: string;
}

export function computeDashboardFromProfile(
  profile: DiscoverStoredProfile
): DashboardResults {
  const refreshed = refreshDiscoverScores(profile);
  const financialProfile = buildClientFinancialProfile(refreshed);
  const shield = calculateShieldScore(financialProfile);

  const awri = calculateAWRI({
    adjustedShieldScore: shield.adjustedShieldScore,
    resilience: deriveResilienceInputs(financialProfile, shield.pillarScores),
    behaviour: deriveBehaviourInputs(financialProfile, refreshed.completeness),
    governance: deriveGovernanceInputs(refreshed.formData, refreshed.completeness),
    continuity: deriveContinuityInputs(financialProfile, refreshed.completeness),
  });

  const benchmark = calculateBenchmark({
    adjustedShieldScore: shield.adjustedShieldScore,
    profile: financialProfile.profile!,
  });

  const stressTests = runAllStressTests({
    adjustedShieldScore: shield.adjustedShieldScore,
    pillarScores: shield.pillarScores,
    severity: "moderate",
    mitigation: deriveMitigationInputs(financialProfile, refreshed.formData),
  });

  const roadmap = sortRoadmapByPriority(
    buildRoadmapFromPillars(
      shield.pillarScores,
      financialProfile,
      refreshed.formData
    )
  );

  return {
    shield,
    awri,
    benchmark,
    stressTests,
    roadmap,
    client: financialProfile.profile!,
    insights: {
      weakestPillar: getWeakestPillar(shield.pillarScores),
      strongestPillar: getStrongestPillar(shield.pillarScores),
      weakestPillars: getWeakestPillars(shield.pillarScores, 3),
    },
    completedAt: refreshed.completedAt,
  };
}

export interface StressTestingPageResults {
  shield: ShieldScoreResult;
  stressTests: StressTestResult[];
  client: ClientProfile;
  completedAt: string;
}

export interface BlueprintPageResults {
  shield: ShieldScoreResult;
  awri: AWRIResult;
  stressTests: StressTestResult[];
  topStressExposures: StressTestResult[];
  roadmap: RoadmapItem[];
  projected: ProjectedShieldResult;
  weakestPillars: ReturnType<typeof getWeakestPillars>;
  client: ClientProfile;
  formData: DiscoverFormData;
  completedAt: string;
}

export function computeBlueprintFromProfile(
  profile: DiscoverStoredProfile
): BlueprintPageResults {
  const dashboard = computeDashboardFromProfile(profile);
  const roadmapResults = computeRoadmapFromProfile(profile);

  const topStressExposures = [...dashboard.stressTests]
    .sort((a, b) => a.postStressScore - b.postStressScore)
    .slice(0, 3);

  return {
    shield: dashboard.shield,
    awri: dashboard.awri,
    stressTests: dashboard.stressTests,
    topStressExposures,
    roadmap: roadmapResults.roadmap,
    projected: roadmapResults.projected,
    weakestPillars: dashboard.insights.weakestPillars,
    client: dashboard.client,
    formData: profile.formData,
    completedAt: dashboard.completedAt,
  };
}

export function computeStressTestingFromProfile(
  profile: DiscoverStoredProfile,
  severity: StressSeverity = "moderate"
): StressTestingPageResults {
  const refreshed = refreshDiscoverScores(profile);
  const financialProfile = buildClientFinancialProfile(refreshed);
  const shield = calculateShieldScore(financialProfile);

  const stressTests = runAllStressTests({
    adjustedShieldScore: shield.adjustedShieldScore,
    pillarScores: shield.pillarScores,
    severity,
    mitigation: deriveMitigationInputs(financialProfile, refreshed.formData),
  });

  return {
    shield,
    stressTests,
    client: financialProfile.profile!,
    completedAt: refreshed.completedAt,
  };
}

export interface AnnualReviewTimelineYear {
  calendarYear: number;
  yearOffset: number;
  label: string;
  adjustedShieldScore: number;
  rating: ShieldRating;
  progressPercent: number;
  actionsCompleted: number;
}

function roadmapAtYearOffset(
  items: RoadmapItem[],
  yearOffset: number
): RoadmapItem[] {
  if (yearOffset === 0) {
    return items;
  }

  const monthsCutoff = yearOffset * 12;
  const includeAll = yearOffset >= 3;

  return items.map((item) => {
    if (item.status === "completed") {
      return item;
    }
    if (includeAll || item.timelineMonths <= monthsCutoff) {
      return { ...item, status: "completed" as const };
    }
    return item;
  });
}

function buildAnnualReviewTimeline(
  currentScore: number,
  shield: ShieldScoreResult,
  roadmap: RoadmapItem[]
): AnnualReviewTimelineYear[] {
  const currentYear = new Date().getFullYear();
  const targetRoadmap = roadmapAtYearOffset(roadmap, 3);
  const targetProjected = calculateProjectedShield(
    shield.pillarScores,
    targetRoadmap,
    shield.dataConfidenceFactor
  );
  const targetScore = targetProjected.projectedAdjustedShieldScore;
  const scoreRange = targetScore - currentScore;

  const labels = ["Current Year", "Year +1", "Year +2", "Year +3 Target"];

  return [0, 1, 2, 3].map((yearOffset) => {
    let score: number;
    let rating: ShieldRating;
    let actionsCompleted: number;

    if (yearOffset === 0) {
      score = currentScore;
      rating = shield.rating;
      actionsCompleted = roadmap.filter((item) => item.status === "completed").length;
    } else {
      const yearRoadmap = roadmapAtYearOffset(roadmap, yearOffset);
      const projected = calculateProjectedShield(
        shield.pillarScores,
        yearRoadmap,
        shield.dataConfidenceFactor
      );
      score = projected.projectedAdjustedShieldScore;
      rating = projected.projectedRating;
      actionsCompleted = yearRoadmap.filter(
        (item) => item.status === "completed"
      ).length;
    }

    const progressPercent =
      scoreRange > 0
        ? Math.round(((score - currentScore) / scoreRange) * 100)
        : 100;

    return {
      calendarYear: currentYear + yearOffset,
      yearOffset,
      label: labels[yearOffset],
      adjustedShieldScore: score,
      rating,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
      actionsCompleted,
    };
  });
}

export interface AnnualReviewPageResults {
  shield: ShieldScoreResult;
  awri: AWRIResult;
  projected: ProjectedShieldResult;
  roadmap: RoadmapItem[];
  timeline: AnnualReviewTimelineYear[];
  topStressExposures: StressTestResult[];
  weakestPillars: ReturnType<typeof getWeakestPillars>;
  discoverScore: number;
  dataConfidenceFactor: number;
  totalImprovement: number;
  client: ClientProfile;
  formData: DiscoverFormData;
  completedAt: string;
}

export function computeAnnualReviewFromProfile(
  profile: DiscoverStoredProfile,
  statuses: Record<string, RoadmapItemStatus> = {}
): AnnualReviewPageResults {
  const blueprint = computeBlueprintFromProfile(profile);
  const roadmapResults = computeRoadmapFromProfile(profile, statuses);
  const { shield, roadmap } = roadmapResults;

  const targetProjected = calculateProjectedShield(
    shield.pillarScores,
    roadmap.map((item) => ({ ...item, status: "completed" as const })),
    shield.dataConfidenceFactor
  );

  const timeline = buildAnnualReviewTimeline(
    shield.adjustedShieldScore,
    shield,
    roadmap
  );

  const refreshed = refreshDiscoverScores(profile);

  return {
    shield,
    awri: blueprint.awri,
    projected: targetProjected,
    roadmap,
    timeline,
    topStressExposures: blueprint.topStressExposures,
    weakestPillars: blueprint.weakestPillars,
    discoverScore: refreshed.discoverScore,
    dataConfidenceFactor: refreshed.dataConfidenceFactor,
    totalImprovement:
      targetProjected.projectedAdjustedShieldScore - shield.adjustedShieldScore,
    client: blueprint.client,
    formData: blueprint.formData,
    completedAt: blueprint.completedAt,
  };
}

export { PILLAR_LABELS };
