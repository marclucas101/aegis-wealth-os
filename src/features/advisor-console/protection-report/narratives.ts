import type { ProtectionReportInput } from "./types";

export function generateCoverIntro(
  policyCount: number,
  insuredPersonCount: number
): string {
  const policyPhrase =
    policyCount === 1 ? "one policy in force" : `${policyCount} policies in force`;
  const peoplePhrase =
    insuredPersonCount === 1
      ? "one insured person"
      : `${insuredPersonCount} insured persons`;

  return `An overview of every policy in force across ${peoplePhrase}, the coverage they provide, and how the portfolio is positioned today — ${policyPhrase} in total.`;
}

export function generatePeopleSectionIntro(insuredPersonCount: number): string {
  if (insuredPersonCount === 1) {
    return "Everyone covered in this portfolio.";
  }
  return `Everyone covered in this portfolio — ${insuredPersonCount} insured persons in total.`;
}

export function generatePeopleSectionQuote(): string {
  return "Protection isn't paperwork. It's the assurance that each person here is looked after — even if life takes a turn.";
}

export function generatePortfolioSectionIntro(policyCount: number): string {
  if (policyCount === 1) {
    return "Every policy, sized by coverage.";
  }
  return `Every policy in the household portfolio — ${policyCount} in total, sized by coverage.`;
}

export function generateFinalReviewGuidance(householdName: string): string {
  return `Reviews keep the ${householdName} protection portfolio in step with life. The following cadence is a practical reference — not a regulated recommendation.`;
}

export function generateAdviserClosing(adviserName: string): string {
  return `Thank you for entrusting this portfolio summary to ${adviserName}.`;
}

export function buildProtectionNarratives(input: ProtectionReportInput) {
  const { household, insuredPersons, policies } = input;

  return {
    coverIntro: generateCoverIntro(policies.length, insuredPersons.length),
    peopleIntro: generatePeopleSectionIntro(insuredPersons.length),
    peopleQuote: generatePeopleSectionQuote(),
    portfolioIntro: generatePortfolioSectionIntro(policies.length),
    finalGuidance: generateFinalReviewGuidance(household.householdName),
    adviserClosing: generateAdviserClosing(household.adviserName),
  };
}
