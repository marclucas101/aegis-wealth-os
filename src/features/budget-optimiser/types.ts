export type BudgetCategory =
  | "housing_rent_mortgage"
  | "utilities"
  | "groceries"
  | "dining_out"
  | "transport"
  | "car_ownership"
  | "insurance_premiums"
  | "healthcare"
  | "education_courses"
  | "dependents_family_support"
  | "subscriptions"
  | "entertainment"
  | "shopping_lifestyle"
  | "travel_sinking_fund"
  | "debt_repayments"
  | "savings_investments"
  | "miscellaneous";

export type BudgetArchetype =
  | "student"
  | "nsf_or_allowance_based"
  | "young_working_adult_no_car"
  | "working_adult_public_transport"
  | "working_adult_with_car"
  | "married_couple_no_children"
  | "young_family"
  | "homeowner_with_mortgage"
  | "pre_retiree"
  | "retiree";

export type SpendingStatus =
  | "below_range"
  | "within_range"
  | "watch"
  | "overspending"
  | "not_applicable";

export type SpendingLoad = "light" | "moderate" | "elevated";

export interface BudgetEntry {
  category: BudgetCategory;
  amount: number;
}

export interface ClientBudgetProfile {
  archetype: BudgetArchetype;
  age?: number;
  monthlyIncome?: number;
  entries: BudgetEntry[];
}

export interface BudgetBenchmark {
  category: BudgetCategory;
  min: number;
  target: number;
  max: number;
  applicable: boolean;
}

export interface BudgetCategoryAnalysis {
  category: BudgetCategory;
  label: string;
  amount: number;
  percentageOfTotal: number;
  benchmark: BudgetBenchmark | null;
  status: SpendingStatus;
  amountAboveMax: number;
  recommendation: string;
}

export interface BudgetAnalysisResult {
  profile: ClientBudgetProfile;
  totalMonthlyExpense: number;
  annualExpense: number;
  categoryAnalyses: BudgetCategoryAnalysis[];
  topSpendingCategories: BudgetCategoryAnalysis[];
  overspendingCategories: BudgetCategoryAnalysis[];
  watchCategories: BudgetCategoryAnalysis[];
  monthlyOptimisationOpportunity: number;
  allocationDriftCount: number;
  suggestedPriorityActions: string[];
  expenseToIncomeRatio?: number;
  savingsRate?: number;
  spendingLoad?: SpendingLoad;
  savingsCapacity?: number;
  overallSummary: string;
}
