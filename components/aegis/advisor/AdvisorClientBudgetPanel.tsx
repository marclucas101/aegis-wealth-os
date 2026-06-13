"use client";

import { useEffect, useState } from "react";

type BudgetResponse =
  | {
      ok: true;
      hasSavedBudget: boolean;
      budget: {
        archetype: string;
        monthlyIncome: number;
        totalMonthlyExpense: number;
        expenseToIncomeRatio: number;
        savingsCapacity: number;
        currency: string;
        updatedAt: string;
      } | null;
    }
  | { ok: false; error?: string };

export default function AdvisorClientBudgetPanel({
  clientId,
}: {
  clientId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedBudget, setHasSavedBudget] = useState(false);
  const [budget, setBudget] = useState<{
    archetype: string;
    monthlyIncome: number | null;
    totalMonthlyExpense: number;
    expenseToIncomeRatio: number | null;
    savingsCapacity: number | null;
    currency: string;
    updatedAt: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/advisor/clients/${clientId}/budget`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as BudgetResponse;

        if (cancelled) return;

        if (!response.ok || !payload.ok) {
          setError(payload.ok ? "Failed to load budget" : payload.error ?? "Failed to load budget");
          return;
        }

        setHasSavedBudget(payload.hasSavedBudget);
        setBudget(payload.budget);
      } catch {
        if (!cancelled) {
          setError("Failed to load budget");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <div className="h-32 animate-pulse rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30" />
    );
  }

  if (error) {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-950/20 px-4 py-3 text-sm text-red-200/80">
        {error}
      </div>
    );
  }

  if (!hasSavedBudget || !budget) {
    return (
      <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/50 px-5 py-8 text-center">
        <p className="text-sm font-light text-[#F3F1EA]/45">
          No saved budget optimiser snapshot for this client yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 p-6">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
        Budget optimiser
      </p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Archetype
          </dt>
          <dd className="mt-1 text-sm text-[#F3F1EA]/75">{budget.archetype}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Monthly income
          </dt>
          <dd className="mt-1 font-mono text-sm text-[#D1A866]">
            {budget.currency}{" "}
            {(budget.monthlyIncome ?? 0).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Monthly expense
          </dt>
          <dd className="mt-1 font-mono text-sm text-[#F3F1EA]/75">
            {budget.currency} {budget.totalMonthlyExpense.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Expense ratio
          </dt>
          <dd className="mt-1 font-mono text-sm text-[#F3F1EA]/75">
            {budget.expenseToIncomeRatio != null
              ? `${Math.round(budget.expenseToIncomeRatio * 100)}%`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Savings capacity
          </dt>
          <dd className="mt-1 font-mono text-sm text-[#F3F1EA]/75">
            {budget.currency}{" "}
            {(budget.savingsCapacity ?? 0).toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
            Last saved
          </dt>
          <dd className="mt-1 text-sm text-[#F3F1EA]/55">
            {new Date(budget.updatedAt).toLocaleDateString("en-SG")}
          </dd>
        </div>
      </dl>
    </div>
  );
}
