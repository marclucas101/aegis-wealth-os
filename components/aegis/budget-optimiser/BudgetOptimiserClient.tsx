"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  FieldGrid,
  FinancialSelect,
  FinancialTextInput,
} from "@/components/aegis/discover/FinancialInput";
import {
  analyzeBudget,
  BUDGET_ARCHETYPE_LIST,
  BUDGET_CATEGORY_LIST,
  calculateTotalMonthlyExpense,
  clearDraftFromStorage,
  createEmptyDraft,
  draftToClientProfile,
  draftsAreEqual,
  loadDraftFromStorage,
  loadLatestBudgetForAccount,
  listBudgetSnapshotsForAccount,
  sampleStudentDraft,
  sampleYoungFamilyDraft,
  saveBudgetToAccount,
  saveDraftToStorage,
  savedBudgetToDraft,
  tryInferAgeFromDiscover,
  type BudgetArchetype,
  type BudgetCategory,
  type BudgetOptimiserDraft,
  type BudgetSnapshotSummary,
  type SavedBudgetAccountRecord,
  type SpendingStatus,
} from "@/src/features/budget-optimiser";

const panelClass =
  "relative rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/40 p-4 sm:p-5";
const buttonSecondary =
  "rounded-sm border border-[#D1A866]/20 px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-[#F3F1EA]/70 transition hover:border-[#D1A866]/35 hover:text-[#F3F1EA]";
const buttonPrimary =
  "rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-[#F3F1EA] transition hover:border-[#D1A866]/55 hover:bg-[#D1A866]/15 disabled:cursor-not-allowed disabled:opacity-45";
const labelClass =
  "text-[10px] font-medium uppercase tracking-[0.15em] text-[#D1A866]/70";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function statusStyles(status: SpendingStatus): string {
  switch (status) {
    case "within_range":
      return "border-emerald-400/25 bg-emerald-950/25 text-emerald-200/85";
    case "below_range":
      return "border-[#D1A866]/20 bg-[#10283A]/50 text-[#F3F1EA]/70";
    case "watch":
      return "border-amber-400/25 bg-amber-950/20 text-amber-100/85";
    case "overspending":
      return "border-red-400/25 bg-red-950/20 text-red-200/85";
    case "not_applicable":
    default:
      return "border-[#F3F1EA]/10 bg-[#10283A]/30 text-[#F3F1EA]/45";
  }
}

function statusLabel(status: SpendingStatus): string {
  switch (status) {
    case "within_range":
      return "Within Range";
    case "below_range":
      return "Below Range";
    case "watch":
      return "Watch";
    case "overspending":
      return "Overspending";
    case "not_applicable":
      return "Not Applicable";
    default:
      return status;
  }
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function formatSavedTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function archetypeLabel(id: BudgetArchetype): string {
  return BUDGET_ARCHETYPE_LIST.find((item) => item.id === id)?.label ?? id;
}

function BudgetOptimiserLoaded() {
  const [draft, setDraft] = useState<BudgetOptimiserDraft>(() => {
    const stored = loadDraftFromStorage();
    if (stored) {
      return stored;
    }
    const empty = createEmptyDraft();
    const inferredAge = tryInferAgeFromDiscover();
    if (inferredAge !== undefined) {
      empty.age = String(inferredAge);
    }
    return empty;
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [savedBudget, setSavedBudget] = useState<SavedBudgetAccountRecord | null>(
    null
  );
  const [savedDraft, setSavedDraft] = useState<BudgetOptimiserDraft | null>(null);
  const [snapshots, setSnapshots] = useState<BudgetSnapshotSummary[]>([]);
  const [isAccountLoading, setIsAccountLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    saveDraftToStorage(draft);
  }, [draft]);

  useEffect(() => {
    let cancelled = false;

    async function loadAccountBudget() {
      setIsAccountLoading(true);
      const result = await loadLatestBudgetForAccount();
      if (cancelled) {
        return;
      }

      if (result.ok) {
        const accountDraft = savedBudgetToDraft(result.budget);
        setSavedBudget(result.budget);
        setSavedDraft(accountDraft);

        const hadLocalDraft = loadDraftFromStorage() !== null;
        if (!hadLocalDraft) {
          setDraft(accountDraft);
          setActionMessage("Loaded your saved budget from your account.");
        }
      } else if (!result.notFound) {
        setSaveError(result.error ?? "Could not load saved budget.");
      }

      const historyResult = await listBudgetSnapshotsForAccount();
      if (!cancelled && historyResult.ok) {
        setSnapshots(historyResult.snapshots);
      }

      setIsAccountLoading(false);
    }

    void loadAccountBudget();

    return () => {
      cancelled = true;
    };
  }, []);

  const profile = useMemo(() => draftToClientProfile(draft), [draft]);
  const analysis = useMemo(() => analyzeBudget(profile), [profile]);
  const liveTotal = useMemo(
    () => calculateTotalMonthlyExpense(profile.entries),
    [profile.entries]
  );
  const hasUnsavedChanges = useMemo(() => {
    if (!savedDraft) {
      return false;
    }
    return !draftsAreEqual(draft, savedDraft);
  }, [draft, savedDraft]);

  const archetypeOptions = BUDGET_ARCHETYPE_LIST.map((item) => ({
    value: item.id,
    label: item.label,
  }));

  function updateAmount(category: BudgetCategory, value: string) {
    setDraft((current) => ({
      ...current,
      amounts: {
        ...current.amounts,
        [category]: value,
      },
    }));
    setActionMessage(null);
    setSaveError(null);
  }

  async function refreshAccountState() {
    const [currentResult, historyResult] = await Promise.all([
      loadLatestBudgetForAccount(),
      listBudgetSnapshotsForAccount(),
    ]);

    if (currentResult.ok) {
      setSavedBudget(currentResult.budget);
      setSavedDraft(savedBudgetToDraft(currentResult.budget));
    }

    if (historyResult.ok) {
      setSnapshots(historyResult.snapshots);
    }
  }

  async function handleSaveToAccount() {
    setIsSaving(true);
    setSaveError(null);
    setActionMessage(null);

    const result = await saveBudgetToAccount(draft);

    setIsSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }

    await refreshAccountState();
    setActionMessage("Budget saved to your account.");
  }

  function handleLoadSavedBudget() {
    if (!savedDraft) {
      setSaveError("No saved budget found on your account yet.");
      return;
    }

    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Replace your current inputs with the last saved account budget? Your local draft in this browser will be updated."
      )
    ) {
      return;
    }

    setDraft(savedDraft);
    setActionMessage("Loaded your saved budget from your account.");
    setSaveError(null);
  }

  function handleRestoreSnapshot(snapshot: BudgetSnapshotSummary) {
    const snapshotDraft = savedBudgetToDraft(snapshot);

    if (
      !draftsAreEqual(draft, snapshotDraft) &&
      !window.confirm(
        "Restore this previous budget snapshot? Your current inputs will be replaced."
      )
    ) {
      return;
    }

    setDraft(snapshotDraft);
    setActionMessage(
      `Restored budget snapshot from ${formatSavedTimestamp(snapshot.createdAt)}. Save to account to make it current.`
    );
    setSaveError(null);
  }

  function handleReset() {
    if (
      !window.confirm(
        "Reset all budget optimiser inputs? This clears the saved draft in this browser."
      )
    ) {
      return;
    }
    clearDraftFromStorage();
    const empty = createEmptyDraft();
    const inferredAge = tryInferAgeFromDiscover();
    if (inferredAge !== undefined) {
      empty.age = String(inferredAge);
    }
    setDraft(empty);
    setActionMessage(
      "Local draft reset. Your saved account budget was not changed."
    );
    setSaveError(null);
  }

  function handleLoadSample(which: "student" | "family") {
    setDraft(which === "student" ? sampleStudentDraft : sampleYoungFamilyDraft);
    setActionMessage(
      which === "student"
        ? "Student sample loaded — transport is intentionally elevated for benchmark testing."
        : "Young family sample loaded."
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-5 py-6 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Capital Allocation Discipline
        </p>
        <h2 className="mt-2 text-xl font-light tracking-wide text-[#F3F1EA] sm:text-2xl">
          Budget Allocation Optimiser
        </h2>
        <p className="mt-3 max-w-3xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
          Analyse monthly spending against life-stage benchmarks and identify
          allocation drift. This is planning support — not regulated advice.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonPrimary}
            disabled={isSaving || isAccountLoading}
            onClick={() => void handleSaveToAccount()}
          >
            {isSaving ? "Saving…" : "Save Budget to Account"}
          </button>
          <button
            type="button"
            className={buttonSecondary}
            disabled={isAccountLoading || !savedDraft}
            onClick={handleLoadSavedBudget}
          >
            Load Saved Budget
          </button>
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => handleLoadSample("student")}
          >
            Load Student Sample
          </button>
          <button
            type="button"
            className={buttonSecondary}
            onClick={() => handleLoadSample("family")}
          >
            Load Family Sample
          </button>
          <button type="button" className={buttonSecondary} onClick={handleReset}>
            Reset Local Draft
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-light text-[#F3F1EA]/45">
          {isAccountLoading ? (
            <span>Checking account save status…</span>
          ) : savedBudget ? (
            <span>
              Last saved to account:{" "}
              <span className="text-[#F3F1EA]/70">
                {formatSavedTimestamp(savedBudget.updatedAt)}
              </span>
            </span>
          ) : (
            <span>No budget saved to your account yet.</span>
          )}
          {hasUnsavedChanges ? (
            <span className="rounded-sm border border-amber-400/20 bg-amber-950/15 px-2 py-1 text-amber-100/80">
              You have unsaved local changes.
            </span>
          ) : savedBudget ? (
            <span className="text-emerald-200/70">In sync with account save.</span>
          ) : null}
        </div>
      </header>

      {saveError ? (
        <p className="rounded-sm border border-red-400/20 bg-red-950/20 px-4 py-3 text-sm font-light text-red-200/85">
          {saveError}
        </p>
      ) : null}

      {actionMessage ? (
        <p className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 px-4 py-3 text-sm font-light text-[#F3F1EA]/75">
          {actionMessage}
        </p>
      ) : null}

      {snapshots.length > 0 ? (
        <section className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/30 px-4 py-3">
          <button
            type="button"
            className="text-left text-[11px] uppercase tracking-[0.14em] text-[#D1A866]/75 transition hover:text-[#F3F1EA]"
            onClick={() => setShowHistory((current) => !current)}
          >
            {showHistory ? "Hide" : "View"} previous saves ({snapshots.length})
          </button>
          {showHistory ? (
            <ul className="mt-3 space-y-2">
              {snapshots.map((snapshot) => (
                <li
                  key={snapshot.id}
                  className="flex flex-col gap-2 rounded-sm border border-[#D1A866]/10 bg-[#10283A]/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-light text-[#F3F1EA]/75">
                      {archetypeLabel(snapshot.archetype)}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
                      Saved {formatSavedTimestamp(snapshot.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={buttonSecondary}
                    onClick={() => handleRestoreSnapshot(snapshot)}
                  >
                    Restore Snapshot
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className={panelClass}>
        <h3 className="text-sm font-light tracking-wide text-[#F3F1EA]">
          Profile & Income
        </h3>
        <div className="mt-5">
          <FieldGrid>
            <FinancialSelect
              id="archetype"
              label="Life-Stage Archetype"
              value={draft.archetype}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  archetype: value as BudgetArchetype,
                }))
              }
              options={archetypeOptions}
            />
            <FinancialTextInput
              id="age"
              label="Age (Optional)"
              type="number"
              min={16}
              max={100}
              value={draft.age}
              onChange={(value) =>
                setDraft((current) => ({ ...current, age: value }))
              }
              hint="Pre-filled from Discover profile when available"
            />
            <FinancialTextInput
              id="monthlyIncome"
              label="Monthly Income (Optional)"
              type="number"
              prefix="S$"
              min={0}
              value={draft.monthlyIncome}
              onChange={(value) =>
                setDraft((current) => ({ ...current, monthlyIncome: value }))
              }
              hint="Enables savings capacity and spending load analysis"
            />
          </FieldGrid>
          <p className="mt-4 text-xs font-light text-[#F3F1EA]/40">
            {
              BUDGET_ARCHETYPE_LIST.find((item) => item.id === draft.archetype)
                ?.description
            }
          </p>
        </div>
      </section>

      <section className={panelClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-light tracking-wide text-[#F3F1EA]">
              Monthly Spending Inputs
            </h3>
            <p className="mt-1 text-xs font-light text-[#F3F1EA]/40">
              Enter monthly SGD amounts. Leave blank for categories not applicable.
            </p>
          </div>
          <div className="rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 px-4 py-3 text-right">
            <p className={labelClass}>Live Monthly Outflow</p>
            <p className="mt-1 font-mono text-xl tabular-nums text-[#F3F1EA]">
              {formatCurrency(liveTotal)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BUDGET_CATEGORY_LIST.map((category) => (
            <FinancialTextInput
              key={category.id}
              id={`budget-${category.id}`}
              label={category.shortLabel}
              hint={category.description}
              type="number"
              prefix="S$"
              min={0}
              value={draft.amounts[category.id]}
              onChange={(value) => updateAmount(category.id, value)}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[
          {
            label: "Monthly Outflow",
            value: formatCurrency(analysis.totalMonthlyExpense),
          },
          {
            label: "Annualised Expense",
            value: formatCurrency(analysis.annualExpense),
          },
          {
            label: "Allocation Drift",
            value: String(analysis.allocationDriftCount),
            sub: "categories on watch or above range",
          },
          {
            label: "Optimisation Opportunity",
            value: formatCurrency(analysis.monthlyOptimisationOpportunity),
            sub: "above upper benchmarks",
          },
          {
            label: "Savings Capacity",
            value:
              analysis.savingsCapacity !== undefined
                ? formatCurrency(analysis.savingsCapacity)
                : "—",
            sub:
              analysis.savingsRate !== undefined
                ? `${formatPercent(analysis.savingsRate)} savings rate`
                : "Add income to calculate",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-4 py-4"
          >
            <p className={labelClass}>{card.label}</p>
            <p className="mt-2 font-mono text-lg tabular-nums text-[#F3F1EA]">
              {card.value}
            </p>
            {card.sub ? (
              <p className="mt-1 text-[10px] font-light text-[#F3F1EA]/40">
                {card.sub}
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section className={panelClass}>
        <h3 className="text-sm font-light tracking-wide text-[#F3F1EA]">
          Analysis Summary
        </h3>
        <p className="mt-3 text-sm font-light leading-relaxed text-[#F3F1EA]/65">
          {analysis.overallSummary}
        </p>

        {analysis.spendingLoad ? (
          <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#D1A866]/70">
            Spending load relative to income: {analysis.spendingLoad}
          </p>
        ) : null}

        {analysis.topSpendingCategories.length > 0 ? (
          <div className="mt-6">
            <p className={labelClass}>Top Spending Categories</p>
            <ul className="mt-3 space-y-2">
              {analysis.topSpendingCategories.map((item) => (
                <li
                  key={item.category}
                  className="flex items-center justify-between gap-3 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-3 py-2 text-sm font-light text-[#F3F1EA]/75"
                >
                  <span>{item.label}</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(item.amount)} · {item.percentageOfTotal.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {analysis.suggestedPriorityActions.length > 0 ? (
          <div className="mt-6">
            <p className={labelClass}>Suggested Priority Actions</p>
            <ul className="mt-3 space-y-2">
              {analysis.suggestedPriorityActions.map((action) => (
                <li
                  key={action}
                  className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/35 px-3 py-2 text-sm font-light leading-relaxed text-[#F3F1EA]/70"
                >
                  {action}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-light tracking-wide text-[#F3F1EA]">
          Category Breakdown
        </h3>
        {analysis.categoryAnalyses
          .filter(
            (item) =>
              item.amount > 0 ||
              item.status === "overspending" ||
              item.status === "watch"
          )
          .sort((a, b) => b.amount - a.amount)
          .map((item) => (
            <article
              key={item.category}
              className={`rounded-sm border px-4 py-4 sm:px-5 ${statusStyles(item.status)}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-light tracking-wide">{item.label}</h4>
                    <span className="rounded-sm border border-current/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]">
                      {statusLabel(item.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-light leading-relaxed opacity-90">
                    {item.recommendation}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-lg tabular-nums">
                    {formatCurrency(item.amount)}
                  </p>
                  {item.benchmark?.applicable ? (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-70">
                      Ref {formatCurrency(item.benchmark.min)} –{" "}
                      {formatCurrency(item.benchmark.max)}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
      </section>
    </div>
  );
}

export default function BudgetOptimiserClient() {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/40 px-5 py-8 text-sm font-light text-[#F3F1EA]/50">
        Loading budget optimiser…
      </div>
    );
  }

  return <BudgetOptimiserLoaded />;
}
