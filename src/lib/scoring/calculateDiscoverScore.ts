import { DISCOVER_CATEGORY_WEIGHTS } from "./constants";
import type { DiscoverCompleteness, DiscoverScoreResult } from "./types";
import { calculateDataConfidenceFactor, clamp } from "./utils";

export function calculateDiscoverScore(
  categories: DiscoverCompleteness
): DiscoverScoreResult {
  const discoverScore = clamp(
    categories.personalInfo * DISCOVER_CATEGORY_WEIGHTS.personalInfo +
      categories.familyInfo * DISCOVER_CATEGORY_WEIGHTS.familyInfo +
      categories.income * DISCOVER_CATEGORY_WEIGHTS.income +
      categories.expenses * DISCOVER_CATEGORY_WEIGHTS.expenses +
      categories.assets * DISCOVER_CATEGORY_WEIGHTS.assets +
      categories.liabilities * DISCOVER_CATEGORY_WEIGHTS.liabilities +
      categories.policies * DISCOVER_CATEGORY_WEIGHTS.policies +
      categories.investments * DISCOVER_CATEGORY_WEIGHTS.investments +
      categories.retirementGoals * DISCOVER_CATEGORY_WEIGHTS.retirementGoals +
      categories.estate * DISCOVER_CATEGORY_WEIGHTS.estate +
      categories.businessGovernance * DISCOVER_CATEGORY_WEIGHTS.businessGovernance
  );

  return {
    discoverScore,
    dataConfidenceFactor: calculateDataConfidenceFactor(discoverScore),
    categories,
  };
}
