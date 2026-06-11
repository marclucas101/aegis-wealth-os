import { ALL_BUDGET_CATEGORIES } from "./categories";
import type { BudgetArchetype, BudgetCategory, ClientBudgetProfile } from "./types";

export const BUDGET_OPTIMISER_STORAGE_KEY = "aegis-budget-optimiser-draft-v1";
const DISCOVER_STORAGE_KEY = "aegis-discover-profile-v1";

export interface BudgetOptimiserDraft {
  archetype: BudgetArchetype;
  age: string;
  monthlyIncome: string;
  amounts: Record<BudgetCategory, string>;
}

export function createEmptyAmounts(): Record<BudgetCategory, string> {
  return Object.fromEntries(
    ALL_BUDGET_CATEGORIES.map((category) => [category, ""])
  ) as Record<BudgetCategory, string>;
}

export function createEmptyDraft(): BudgetOptimiserDraft {
  return {
    archetype: "young_working_adult_no_car",
    age: "",
    monthlyIncome: "",
    amounts: createEmptyAmounts(),
  };
}

export function loadDraftFromStorage(): BudgetOptimiserDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(BUDGET_OPTIMISER_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as BudgetOptimiserDraft;
  } catch {
    return null;
  }
}

export function saveDraftToStorage(draft: BudgetOptimiserDraft): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(BUDGET_OPTIMISER_STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraftFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(BUDGET_OPTIMISER_STORAGE_KEY);
}

export function tryInferAgeFromDiscover(): number | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(DISCOVER_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }

    const data = JSON.parse(raw) as {
      personal?: { dateOfBirth?: string };
    };
    const dob = data.personal?.dateOfBirth;
    if (!dob) {
      return undefined;
    }

    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) {
      return undefined;
    }

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDelta = today.getMonth() - birthDate.getMonth();
    if (
      monthDelta < 0 ||
      (monthDelta === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }

    return age > 0 && age < 120 ? age : undefined;
  } catch {
    return undefined;
  }
}

export function draftToClientProfile(draft: BudgetOptimiserDraft): ClientBudgetProfile {
  const entries = ALL_BUDGET_CATEGORIES.map((category) => {
    const raw = draft.amounts[category]?.trim() ?? "";
    const parsed = raw === "" ? 0 : Number(raw.replace(/,/g, ""));
    return {
      category,
      amount: Number.isFinite(parsed) ? Math.max(0, parsed) : 0,
    };
  }).filter((entry) => entry.amount > 0);

  const ageParsed = Number(draft.age);
  const incomeParsed = Number(draft.monthlyIncome.replace(/,/g, ""));

  return {
    archetype: draft.archetype,
    age: Number.isFinite(ageParsed) && ageParsed > 0 ? ageParsed : undefined,
    monthlyIncome:
      Number.isFinite(incomeParsed) && incomeParsed > 0 ? incomeParsed : undefined,
    entries:
      entries.length > 0
        ? entries
        : ALL_BUDGET_CATEGORIES.map((category) => ({ category, amount: 0 })),
  };
}
