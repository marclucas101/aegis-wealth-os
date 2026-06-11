import { ALL_BUDGET_CATEGORIES } from "./categories";
import {
  createEmptyAmounts,
  type BudgetOptimiserDraft,
} from "./formState";
import type { BudgetArchetype, BudgetEntry } from "./types";

export type SavedBudgetAccountRecord = {
  id: string;
  clientId: string;
  archetype: BudgetArchetype;
  age: number | null;
  monthlyIncome: number | null;
  currency: string;
  entries: BudgetEntry[];
  updatedAt: string;
  createdAt: string;
  isCurrent: boolean;
};

export function normalizeDraftForCompare(draft: BudgetOptimiserDraft): string {
  const amounts = Object.fromEntries(
    ALL_BUDGET_CATEGORIES.map((category) => [
      category,
      (draft.amounts[category] ?? "").trim(),
    ]),
  );

  return JSON.stringify({
    archetype: draft.archetype,
    age: draft.age.trim(),
    monthlyIncome: draft.monthlyIncome.trim(),
    amounts,
  });
}

export function draftsAreEqual(
  left: BudgetOptimiserDraft,
  right: BudgetOptimiserDraft,
): boolean {
  return normalizeDraftForCompare(left) === normalizeDraftForCompare(right);
}

export function savedBudgetToDraft(
  saved: Pick<
    SavedBudgetAccountRecord,
    "archetype" | "age" | "monthlyIncome" | "entries"
  >,
): BudgetOptimiserDraft {
  const amounts = createEmptyAmounts();

  for (const entry of saved.entries) {
    if (ALL_BUDGET_CATEGORIES.includes(entry.category)) {
      amounts[entry.category] = entry.amount > 0 ? String(entry.amount) : "";
    }
  }

  return {
    archetype: saved.archetype,
    age: saved.age !== null && saved.age > 0 ? String(saved.age) : "",
    monthlyIncome:
      saved.monthlyIncome !== null && saved.monthlyIncome > 0
        ? String(saved.monthlyIncome)
        : "",
    amounts,
  };
}

export type SaveBudgetToAccountResult =
  | { ok: true; budgetId: string; updatedAt: string }
  | { ok: false; error: string };

export async function saveBudgetToAccount(
  draft: BudgetOptimiserDraft,
): Promise<SaveBudgetToAccountResult> {
  const response = await fetch("/api/budget-optimiser/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ draft }),
  });

  const data = (await response.json()) as
    | { ok: true; budgetId: string; updatedAt: string }
    | { ok: false; error?: string };

  if (!data.ok) {
    return {
      ok: false,
      error: data.error ?? "Failed to save budget to your account",
    };
  }

  return {
    ok: true,
    budgetId: data.budgetId,
    updatedAt: data.updatedAt,
  };
}

export type LoadLatestBudgetResult =
  | { ok: true; budget: SavedBudgetAccountRecord }
  | { ok: false; error?: string; notFound?: boolean };

export async function loadLatestBudgetForAccount(): Promise<LoadLatestBudgetResult> {
  const response = await fetch("/api/budget-optimiser/current", {
    credentials: "include",
  });

  const data = (await response.json()) as
    | { ok: true; budget: SavedBudgetAccountRecord }
    | { ok: false; error?: string; budget?: null };

  if (!data.ok) {
    if (data.budget === null && !data.error) {
      return { ok: false, notFound: true };
    }
    return {
      ok: false,
      error: data.error ?? "Failed to load saved budget",
    };
  }

  return { ok: true, budget: data.budget };
}

export type BudgetSnapshotSummary = SavedBudgetAccountRecord;

export async function listBudgetSnapshotsForAccount(): Promise<
  | { ok: true; snapshots: BudgetSnapshotSummary[] }
  | { ok: false; error: string }
> {
  const response = await fetch("/api/budget-optimiser/history", {
    credentials: "include",
  });

  const data = (await response.json()) as
    | { ok: true; snapshots: BudgetSnapshotSummary[] }
    | { ok: false; error?: string };

  if (!data.ok) {
    return {
      ok: false,
      error: data.error ?? "Failed to load budget history",
    };
  }

  return { ok: true, snapshots: data.snapshots };
}
