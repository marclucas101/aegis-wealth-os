import type { DiscoverStep } from "@/components/aegis/discover/DiscoverProgress";
import type { DiscoverCompleteness } from "@/src/lib/scoring/types";

/** Macro sections for the Phase 9B prospect information-collection journey. */
export type ProspectProfileSectionId =
  | "about_you"
  | "financial_foundation"
  | "current_arrangements"
  | "priorities"
  | "review_submit";

export type ProspectProfileSection = {
  id: ProspectProfileSectionId;
  title: string;
  shortLabel: string;
  description: string;
  stepIndices: number[];
  completenessKeys: (keyof DiscoverCompleteness)[];
};

export const PROSPECT_PROFILE_SECTIONS: ProspectProfileSection[] = [
  {
    id: "about_you",
    title: "About you",
    shortLabel: "About you",
    description:
      "Personal details, employment, household, dependants, and broad income.",
    stepIndices: [0, 1, 2],
    completenessKeys: ["personalInfo", "familyInfo", "income"],
  },
  {
    id: "financial_foundation",
    title: "Your financial foundation",
    shortLabel: "Foundation",
    description:
      "Cash and savings, monthly commitments, debts, and emergency reserves.",
    stepIndices: [3, 4, 5],
    completenessKeys: ["expenses", "assets", "liabilities"],
  },
  {
    id: "current_arrangements",
    title: "Your current arrangements",
    shortLabel: "Arrangements",
    description:
      "Insurance categories, investments, retirement arrangements, and major assets.",
    stepIndices: [6, 7, 8, 9],
    completenessKeys: ["policies", "investments", "retirementGoals", "estate"],
  },
  {
    id: "priorities",
    title: "Your priorities",
    shortLabel: "Priorities",
    description:
      "What matters most for your family, home, education, retirement, and wealth goals.",
    stepIndices: [10],
    completenessKeys: ["businessGovernance"],
  },
  {
    id: "review_submit",
    title: "Review and submit",
    shortLabel: "Review",
    description:
      "Check your information, acknowledge privacy terms, and submit for adviser review.",
    stepIndices: [],
    completenessKeys: [],
  },
];

export const DISCOVER_WIZARD_STEPS: DiscoverStep[] = [
  { id: "personal", title: "Personal details", shortLabel: "Personal" },
  { id: "family", title: "Household & dependants", shortLabel: "Household" },
  { id: "income", title: "Income overview", shortLabel: "Income" },
  { id: "expenses", title: "Monthly commitments", shortLabel: "Commitments" },
  { id: "assets", title: "Cash & savings", shortLabel: "Savings" },
  { id: "liabilities", title: "Debts & liabilities", shortLabel: "Debts" },
  { id: "policies", title: "Insurance arrangements", shortLabel: "Insurance" },
  { id: "investments", title: "Investments", shortLabel: "Invest" },
  { id: "retirement", title: "Retirement arrangements", shortLabel: "Retire" },
  { id: "estate", title: "Estate & nominations", shortLabel: "Estate" },
  { id: "business", title: "Goals & priorities", shortLabel: "Goals" },
];

export function sectionCompletenessPercent(
  section: ProspectProfileSection,
  completeness: DiscoverCompleteness,
): number {
  if (section.completenessKeys.length === 0) {
    return 0;
  }
  const total = section.completenessKeys.reduce(
    (sum, key) => sum + (completeness[key] ?? 0),
    0,
  );
  return total / section.completenessKeys.length;
}

export function overallProfileCompleteness(
  completeness: DiscoverCompleteness,
): number {
  const keys = PROSPECT_PROFILE_SECTIONS.flatMap((s) => s.completenessKeys);
  if (keys.length === 0) {
    return 0;
  }
  const total = keys.reduce((sum, key) => sum + (completeness[key] ?? 0), 0);
  return total / keys.length;
}

export function resolveCurrentSectionIndex(stepIndex: number): number {
  const idx = PROSPECT_PROFILE_SECTIONS.findIndex((section) =>
    section.stepIndices.includes(stepIndex),
  );
  return idx >= 0 ? idx : 0;
}
