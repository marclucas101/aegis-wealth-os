import {
  buildCategoryAnalyses,
  calculateAnnualExpense,
  calculateExpenseToIncomeRatio,
  calculateOptimisationOpportunity,
  calculateSavingsRate,
  calculateTotalMonthlyExpense,
  classifySpendingLoad,
} from "./calculations";
import {
  enrichCategoryRecommendations,
  generateOverallSummary,
  generatePriorityActions,
} from "./recommendations";
import type { BudgetAnalysisResult, ClientBudgetProfile } from "./types";

export function analyzeBudget(profile: ClientBudgetProfile): BudgetAnalysisResult {
  const totalMonthlyExpense = calculateTotalMonthlyExpense(profile.entries);
  const annualExpense = calculateAnnualExpense(totalMonthlyExpense);

  const baseAnalyses = buildCategoryAnalyses(profile);
  const categoryAnalyses = enrichCategoryRecommendations(
    baseAnalyses,
    profile.archetype
  );

  const overspendingCategories = categoryAnalyses.filter(
    (analysis) => analysis.status === "overspending"
  );
  const watchCategories = categoryAnalyses.filter(
    (analysis) => analysis.status === "watch"
  );

  const topSpendingCategories = [...categoryAnalyses]
    .filter((analysis) => analysis.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  const monthlyOptimisationOpportunity =
    calculateOptimisationOpportunity(categoryAnalyses);
  const allocationDriftCount =
    overspendingCategories.length + watchCategories.length;

  let expenseToIncomeRatio: number | undefined;
  let savingsRate: number | undefined;
  let spendingLoad: "light" | "moderate" | "elevated" | undefined;
  let savingsCapacity: number | undefined;

  if (profile.monthlyIncome !== undefined && profile.monthlyIncome > 0) {
    expenseToIncomeRatio = calculateExpenseToIncomeRatio(
      totalMonthlyExpense,
      profile.monthlyIncome
    );
    savingsRate = calculateSavingsRate(totalMonthlyExpense, profile.monthlyIncome);
    spendingLoad = classifySpendingLoad(expenseToIncomeRatio);
    savingsCapacity = profile.monthlyIncome - totalMonthlyExpense;
  }

  const suggestedPriorityActions = generatePriorityActions(categoryAnalyses);

  const overallSummary = generateOverallSummary({
    totalMonthlyExpense,
    monthlyIncome: profile.monthlyIncome,
    overspendingCount: overspendingCategories.length,
    watchCount: watchCategories.length,
    optimisationOpportunity: monthlyOptimisationOpportunity,
    spendingLoad,
  });

  return {
    profile,
    totalMonthlyExpense,
    annualExpense,
    categoryAnalyses,
    topSpendingCategories,
    overspendingCategories,
    watchCategories,
    monthlyOptimisationOpportunity,
    allocationDriftCount,
    suggestedPriorityActions,
    expenseToIncomeRatio,
    savingsRate,
    spendingLoad,
    savingsCapacity,
    overallSummary,
  };
}
