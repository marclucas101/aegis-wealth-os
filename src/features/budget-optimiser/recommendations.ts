import type { BudgetArchetype, BudgetCategoryAnalysis, SpendingStatus } from "./types";

function formatSgd(amount: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function recommendationForStatus(
  analysis: BudgetCategoryAnalysis,
  archetype: BudgetArchetype
): string {
  const { label, amount, benchmark, status, amountAboveMax } = analysis;

  if (!benchmark) {
    return `${label} has no benchmark reference for this view.`;
  }

  switch (status as SpendingStatus) {
    case "not_applicable":
      return `${label} is typically not a core allocation category for your selected life-stage profile. No action is required unless circumstances have changed.`;

    case "below_range":
      if (benchmark.category === "savings_investments") {
        return `${label} is below the reference range for your profile. If capacity allows, a gradual increase toward ${formatSgd(benchmark.target)} per month may strengthen capital allocation discipline.`;
      }
      return `${label} sits below the typical range for your profile. This may reflect efficiency — review only if essential needs are fully covered.`;

    case "within_range":
      return `${label} is within the reference range for a ${archetype.replace(/_/g, " ")} profile. This allocation appears disciplined relative to the benchmark.`;

    case "watch":
      return `${label} is slightly above the upper reference range (${formatSgd(benchmark.max)}). A calm review of recurring items — without immediate cuts — may clarify whether this reflects preference or drift.`;

    case "overspending":
      return `${label} is approximately ${formatSgd(amountAboveMax)} above the upper reference range for your profile. Consider reviewing subscriptions, frequency, or alternatives over the next planning cycle. Current allocation: ${formatSgd(amount)}.`;

    default:
      return `${label} has been assessed against your life-stage benchmark.`;
  }
}

export function enrichCategoryRecommendations(
  analyses: BudgetCategoryAnalysis[],
  archetype: BudgetArchetype
): BudgetCategoryAnalysis[] {
  return analyses.map((analysis) => ({
    ...analysis,
    recommendation: recommendationForStatus(analysis, archetype),
  }));
}

export function generatePriorityActions(
  analyses: BudgetCategoryAnalysis[]
): string[] {
  const driftCategories = analyses
    .filter(
      (analysis) =>
        analysis.status === "overspending" || analysis.status === "watch"
    )
    .sort((a, b) => b.amountAboveMax - a.amountAboveMax);

  if (driftCategories.length === 0) {
    return [
      "Maintain your current allocation rhythm and revisit after the next income or life-stage change.",
      "Confirm that savings and investment contributions remain intentional rather than residual.",
    ];
  }

  const actions = driftCategories.slice(0, 3).map((analysis) => {
    if (analysis.status === "overspending") {
      return `Review ${analysis.label.toLowerCase()} — currently ${formatSgd(analysis.amountAboveMax)} above the upper benchmark.`;
    }
    return `Monitor ${analysis.label.toLowerCase()} — modestly above benchmark; a light review may be sufficient.`;
  });

  if (driftCategories.length > 3) {
    actions.push(
      `Additional categories showing allocation drift: ${driftCategories
        .slice(3, 6)
        .map((item) => item.label)
        .join(", ")}.`
    );
  }

  return actions;
}

export function generateOverallSummary(params: {
  totalMonthlyExpense: number;
  monthlyIncome?: number;
  overspendingCount: number;
  watchCount: number;
  optimisationOpportunity: number;
  spendingLoad?: "light" | "moderate" | "elevated";
}): string {
  const parts: string[] = [];

  parts.push(
    `Total monthly outflow is ${formatSgd(params.totalMonthlyExpense)} against your selected life-stage benchmarks.`
  );

  if (params.monthlyIncome !== undefined && params.monthlyIncome > 0) {
    parts.push(
      `Relative to declared income, spending load is ${params.spendingLoad ?? "unclassified"}.`
    );
  }

  if (params.overspendingCount === 0 && params.watchCount === 0) {
    parts.push(
      "No material allocation drift detected. Capital allocation appears broadly aligned with reference ranges."
    );
  } else {
    parts.push(
      `${params.overspendingCount} categor${params.overspendingCount === 1 ? "y" : "ies"} show elevated drift and ${params.watchCount} are on watch.`
    );
    if (params.optimisationOpportunity > 0) {
      parts.push(
        `Estimated monthly optimisation opportunity: ${formatSgd(params.optimisationOpportunity)} if upper-range alignment is pursued gradually.`
      );
    }
  }

  return parts.join(" ");
}
