import { ALL_BUDGET_CATEGORIES } from "./categories";
import type { BudgetArchetype, BudgetBenchmark, BudgetCategory } from "./types";

type BenchmarkInput = Partial<
  Record<BudgetCategory, { min: number; target: number; max: number; applicable?: boolean }>
>;

function na(): { min: number; target: number; max: number; applicable: false } {
  return { min: 0, target: 0, max: 0, applicable: false };
}

function b(
  min: number,
  target: number,
  max: number,
  applicable = true
): { min: number; target: number; max: number; applicable: boolean } {
  return { min, target, max, applicable };
}

function buildArchetypeBenchmarks(input: BenchmarkInput): Record<BudgetCategory, BudgetBenchmark> {
  const result = {} as Record<BudgetCategory, BudgetBenchmark>;

  for (const category of ALL_BUDGET_CATEGORIES) {
    const values = input[category] ?? na();
    result[category] = {
      category,
      min: values.min,
      target: values.target,
      max: values.max,
      applicable: values.applicable ?? true,
    };
  }

  return result;
}

/**
 * Singapore-context monthly SGD benchmarks by life-stage archetype.
 * Edit ranges here — do not scatter values across UI components.
 */
const ARCHETYPE_BENCHMARK_INPUT: Record<BudgetArchetype, BenchmarkInput> = {
  student: {
    housing_rent_mortgage: b(0, 200, 450),
    utilities: b(0, 40, 90),
    groceries: b(180, 300, 450),
    dining_out: b(80, 180, 320),
    transport: b(40, 80, 150),
    car_ownership: na(),
    insurance_premiums: b(0, 30, 80),
    healthcare: b(0, 40, 100),
    education_courses: b(50, 150, 350),
    dependents_family_support: na(),
    subscriptions: b(15, 45, 90),
    entertainment: b(60, 140, 260),
    shopping_lifestyle: b(40, 100, 220),
    travel_sinking_fund: b(0, 80, 200),
    debt_repayments: b(0, 0, 120),
    savings_investments: b(100, 250, 500),
    miscellaneous: b(30, 80, 160),
  },
  nsf_or_allowance_based: {
    housing_rent_mortgage: b(0, 100, 300),
    utilities: b(0, 30, 70),
    groceries: b(150, 260, 400),
    dining_out: b(60, 140, 280),
    transport: b(30, 70, 130),
    car_ownership: na(),
    insurance_premiums: b(0, 40, 100),
    healthcare: b(0, 50, 120),
    education_courses: b(0, 80, 200),
    dependents_family_support: b(0, 100, 300),
    subscriptions: b(15, 40, 85),
    entertainment: b(50, 120, 240),
    shopping_lifestyle: b(40, 90, 200),
    travel_sinking_fund: b(0, 60, 180),
    debt_repayments: b(0, 0, 100),
    savings_investments: b(150, 350, 700),
    miscellaneous: b(30, 70, 150),
  },
  young_working_adult_no_car: {
    housing_rent_mortgage: b(600, 1200, 2200),
    utilities: b(80, 140, 220),
    groceries: b(250, 400, 650),
    dining_out: b(150, 300, 550),
    transport: b(80, 150, 250),
    car_ownership: na(),
    insurance_premiums: b(80, 180, 350),
    healthcare: b(40, 100, 220),
    education_courses: b(0, 150, 400),
    dependents_family_support: b(0, 150, 500),
    subscriptions: b(30, 70, 140),
    entertainment: b(100, 220, 450),
    shopping_lifestyle: b(80, 180, 400),
    travel_sinking_fund: b(100, 250, 600),
    debt_repayments: b(0, 200, 600),
    savings_investments: b(400, 900, 1800),
    miscellaneous: b(50, 120, 250),
  },
  working_adult_public_transport: {
    housing_rent_mortgage: b(700, 1400, 2600),
    utilities: b(90, 160, 250),
    groceries: b(280, 450, 700),
    dining_out: b(180, 350, 600),
    transport: b(100, 180, 280),
    car_ownership: na(),
    insurance_premiums: b(120, 250, 450),
    healthcare: b(50, 120, 250),
    education_courses: b(0, 200, 500),
    dependents_family_support: b(0, 200, 600),
    subscriptions: b(40, 90, 160),
    entertainment: b(120, 250, 500),
    shopping_lifestyle: b(100, 220, 450),
    travel_sinking_fund: b(150, 350, 800),
    debt_repayments: b(0, 300, 800),
    savings_investments: b(600, 1200, 2500),
    miscellaneous: b(60, 140, 280),
  },
  working_adult_with_car: {
    housing_rent_mortgage: b(800, 1500, 2800),
    utilities: b(100, 170, 260),
    groceries: b(300, 480, 750),
    dining_out: b(200, 380, 650),
    transport: b(150, 220, 350),
    car_ownership: b(500, 750, 1100),
    insurance_premiums: b(150, 300, 550),
    healthcare: b(60, 140, 280),
    education_courses: b(0, 200, 500),
    dependents_family_support: b(0, 200, 600),
    subscriptions: b(40, 95, 170),
    entertainment: b(140, 280, 550),
    shopping_lifestyle: b(120, 250, 500),
    travel_sinking_fund: b(150, 400, 900),
    debt_repayments: b(0, 350, 900),
    savings_investments: b(700, 1400, 2800),
    miscellaneous: b(70, 150, 300),
  },
  married_couple_no_children: {
    housing_rent_mortgage: b(1200, 2200, 3800),
    utilities: b(140, 220, 340),
    groceries: b(450, 700, 1100),
    dining_out: b(300, 550, 900),
    transport: b(180, 320, 500),
    car_ownership: b(0, 500, 1000),
    insurance_premiums: b(250, 500, 900),
    healthcare: b(100, 220, 400),
    education_courses: b(0, 250, 600),
    dependents_family_support: b(0, 300, 800),
    subscriptions: b(60, 120, 220),
    entertainment: b(200, 400, 750),
    shopping_lifestyle: b(180, 350, 650),
    travel_sinking_fund: b(250, 550, 1200),
    debt_repayments: b(0, 400, 1000),
    savings_investments: b(1000, 2000, 4000),
    miscellaneous: b(100, 200, 400),
  },
  young_family: {
    housing_rent_mortgage: b(1500, 2600, 4200),
    utilities: b(160, 260, 400),
    groceries: b(600, 900, 1400),
    dining_out: b(250, 450, 750),
    transport: b(200, 380, 600),
    car_ownership: b(400, 700, 1100),
    insurance_premiums: b(350, 650, 1100),
    healthcare: b(120, 250, 450),
    education_courses: b(100, 350, 800),
    dependents_family_support: b(200, 500, 1200),
    subscriptions: b(60, 130, 240),
    entertainment: b(150, 300, 550),
    shopping_lifestyle: b(150, 300, 550),
    travel_sinking_fund: b(200, 450, 1000),
    debt_repayments: b(0, 500, 1200),
    savings_investments: b(800, 1600, 3200),
    miscellaneous: b(100, 220, 400),
  },
  homeowner_with_mortgage: {
    housing_rent_mortgage: b(2000, 3200, 5000),
    utilities: b(180, 280, 420),
    groceries: b(500, 800, 1200),
    dining_out: b(280, 500, 850),
    transport: b(200, 380, 600),
    car_ownership: b(0, 650, 1150),
    insurance_premiums: b(300, 600, 1000),
    healthcare: b(120, 260, 450),
    education_courses: b(0, 300, 700),
    dependents_family_support: b(0, 400, 1000),
    subscriptions: b(70, 140, 250),
    entertainment: b(180, 350, 650),
    shopping_lifestyle: b(160, 320, 580),
    travel_sinking_fund: b(250, 550, 1200),
    debt_repayments: b(200, 600, 1400),
    savings_investments: b(1200, 2200, 4500),
    miscellaneous: b(100, 220, 400),
  },
  pre_retiree: {
    housing_rent_mortgage: b(1200, 2200, 3800),
    utilities: b(150, 240, 360),
    groceries: b(450, 700, 1050),
    dining_out: b(250, 450, 750),
    transport: b(150, 280, 450),
    car_ownership: b(0, 500, 950),
    insurance_premiums: b(350, 650, 1100),
    healthcare: b(200, 400, 700),
    education_courses: b(0, 150, 400),
    dependents_family_support: b(0, 300, 900),
    subscriptions: b(50, 110, 200),
    entertainment: b(200, 380, 650),
    shopping_lifestyle: b(150, 300, 550),
    travel_sinking_fund: b(300, 650, 1400),
    debt_repayments: b(0, 300, 800),
    savings_investments: b(1500, 3000, 6000),
    miscellaneous: b(100, 200, 380),
  },
  retiree: {
    housing_rent_mortgage: b(0, 1200, 2800),
    utilities: b(120, 200, 320),
    groceries: b(350, 550, 850),
    dining_out: b(180, 320, 550),
    transport: b(60, 140, 260),
    car_ownership: b(0, 300, 700),
    insurance_premiums: b(250, 500, 900),
    healthcare: b(250, 450, 800),
    education_courses: b(0, 80, 250),
    dependents_family_support: b(0, 200, 600),
    subscriptions: b(40, 90, 170),
    entertainment: b(150, 280, 500),
    shopping_lifestyle: b(100, 220, 400),
    travel_sinking_fund: b(200, 500, 1100),
    debt_repayments: b(0, 150, 500),
    savings_investments: b(0, 500, 2000),
    miscellaneous: b(80, 180, 320),
  },
};

export const ARCHETYPE_BENCHMARKS: Record<
  BudgetArchetype,
  Record<BudgetCategory, BudgetBenchmark>
> = Object.fromEntries(
  (Object.keys(ARCHETYPE_BENCHMARK_INPUT) as BudgetArchetype[]).map((archetype) => [
    archetype,
    buildArchetypeBenchmarks(ARCHETYPE_BENCHMARK_INPUT[archetype]),
  ])
) as Record<BudgetArchetype, Record<BudgetCategory, BudgetBenchmark>>;

export const BUDGET_ARCHETYPE_LIST: Array<{
  id: BudgetArchetype;
  label: string;
  description: string;
}> = [
  {
    id: "student",
    label: "Student",
    description: "Full-time study, limited income, public transport",
  },
  {
    id: "nsf_or_allowance_based",
    label: "NSF / Allowance-Based",
    description: "Structured allowance with disciplined savings potential",
  },
  {
    id: "young_working_adult_no_car",
    label: "Young Working Adult (No Car)",
    description: "Early career, renting, building reserves",
  },
  {
    id: "working_adult_public_transport",
    label: "Working Adult (Public Transport)",
    description: "Stable employment, commute-focused mobility",
  },
  {
    id: "working_adult_with_car",
    label: "Working Adult (With Car)",
    description: "Car ownership and higher mobility costs",
  },
  {
    id: "married_couple_no_children",
    label: "Married Couple (No Children)",
    description: "Dual income, household coordination",
  },
  {
    id: "young_family",
    label: "Young Family",
    description: "Dependants, childcare, higher household load",
  },
  {
    id: "homeowner_with_mortgage",
    label: "Homeowner (With Mortgage)",
    description: "Property commitment and servicing focus",
  },
  {
    id: "pre_retiree",
    label: "Pre-Retiree",
    description: "Peak earning years, transition planning",
  },
  {
    id: "retiree",
    label: "Retiree",
    description: "Lower work expenses, higher healthcare weighting",
  },
];

export function getBenchmarksForArchetype(
  archetype: BudgetArchetype
): Record<BudgetCategory, BudgetBenchmark> {
  return ARCHETYPE_BENCHMARKS[archetype];
}
