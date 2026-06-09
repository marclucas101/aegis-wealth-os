import type {
  BenchmarkCohort,
  ShieldPillar,
  StressScenario,
  StressSeverity,
} from "./types";

export const SHIELD_PILLAR_WEIGHTS: Record<ShieldPillar, number> = {
  foundation: 0.3,
  protect: 0.15,
  grow: 0.15,
  optimise: 0.1,
  transition: 0.1,
  preserve: 0.1,
  legacy: 0.1,
};

export const FOUNDATION_SUBFACTOR_WEIGHTS = {
  emergencyFund: 0.25,
  hospitalisation: 0.2,
  incomeStability: 0.15,
  savingsBuffer: 0.15,
  debtProtection: 0.15,
  liquidityAccess: 0.1,
} as const;

export const PROTECT_SUBFACTOR_WEIGHTS = {
  lifeCoverage: 0.25,
  criticalIllness: 0.2,
  disabilityIncome: 0.2,
  familyIncomeContinuity: 0.15,
  estateLiquidity: 0.1,
  businessContinuity: 0.1,
} as const;

export const GROW_SUBFACTOR_WEIGHTS = {
  savingsRate: 0.2,
  investmentRate: 0.2,
  assetAllocation: 0.2,
  diversification: 0.15,
  retirementFunding: 0.15,
  riskAlignment: 0.1,
} as const;

export const OPTIMISE_SUBFACTOR_WEIGHTS = {
  debtCostEfficiency: 0.2,
  taxEfficiency: 0.2,
  premiumEfficiency: 0.2,
  cashDrag: 0.15,
  investmentCostEfficiency: 0.15,
  policyDuplication: 0.1,
} as const;

export const TRANSITION_SUBFACTOR_WEIGHTS = {
  marriage: 0.1,
  children: 0.15,
  property: 0.15,
  parentCare: 0.2,
  careerChange: 0.15,
  businessExit: 0.15,
  retirement: 0.1,
} as const;

export const PRESERVE_SUBFACTOR_WEIGHTS = {
  retirementSustainability: 0.25,
  inflationProtection: 0.15,
  healthcareFunding: 0.2,
  longevityBuffer: 0.15,
  drawdownStrategy: 0.15,
  assetProtection: 0.1,
} as const;

export const LEGACY_SUBFACTOR_WEIGHTS = {
  will: 0.15,
  cpfNomination: 0.1,
  insuranceNomination: 0.1,
  beneficiaryClarity: 0.1,
  trustPlanning: 0.15,
  businessSuccession: 0.15,
  familyGovernance: 0.15,
  estateLiquidity: 0.1,
} as const;

export const DISCOVER_CATEGORY_WEIGHTS = {
  personalInfo: 0.05,
  familyInfo: 0.1,
  income: 0.1,
  expenses: 0.1,
  assets: 0.1,
  liabilities: 0.1,
  policies: 0.1,
  investments: 0.1,
  retirementGoals: 0.1,
  estate: 0.1,
  businessGovernance: 0.05,
} as const;

export const AWRI_WEIGHTS = {
  adjustedShieldScore: 0.5,
  resilience: 0.2,
  behaviour: 0.1,
  governance: 0.1,
  continuity: 0.1,
} as const;

export const RESILIENCE_SUBFACTOR_WEIGHTS = {
  liquidity: 0.25,
  incomeDiversity: 0.15,
  assetDiversity: 0.15,
  emergencyFunding: 0.2,
  insuranceAdequacy: 0.15,
  debtBurden: 0.1,
} as const;

export const BEHAVIOUR_SUBFACTOR_WEIGHTS = {
  spendingDiscipline: 0.25,
  investmentDiscipline: 0.2,
  goalConsistency: 0.2,
  emergencyPreparedness: 0.15,
  emotionalDecisionMaking: 0.1,
  financialConfidence: 0.1,
} as const;

export const GOVERNANCE_SUBFACTOR_WEIGHTS = {
  familyMeetings: 0.15,
  successorReadiness: 0.2,
  financialEducation: 0.2,
  decisionMakingStructure: 0.2,
  familyConstitution: 0.15,
  governancePractices: 0.1,
} as const;

export const CONTINUITY_SUBFACTOR_WEIGHTS = {
  legacyPlanning: 0.25,
  successionPlanning: 0.2,
  familyGovernance: 0.2,
  trustStructures: 0.15,
  estateLiquidity: 0.1,
  educationLegacy: 0.1,
} as const;

export const DATA_CONFIDENCE_MIN = 0.7;
export const DATA_CONFIDENCE_MAX = 1.0;

export const TARGET_SAVINGS_RATE = 0.25;
export const TARGET_INVESTMENT_RATE = 0.2;
export const TARGET_PLANNING_AGE = 95;
export const REQUIRED_CI_INCOME_MULTIPLE = 3;
export const DISABILITY_INCOME_REPLACEMENT = 0.75;
export const FAMILY_CONTINUITY_TARGET_YEARS = 10;
export const EMERGENCY_FUND_TARGET_MONTHS = 9;
export const STRESS_PENALTY_FACTOR = 0.3;
export const MAX_MITIGATION_CREDIT = 15;

export const EXECUTIVE_INCOME_THRESHOLD = 250_000;
export const FAMILY_OFFICE_NET_WORTH_THRESHOLD = 5_000_000;

export const SEVERITY_MULTIPLIERS: Record<StressSeverity, number> = {
  mild: 0.5,
  moderate: 1.0,
  severe: 1.5,
  extreme: 2.0,
};

export const STRESS_EVENT_PILLAR_WEIGHTS: Record<
  StressScenario,
  Record<ShieldPillar, number>
> = {
  income_loss: {
    foundation: 0.35,
    protect: 0.1,
    grow: 0.2,
    optimise: 0.1,
    transition: 0.15,
    preserve: 0.1,
    legacy: 0,
  },
  critical_illness: {
    foundation: 0.2,
    protect: 0.35,
    grow: 0.05,
    optimise: 0.05,
    transition: 0.1,
    preserve: 0.15,
    legacy: 0.1,
  },
  death_event: {
    foundation: 0.1,
    protect: 0.4,
    grow: 0,
    optimise: 0.05,
    transition: 0.1,
    preserve: 0.1,
    legacy: 0.25,
  },
  disability: {
    foundation: 0.25,
    protect: 0.35,
    grow: 0.05,
    optimise: 0.05,
    transition: 0.1,
    preserve: 0.15,
    legacy: 0.05,
  },
  market_crash: {
    foundation: 0.1,
    protect: 0,
    grow: 0.45,
    optimise: 0.15,
    transition: 0.05,
    preserve: 0.25,
    legacy: 0,
  },
  inflation_shock: {
    foundation: 0.1,
    protect: 0,
    grow: 0.2,
    optimise: 0.2,
    transition: 0.05,
    preserve: 0.4,
    legacy: 0.05,
  },
  longevity: {
    foundation: 0.05,
    protect: 0,
    grow: 0.15,
    optimise: 0.1,
    transition: 0.1,
    preserve: 0.55,
    legacy: 0.05,
  },
  business_failure: {
    foundation: 0.25,
    protect: 0.15,
    grow: 0.2,
    optimise: 0.1,
    transition: 0.2,
    preserve: 0.05,
    legacy: 0.05,
  },
  parent_care: {
    foundation: 0.25,
    protect: 0.05,
    grow: 0.1,
    optimise: 0.1,
    transition: 0.35,
    preserve: 0.15,
    legacy: 0,
  },
  estate_delay: {
    foundation: 0.05,
    protect: 0.1,
    grow: 0,
    optimise: 0.05,
    transition: 0.1,
    preserve: 0.2,
    legacy: 0.5,
  },
};

export const MITIGATION_CREDITS = {
  emergencyFundSixMonths: 3,
  ciCoverageThreeTimesIncome: 4,
  disabilityIncomeCoverage: 4,
  validWill: 3,
  diversifiedPortfolio: 3,
  healthcareFundingReserve: 3,
  businessSuccessionPlan: 5,
  estateLiquidityPlan: 4,
} as const;

export const BENCHMARK_TABLE: Record<
  BenchmarkCohort,
  { average: number; top25: number; top10: number }
> = {
  "Young Professional": { average: 55, top25: 68, top10: 78 },
  "Dual-Income Couple": { average: 60, top25: 72, top10: 82 },
  "Young Family": { average: 58, top25: 70, top10: 80 },
  Executive: { average: 68, top25: 80, top10: 90 },
  "Business Owner": { average: 66, top25: 82, top10: 91 },
  "Medical Professional": { average: 70, top25: 82, top10: 92 },
  "Affluent Family": { average: 75, top25: 86, top10: 94 },
  "Pre-Retiree": { average: 70, top25: 82, top10: 90 },
  Retiree: { average: 72, top25: 84, top10: 92 },
  "Family Office Candidate": { average: 82, top25: 92, top10: 97 },
};

export const RATING_THRESHOLDS = [
  { min: 95, rating: "AAA" as const },
  { min: 85, rating: "AA" as const },
  { min: 75, rating: "A" as const },
  { min: 60, rating: "BBB" as const },
  { min: 40, rating: "BB" as const },
  { min: 0, rating: "B" as const },
];

export const ROADMAP_PRIORITY_THRESHOLDS = [
  { min: 80, priority: "critical" as const },
  { min: 60, priority: "high" as const },
  { min: 40, priority: "medium" as const },
  { min: 0, priority: "low" as const },
];

export const BENCHMARK_CLASSIFICATION_THRESHOLDS = [
  { min: 15, classification: "Leading" as const },
  { min: 5, classification: "Above Average" as const },
  { min: -4, classification: "In Line" as const },
  { min: -14, classification: "Below Average" as const },
  { min: -Infinity, classification: "Materially Behind" as const },
];
