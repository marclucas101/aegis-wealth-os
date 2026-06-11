import { BUDGET_CATEGORY_LABELS } from "./categories";
import { getBenchmarksForArchetype } from "./budgetBenchmarks";
import type {
  BudgetBenchmark,
  BudgetCategory,
  BudgetCategoryAnalysis,
  BudgetEntry,
  ClientBudgetProfile,
  SpendingStatus,
} from "./types";

const WATCH_MULTIPLIER = 1.15;

export function calculateTotalMonthlyExpense(entries: BudgetEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.amount), 0);
}

export function calculateAnnualExpense(monthlyTotal: number): number {
  return monthlyTotal * 12;
}

export function calculateCategoryPercentage(
  amount: number,
  totalMonthlyExpense: number
): number {
  if (totalMonthlyExpense <= 0) {
    return 0;
  }
  return (amount / totalMonthlyExpense) * 100;
}

export function classifySpendingStatus(
  amount: number,
  benchmark: BudgetBenchmark
): SpendingStatus {
  if (!benchmark.applicable) {
    return amount > 0 ? "watch" : "not_applicable";
  }

  if (amount <= 0) {
    return benchmark.min > 0 ? "below_range" : "within_range";
  }

  if (amount < benchmark.min) {
    return "below_range";
  }

  if (amount <= benchmark.max) {
    return "within_range";
  }

  if (amount <= benchmark.max * WATCH_MULTIPLIER) {
    return "watch";
  }

  return "overspending";
}

export function compareAgainstBenchmark(
  amount: number,
  benchmark: BudgetBenchmark
): {
  status: SpendingStatus;
  amountAboveMax: number;
} {
  const status = classifySpendingStatus(amount, benchmark);
  const amountAboveMax =
    benchmark.applicable && amount > benchmark.max ? amount - benchmark.max : 0;

  return { status, amountAboveMax };
}

export function calculateExpenseToIncomeRatio(
  totalMonthlyExpense: number,
  monthlyIncome: number
): number {
  if (monthlyIncome <= 0) {
    return 0;
  }
  return totalMonthlyExpense / monthlyIncome;
}

export function calculateSavingsRate(
  totalMonthlyExpense: number,
  monthlyIncome: number
): number {
  if (monthlyIncome <= 0) {
    return 0;
  }
  return (monthlyIncome - totalMonthlyExpense) / monthlyIncome;
}

export function classifySpendingLoad(
  expenseToIncomeRatio: number
): "light" | "moderate" | "elevated" {
  if (expenseToIncomeRatio < 0.5) {
    return "light";
  }
  if (expenseToIncomeRatio <= 0.7) {
    return "moderate";
  }
  return "elevated";
}

export function calculateOptimisationOpportunity(
  analyses: BudgetCategoryAnalysis[]
): number {
  return analyses.reduce((sum, analysis) => {
    if (
      analysis.status !== "watch" &&
      analysis.status !== "overspending"
    ) {
      return sum;
    }
    return sum + analysis.amountAboveMax;
  }, 0);
}

export function buildCategoryAnalyses(
  profile: ClientBudgetProfile
): BudgetCategoryAnalysis[] {
  const benchmarks = getBenchmarksForArchetype(profile.archetype);
  const amountByCategory = new Map<BudgetCategory, number>();

  for (const entry of profile.entries) {
    amountByCategory.set(entry.category, Math.max(0, entry.amount));
  }

  const totalMonthlyExpense = calculateTotalMonthlyExpense(profile.entries);

  return Object.values(benchmarks).map((benchmark) => {
    const amount = amountByCategory.get(benchmark.category) ?? 0;
    const { status, amountAboveMax } = compareAgainstBenchmark(amount, benchmark);

    return {
      category: benchmark.category,
      label: BUDGET_CATEGORY_LABELS[benchmark.category],
      amount,
      percentageOfTotal: calculateCategoryPercentage(amount, totalMonthlyExpense),
      benchmark,
      status,
      amountAboveMax,
      recommendation: "",
    };
  });
}
