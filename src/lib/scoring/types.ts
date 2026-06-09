export type ShieldPillar =
  | "foundation"
  | "protect"
  | "grow"
  | "optimise"
  | "transition"
  | "preserve"
  | "legacy";

export type ShieldRating = "AAA" | "AA" | "A" | "BBB" | "BB" | "B";

export type StressSeverity = "mild" | "moderate" | "severe" | "extreme";

export type StressScenario =
  | "income_loss"
  | "critical_illness"
  | "death_event"
  | "disability"
  | "market_crash"
  | "inflation_shock"
  | "longevity"
  | "business_failure"
  | "parent_care"
  | "estate_delay";

export type RoadmapPriority = "low" | "medium" | "high" | "critical";

export type BenchmarkClassification =
  | "Leading"
  | "Above Average"
  | "In Line"
  | "Below Average"
  | "Materially Behind";

export type BenchmarkCohort =
  | "Young Professional"
  | "Dual-Income Couple"
  | "Young Family"
  | "Executive"
  | "Business Owner"
  | "Medical Professional"
  | "Affluent Family"
  | "Pre-Retiree"
  | "Retiree"
  | "Family Office Candidate";

export interface PillarScores {
  foundation: number;
  protect: number;
  grow: number;
  optimise: number;
  transition: number;
  preserve: number;
  legacy: number;
}

export interface DiscoverCompleteness {
  personalInfo: number;
  familyInfo: number;
  income: number;
  expenses: number;
  assets: number;
  liabilities: number;
  policies: number;
  investments: number;
  retirementGoals: number;
  estate: number;
  businessGovernance: number;
}

export interface DiscoverScoreResult {
  discoverScore: number;
  dataConfidenceFactor: number;
  categories: DiscoverCompleteness;
}

export interface ShieldScoreResult {
  rawShieldScore: number;
  adjustedShieldScore: number;
  dataConfidenceFactor: number;
  discoverScore: number;
  rating: ShieldRating;
  pillarScores: PillarScores;
}

export interface AWRIResult {
  awri: number;
  rating: ShieldRating;
  adjustedShieldScore: number;
  resilienceScore: number;
  behaviourScore: number;
  governanceScore: number;
  continuityScore: number;
}

export interface StressTestResult {
  scenario: StressScenario;
  severity: StressSeverity;
  preStressScore: number;
  postStressScore: number;
  stressPenalty: number;
  mitigationCredit: number;
  affectedPillars: Partial<PillarScores>;
}

export interface BenchmarkResult {
  cohort: BenchmarkCohort;
  clientScore: number;
  cohortAverage: number;
  top25: number;
  top10: number;
  benchmarkDelta: number;
  classification: BenchmarkClassification;
}

export interface RoadmapItem {
  id: string;
  title: string;
  pillar: ShieldPillar;
  currentScore: number;
  targetScore: number;
  estimatedImpact: number;
  timelineMonths: number;
  difficulty: "low" | "medium" | "high";
  priority: RoadmapPriority;
  status: "not_started" | "in_progress" | "completed";
  gapSeverity?: number;
  stressExposure?: number;
  impactPotential?: number;
  urgency?: number;
}

export interface ProjectedShieldResult {
  projectedPillarScores: PillarScores;
  projectedRawShieldScore: number;
  projectedAdjustedShieldScore: number;
  projectedRating: ShieldRating;
}

export interface FamilyOfficeEligibilityResult {
  eligible: boolean;
  familyOfficeReadinessScore: number;
  reasons: string[];
}

export interface ClientProfile {
  age: number;
  income: number;
  netWorth: number;
  maritalStatus: "single" | "married" | "partnered" | "divorced" | "widowed";
  hasChildren: boolean;
  hasPartner: boolean;
  occupation?: string;
  isBusinessOwner: boolean;
  isRetired: boolean;
  hasMultipleProperties?: boolean;
  hasCrossBorderAssets?: boolean;
  hasTrustStructure?: boolean;
  hasMultiGenerationDependants?: boolean;
  hasPhilanthropicGoals?: boolean;
}

export type HospitalisationCoverage =
  | "none"
  | "basic_public"
  | "isp_without_rider"
  | "isp_with_rider"
  | "comprehensive_reviewed";

export type IncomeStabilityProfile =
  | "unemployed_unstable"
  | "single_variable"
  | "stable_employment"
  | "stable_with_side_income"
  | "multiple_reliable_streams";

export type LiquidityPosition =
  | "none"
  | "limited"
  | "one_to_three_months"
  | "three_to_six_months"
  | "six_plus_months";

export type BusinessContinuityStatus =
  | "none"
  | "informal"
  | "key_person_only"
  | "buy_sell_or_succession"
  | "formal_funded";

export type AssetAllocationQuality =
  | "none"
  | "cash_concentrated"
  | "basic"
  | "diversified_multi_asset"
  | "goals_based_strategic";

export type RiskAlignmentLevel =
  | "severe_mismatch"
  | "moderate_mismatch"
  | "acceptable"
  | "strong"
  | "documented_ips";

export type TaxEfficiencyLevel =
  | "none"
  | "basic_awareness"
  | "uses_deductions"
  | "structured"
  | "advanced_coordination";

export type InvestmentCostLevel =
  | "unknown"
  | "high"
  | "moderate"
  | "low"
  | "institutional";

export type PolicyDuplicationLevel =
  | "significant"
  | "moderate"
  | "minor"
  | "none";

export type InflationProtectionLevel =
  | "none"
  | "mostly_cash"
  | "some_growth"
  | "balanced"
  | "strong_linked";

export type HealthcareFundingLevel =
  | "none"
  | "basic"
  | "good_hospitalisation"
  | "reserve_included"
  | "long_term_care";

export type DrawdownStrategyLevel =
  | "none"
  | "basic_estimate"
  | "sustainable"
  | "dynamic"
  | "tax_aware_multi_bucket";

export type AssetProtectionLevel =
  | "none"
  | "basic_beneficiary"
  | "insurance_estate_coordination"
  | "trust_considered"
  | "formal_structure";

export interface FoundationInputs {
  liquidEmergencyAssets: number;
  monthlyEssentialExpenses: number;
  hospitalisationCoverage: HospitalisationCoverage;
  incomeStability: IncomeStabilityProfile;
  monthlySurplus: number;
  monthlyIncome: number;
  protectedDebtAmount: number;
  totalDebt: number;
  liquidityPosition: LiquidityPosition;
}

export interface ProtectInputs {
  outstandingDebt: number;
  dependantsAnnualExpense: number;
  yearsOfSupportRequired: number;
  educationFundingNeeds: number;
  finalExpenses: number;
  existingLiquidAssets: number;
  existingLifeCoverage: number;
  annualIncome: number;
  existingCICoverage: number;
  monthlyIncome: number;
  monthlyDisabilityIncomeBenefit: number;
  availableFamilyContinuationCapital: number;
  annualFamilyExpenses: number;
  estimatedEstateCosts: number;
  taxesOrFees: number;
  outstandingLiabilities: number;
  immediateFamilyLiquidityNeeds: number;
  availableEstateLiquidity: number;
  isBusinessOwner: boolean;
  businessContinuityStatus?: BusinessContinuityStatus;
  hasDependants: boolean;
  estateLiquidityAdequate?: boolean;
}

export interface GrowInputs {
  savingsRate: number;
  monthlyInvestmentContribution: number;
  monthlyIncome: number;
  assetAllocationQuality: AssetAllocationQuality;
  assetClassDiversification: number;
  geographicDiversification: number;
  sectorDiversification: number;
  projectedRetirementAssets: number;
  requiredRetirementAssets: number;
  riskAlignment: RiskAlignmentLevel;
}

export interface OptimiseInputs {
  highInterestDebtRatio: number;
  totalDebt: number;
  taxEfficiency: TaxEfficiencyLevel;
  annualInsurancePremiums: number;
  annualIncome: number;
  hasProtectionGaps: boolean;
  cashAssets: number;
  targetLiquidityReserve: number;
  totalInvestableAssets: number;
  investmentCostLevel: InvestmentCostLevel;
  policyDuplication: PolicyDuplicationLevel;
}

export interface TransitionInputs {
  marriageReadiness?: number;
  childrenPlanning?: number;
  propertyReadiness?: number;
  parentCareReadiness?: number;
  careerChangeReadiness?: number;
  businessExitReadiness?: number;
  retirementTransition?: number;
  applicable?: {
    marriage?: boolean;
    children?: boolean;
    property?: boolean;
    parentCare?: boolean;
    careerChange?: boolean;
    businessExit?: boolean;
    retirement?: boolean;
  };
}

export interface PreserveInputs {
  projectedRetirementIncome: number;
  requiredRetirementIncome: number;
  inflationProtection: InflationProtectionLevel;
  healthcareFunding: HealthcareFundingLevel;
  projectedAssetsLastUntilAge: number;
  targetPlanningAge?: number;
  drawdownStrategy: DrawdownStrategyLevel;
  assetProtection: AssetProtectionLevel;
}

export interface LegacyInputs {
  willScore: number;
  cpfNominationScore: number;
  insuranceNominationScore: number;
  beneficiaryClarityScore: number;
  trustPlanningScore: number;
  businessSuccessionScore?: number;
  familyGovernanceScore: number;
  estateLiquidityScore: number;
  businessSuccessionApplicable?: boolean;
}

export interface ResilienceInputs {
  liquidityScore: number;
  incomeDiversityScore: number;
  assetDiversityScore: number;
  emergencyFundingScore: number;
  insuranceAdequacyScore: number;
  debtBurdenScore: number;
}

export interface BehaviourInputs {
  spendingDiscipline: number;
  investmentDiscipline: number;
  goalConsistency: number;
  emergencyPreparedness: number;
  emotionalDecisionMaking: number;
  financialConfidence: number;
}

export interface GovernanceInputs {
  familyMeetings: number;
  successorReadiness: number;
  financialEducation: number;
  decisionMakingStructure: number;
  familyConstitution: number;
  governancePractices: number;
}

export interface ContinuityInputs {
  legacyPlanning: number;
  successionPlanning: number;
  familyGovernance: number;
  trustStructures: number;
  estateLiquidity: number;
  educationLegacy: number;
}

export interface MitigationInputs {
  emergencyFundMonths: number;
  ciCoverageMultipleOfIncome: number;
  hasDisabilityIncomeCoverage: boolean;
  hasValidWill: boolean;
  hasDiversifiedPortfolio: boolean;
  hasHealthcareFundingReserve: boolean;
  hasBusinessSuccessionPlan: boolean;
  hasEstateLiquidityPlan: boolean;
}

export interface ClientFinancialProfile {
  foundation: FoundationInputs;
  protect: ProtectInputs;
  grow: GrowInputs;
  optimise: OptimiseInputs;
  transition: TransitionInputs;
  preserve: PreserveInputs;
  legacy: LegacyInputs;
  discover?: DiscoverCompleteness;
  resilience?: ResilienceInputs;
  behaviour?: BehaviourInputs;
  governance?: GovernanceInputs;
  continuity?: ContinuityInputs;
  mitigation?: MitigationInputs;
  profile?: ClientProfile;
}
