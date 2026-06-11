import type { BudgetCategory } from "./types";

export interface BudgetCategoryMeta {
  id: BudgetCategory;
  label: string;
  shortLabel: string;
  description: string;
}

export const BUDGET_CATEGORY_LIST: BudgetCategoryMeta[] = [
  {
    id: "housing_rent_mortgage",
    label: "Housing / Rent / Mortgage",
    shortLabel: "Housing",
    description: "Rent, mortgage instalments, or household accommodation",
  },
  {
    id: "utilities",
    label: "Utilities",
    shortLabel: "Utilities",
    description: "Electricity, water, gas, internet, mobile",
  },
  {
    id: "groceries",
    label: "Groceries",
    shortLabel: "Groceries",
    description: "Supermarket and household food essentials",
  },
  {
    id: "dining_out",
    label: "Dining Out",
    shortLabel: "Dining",
    description: "Restaurants, cafés, food delivery",
  },
  {
    id: "transport",
    label: "Transport",
    shortLabel: "Transport",
    description: "Public transport, ride-hailing, petrol (non-car-owner)",
  },
  {
    id: "car_ownership",
    label: "Car Ownership",
    shortLabel: "Car",
    description: "Car loan, insurance, parking, maintenance, petrol",
  },
  {
    id: "insurance_premiums",
    label: "Insurance Premiums",
    shortLabel: "Insurance",
    description: "Life, health, and general insurance premiums",
  },
  {
    id: "healthcare",
    label: "Healthcare",
    shortLabel: "Healthcare",
    description: "Medical, dental, and wellness out-of-pocket",
  },
  {
    id: "education_courses",
    label: "Education / Courses",
    shortLabel: "Education",
    description: "Tuition, upskilling, professional courses",
  },
  {
    id: "dependents_family_support",
    label: "Dependents / Family Support",
    shortLabel: "Dependents",
    description: "Allowances, childcare, elder support",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    shortLabel: "Subscriptions",
    description: "Streaming, software, memberships",
  },
  {
    id: "entertainment",
    label: "Entertainment",
    shortLabel: "Entertainment",
    description: "Leisure, hobbies, events",
  },
  {
    id: "shopping_lifestyle",
    label: "Shopping / Lifestyle",
    shortLabel: "Lifestyle",
    description: "Clothing, personal care, discretionary purchases",
  },
  {
    id: "travel_sinking_fund",
    label: "Travel / Sinking Fund",
    shortLabel: "Travel",
    description: "Holidays and planned sinking funds",
  },
  {
    id: "debt_repayments",
    label: "Debt Repayments",
    shortLabel: "Debt",
    description: "Non-mortgage debt servicing",
  },
  {
    id: "savings_investments",
    label: "Savings / Investments",
    shortLabel: "Savings",
    description: "Intentional savings and investment contributions",
  },
  {
    id: "miscellaneous",
    label: "Miscellaneous",
    shortLabel: "Misc",
    description: "Other regular outflows not captured above",
  },
];

export const BUDGET_CATEGORY_LABELS: Record<BudgetCategory, string> =
  Object.fromEntries(
    BUDGET_CATEGORY_LIST.map((category) => [category.id, category.label])
  ) as Record<BudgetCategory, string>;

export const ALL_BUDGET_CATEGORIES: BudgetCategory[] = BUDGET_CATEGORY_LIST.map(
  (category) => category.id
);
