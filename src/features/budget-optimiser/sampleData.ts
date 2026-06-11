import { ALL_BUDGET_CATEGORIES } from "./categories";
import type { BudgetOptimiserDraft } from "./formState";

function amountsFromRecord(
  record: Partial<Record<(typeof ALL_BUDGET_CATEGORIES)[number], number>>
): Record<(typeof ALL_BUDGET_CATEGORIES)[number], string> {
  const result = {} as Record<(typeof ALL_BUDGET_CATEGORIES)[number], string>;
  for (const category of ALL_BUDGET_CATEGORIES) {
    result[category] = record[category] !== undefined ? String(record[category]) : "";
  }
  return result;
}

/** Fictional student profile with elevated transport for benchmark testing. */
export const sampleStudentDraft: BudgetOptimiserDraft = {
  archetype: "student",
  age: "21",
  monthlyIncome: "900",
  amounts: amountsFromRecord({
    housing_rent_mortgage: 350,
    utilities: 50,
    groceries: 320,
    dining_out: 280,
    transport: 300,
    insurance_premiums: 40,
    healthcare: 60,
    education_courses: 120,
    subscriptions: 55,
    entertainment: 180,
    shopping_lifestyle: 150,
    travel_sinking_fund: 80,
    savings_investments: 200,
    miscellaneous: 70,
  }),
};

/** Working adult with car — $300 transport is within benchmark range. */
export const sampleWorkingAdultWithCarDraft: BudgetOptimiserDraft = {
  archetype: "working_adult_with_car",
  age: "34",
  monthlyIncome: "8500",
  amounts: amountsFromRecord({
    housing_rent_mortgage: 1800,
    utilities: 160,
    groceries: 520,
    dining_out: 420,
    transport: 300,
    car_ownership: 780,
    insurance_premiums: 320,
    healthcare: 120,
    subscriptions: 95,
    entertainment: 280,
    shopping_lifestyle: 260,
    travel_sinking_fund: 400,
    debt_repayments: 350,
    savings_investments: 1500,
    miscellaneous: 140,
  }),
};

export const sampleYoungFamilyDraft: BudgetOptimiserDraft = {
  archetype: "young_family",
  age: "38",
  monthlyIncome: "12000",
  amounts: amountsFromRecord({
    housing_rent_mortgage: 2800,
    utilities: 240,
    groceries: 950,
    dining_out: 480,
    transport: 380,
    car_ownership: 720,
    insurance_premiums: 780,
    healthcare: 220,
    education_courses: 400,
    dependents_family_support: 600,
    subscriptions: 130,
    entertainment: 260,
    shopping_lifestyle: 320,
    travel_sinking_fund: 350,
    debt_repayments: 450,
    savings_investments: 1800,
    miscellaneous: 180,
  }),
};
