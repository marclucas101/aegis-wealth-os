import "server-only";

import { ALL_BUDGET_CATEGORIES } from "@/src/features/budget-optimiser/categories";
import { analyzeBudget } from "@/src/features/budget-optimiser/analyzeBudget";
import {
  draftToClientProfile,
  type BudgetOptimiserDraft,
} from "@/src/features/budget-optimiser/formState";
import type {
  BudgetAnalysisResult,
  BudgetArchetype,
  BudgetEntry,
} from "@/src/features/budget-optimiser/types";

import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const BUDGET_ARCHETYPES = new Set<string>([
  "student",
  "nsf_or_allowance_based",
  "young_working_adult_no_car",
  "working_adult_public_transport",
  "working_adult_with_car",
  "married_couple_no_children",
  "young_family",
  "homeowner_with_mortgage",
  "pre_retiree",
  "retiree",
]);

export type SavedClientBudget = {
  id: string;
  clientId: string;
  archetype: BudgetArchetype;
  age: number | null;
  monthlyIncome: number | null;
  currency: string;
  entries: BudgetEntry[];
  analysis: BudgetAnalysisResult;
  totalMonthlyExpense: number;
  annualExpense: number;
  expenseToIncomeRatio: number | null;
  savingsCapacity: number | null;
  sourceFeature: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
};

function draftToEntries(draft: BudgetOptimiserDraft): BudgetEntry[] {
  return ALL_BUDGET_CATEGORIES.map((category) => {
    const raw = draft.amounts[category]?.trim() ?? "";
    const parsed = raw === "" ? 0 : Number(raw.replace(/,/g, ""));
    return {
      category,
      amount: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    };
  });
}

function parseAge(draft: BudgetOptimiserDraft): number | null {
  const parsed = Number(draft.age);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 120) {
    return null;
  }
  return Math.round(parsed);
}

function parseMonthlyIncome(draft: BudgetOptimiserDraft): number | null {
  const parsed = Number(draft.monthlyIncome.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function mapRowToSavedBudget(row: {
  id: string;
  client_id: string;
  archetype: string;
  age: number | null;
  monthly_income: number | null;
  currency: string;
  entries: unknown;
  analysis: unknown;
  total_monthly_expense: number;
  annual_expense: number;
  expense_to_income_ratio: number | null;
  savings_capacity: number | null;
  source_feature: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}): SavedClientBudget {
  return {
    id: row.id,
    clientId: row.client_id,
    archetype: row.archetype as BudgetArchetype,
    age: row.age,
    monthlyIncome: row.monthly_income,
    currency: row.currency,
    entries: row.entries as BudgetEntry[],
    analysis: row.analysis as BudgetAnalysisResult,
    totalMonthlyExpense: Number(row.total_monthly_expense),
    annualExpense: Number(row.annual_expense),
    expenseToIncomeRatio:
      row.expense_to_income_ratio !== null
        ? Number(row.expense_to_income_ratio)
        : null,
    savingsCapacity:
      row.savings_capacity !== null ? Number(row.savings_capacity) : null,
    sourceFeature: row.source_feature,
    isCurrent: row.is_current,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function isValidBudgetDraft(draft: unknown): draft is BudgetOptimiserDraft {
  if (!draft || typeof draft !== "object") {
    return false;
  }

  const candidate = draft as BudgetOptimiserDraft;
  if (
    typeof candidate.archetype !== "string" ||
    !BUDGET_ARCHETYPES.has(candidate.archetype) ||
    typeof candidate.age !== "string" ||
    typeof candidate.monthlyIncome !== "string" ||
    !candidate.amounts ||
    typeof candidate.amounts !== "object"
  ) {
    return false;
  }

  return true;
}

export type PersistClientBudgetResult = {
  budgetId: string;
  clientId: string;
  updatedAt: string;
};

export async function persistClientBudget(
  client: AppClientRow,
  ownerUserId: string,
  draft: BudgetOptimiserDraft,
): Promise<PersistClientBudgetResult> {
  const profile = draftToClientProfile(draft);
  const analysis = analyzeBudget(profile);
  const entries = draftToEntries(draft);
  const clientId = client.id;
  const admin = createAdminSupabaseClient();

  const { error: demoteError } = await admin
    .from("client_budgets")
    .update({ is_current: false } as never)
    .eq("client_id", clientId)
    .eq("is_current", true);

  if (demoteError) {
    throw new Error(
      `Failed to demote prior client budgets: ${demoteError.message}`,
    );
  }

  const { data: row, error: insertError } = await admin
    .from("client_budgets")
    .insert({
      owner_user_id: ownerUserId,
      client_id: clientId,
      is_current: true,
      archetype: draft.archetype,
      age: parseAge(draft),
      monthly_income: parseMonthlyIncome(draft),
      currency: client.currency_code || "SGD",
      entries: entries as never,
      analysis: analysis as never,
      total_monthly_expense: analysis.totalMonthlyExpense,
      annual_expense: analysis.annualExpense,
      expense_to_income_ratio: analysis.expenseToIncomeRatio ?? null,
      savings_capacity: analysis.savingsCapacity ?? null,
      source_feature: "budget_optimiser",
    } as never)
    .select("id, updated_at")
    .single();

  if (insertError || !row) {
    throw new Error(
      `Failed to insert client budget: ${insertError?.message ?? "unknown"}`,
    );
  }

  const inserted = row as { id: string; updated_at: string };

  return {
    budgetId: inserted.id,
    clientId,
    updatedAt: inserted.updated_at,
  };
}

export async function loadCurrentClientBudget(
  clientId: string,
): Promise<SavedClientBudget | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("client_budgets")
    .select(
      "id, client_id, archetype, age, monthly_income, currency, entries, analysis, total_monthly_expense, annual_expense, expense_to_income_ratio, savings_capacity, source_feature, is_current, created_at, updated_at",
    )
    .eq("client_id", clientId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client budget: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapRowToSavedBudget(data as Parameters<typeof mapRowToSavedBudget>[0]);
}

export async function listClientBudgetSnapshots(
  clientId: string,
  limit = 10,
): Promise<SavedClientBudget[]> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("client_budgets")
    .select(
      "id, client_id, archetype, age, monthly_income, currency, entries, analysis, total_monthly_expense, annual_expense, expense_to_income_ratio, savings_capacity, source_feature, is_current, created_at, updated_at",
    )
    .eq("client_id", clientId)
    .eq("is_current", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list client budget snapshots: ${error.message}`);
  }

  if (!data?.length) {
    return [];
  }

  return (data as Parameters<typeof mapRowToSavedBudget>[0][]).map(
    mapRowToSavedBudget,
  );
}
