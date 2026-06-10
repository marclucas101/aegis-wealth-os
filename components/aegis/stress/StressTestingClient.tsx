"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/components/aegis/ShieldScoreCard";
import StressEmptyState from "@/components/aegis/stress/StressEmptyState";
import StressHistoryPanel, {
  type StressTestHistoryEntry,
} from "@/components/aegis/stress/StressHistoryPanel";
import StressImpactPanel from "@/components/aegis/stress/StressImpactPanel";
import StressScenarioCard from "@/components/aegis/stress/StressScenarioCard";
import StressSeveritySelector from "@/components/aegis/stress/StressSeveritySelector";
import {
  computeStressTestingFromProfile,
  loadDiscoverProfile,
  type DiscoverStoredProfile,
  type StressTestingPageResults,
} from "@/lib/aegis/localProfile";
import type { StressTestingSnapshot } from "@/lib/supabase/moduleQueries";
import type { StressScenario, StressSeverity, StressTestResult } from "@/src/lib/scoring/types";

const SCENARIO_ORDER: StressScenario[] = [
  "income_loss",
  "critical_illness",
  "death_event",
  "disability",
  "market_crash",
  "inflation_shock",
  "longevity",
  "business_failure",
  "parent_care",
  "estate_delay",
];

const CLOUD_ALLOWED_SEVERITIES: StressSeverity[] = [
  "mild",
  "moderate",
  "severe",
];

type StressMode = "loading" | "empty" | "cloud" | "local";
type ProfileSource = "cloud" | "local";
type RunState = "idle" | "running" | "error";

function ProfileSourceBadge({ source }: { source: ProfileSource }) {
  const label = source === "cloud" ? "Cloud Profile" : "Local Profile";

  return (
    <span className="inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
      {label}
    </span>
  );
}

function cloudSnapshotToResults(
  snapshot: StressTestingSnapshot,
): StressTestingPageResults {
  return {
    shield: snapshot.shield,
    stressTests: snapshot.stressTests,
    client: snapshot.client,
    completedAt: snapshot.completedAt,
  };
}

function resolveLocalFallback(): {
  mode: "local" | "empty";
  profile: DiscoverStoredProfile | null;
} {
  const saved = loadDiscoverProfile();
  if (saved) {
    return { mode: "local", profile: saved };
  }
  return { mode: "empty", profile: null };
}

export default function StressTestingClient() {
  const [mode, setMode] = useState<StressMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [cloudSnapshot, setCloudSnapshot] =
    useState<StressTestingSnapshot | null>(null);
  const [severity, setSeverity] = useState<StressSeverity>("moderate");
  const [selectedScenario, setSelectedScenario] =
    useState<StressScenario>("income_loss");
  const [cloudRunOverrides, setCloudRunOverrides] = useState<
    Partial<Record<StressScenario, StressTestResult>>
  >({});
  const [runState, setRunState] = useState<RunState>("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [history, setHistory] = useState<StressTestHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);

    try {
      const response = await fetch("/api/stress-testing/history", {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as
        | { ok: true; runs: StressTestHistoryEntry[] }
        | { ok: false };

      if (data.ok) {
        setHistory(data.runs);
      }
    } catch {
      // History is optional for display; ignore fetch errors.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadStressTesting() {
      try {
        const response = await fetch("/api/stress-testing/current", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.status === 401) {
          const fallback = resolveLocalFallback();
          setProfile(fallback.profile);
          setMode(fallback.mode);
          return;
        }

        const data = (await response.json()) as
          | ({ ok: true } & StressTestingSnapshot)
          | { ok: false; reason?: string };

        if (data.ok) {
          setCloudSnapshot(data);
          setProfile(null);
          setMode("cloud");
          return;
        }

        const fallback = resolveLocalFallback();
        setCloudSnapshot(null);
        setProfile(fallback.profile);
        setMode(fallback.mode);
      } catch {
        if (cancelled) return;
        const fallback = resolveLocalFallback();
        setCloudSnapshot(null);
        setProfile(fallback.profile);
        setMode(fallback.mode);
      }
    }

    void loadStressTesting();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "cloud") {
      setHistory([]);
      setCloudRunOverrides({});
      setRunState("idle");
      setRunError(null);
      return;
    }

    void loadHistory();
  }, [mode, loadHistory]);

  const handleRunStressTest = useCallback(async () => {
    if (mode !== "cloud") return;

    setRunState("running");
    setRunError(null);

    try {
      const response = await fetch("/api/stress-testing/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: selectedScenario,
          severity,
        }),
      });

      const data = (await response.json()) as
        | {
            ok: true;
            result: StressTestResult;
          }
        | { ok: false; error?: string };

      if (!response.ok || !data.ok) {
        setRunState("error");
        setRunError(
          data.ok === false
            ? (data.error ?? "Failed to save stress test run")
            : "Failed to save stress test run",
        );
        return;
      }

      setCloudRunOverrides((current) => ({
        ...current,
        [selectedScenario]: data.result,
      }));
      setRunState("idle");
      void loadHistory();
    } catch {
      setRunState("error");
      setRunError("Failed to save stress test run");
    }
  }, [mode, selectedScenario, severity, loadHistory]);

  const localResults: StressTestingPageResults | null = useMemo(() => {
    if (mode !== "local" || !profile) return null;
    return computeStressTestingFromProfile(profile, severity);
  }, [mode, profile, severity]);

  const cloudResults: StressTestingPageResults | null = useMemo(() => {
    if (mode !== "cloud" || !cloudSnapshot) return null;
    return cloudSnapshotToResults(cloudSnapshot);
  }, [mode, cloudSnapshot]);

  const results = mode === "cloud" ? cloudResults : localResults;

  const displayedStressTests = useMemo(() => {
    if (!results) return [];

    if (mode !== "cloud") {
      return results.stressTests;
    }

    return results.stressTests.map((test) => {
      const override = cloudRunOverrides[test.scenario];
      return override ?? test;
    });
  }, [results, mode, cloudRunOverrides]);

  const orderedTests = useMemo(() => {
    const byScenario = new Map(
      displayedStressTests.map((test) => [test.scenario, test]),
    );
    return SCENARIO_ORDER.map(
      (scenario) => byScenario.get(scenario)!,
    ).filter(Boolean);
  }, [displayedStressTests]);

  const topDamaging = useMemo(() => {
    if (!results) return [];

    if (mode === "cloud") {
      return [...displayedStressTests]
        .sort((a, b) => a.postStressScore - b.postStressScore)
        .slice(0, 3);
    }

    return [...results.stressTests]
      .sort((a, b) => a.postStressScore - b.postStressScore)
      .slice(0, 3);
  }, [results, mode, displayedStressTests]);

  const selectedTest = useMemo(() => {
    return orderedTests.find((test) => test.scenario === selectedScenario) ?? null;
  }, [orderedTests, selectedScenario]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading stress simulations…
        </p>
      </div>
    );
  }

  if (mode === "empty" || !results || !selectedTest) {
    return <StressEmptyState />;
  }

  const profileSource: ProfileSource = mode === "cloud" ? "cloud" : "local";
  const isRunning = runState === "running";

  return (
    <>
      <header className="mb-8 border-b border-[#D1A866]/15 pb-6 sm:mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <ProfileSourceBadge source={profileSource} />
            <p className="mt-3 text-sm text-[#F3F1EA]/45">
              Institutional scenario modelling across ten disruption events,
              calibrated to your shield architecture
            </p>
          </div>

          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
              Client Profile
            </p>
            <p className="mt-1 text-sm text-[#F3F1EA]">
              {results.client.occupation ?? "Client"} · Age {results.client.age}
            </p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-[#D1A866]/70">
              Net Worth {formatCurrency(results.client.netWorth)}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <StressSeveritySelector
            value={severity}
            onChange={setSeverity}
            allowedSeverities={
              mode === "cloud" ? CLOUD_ALLOWED_SEVERITIES : undefined
            }
            disabled={isRunning}
          />

          {mode === "cloud" && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-light text-[#F3F1EA]/45">
                Run the selected scenario at the chosen severity. Results are
                saved to your cloud profile.
              </p>
              <button
                type="button"
                onClick={() => void handleRunStressTest()}
                disabled={isRunning}
                className="shrink-0 rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/15 px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? "Running…" : "Run Stress Test"}
              </button>
            </div>
          )}

          {mode === "cloud" && runState === "error" && runError && (
            <p className="text-sm text-[#F3F1EA]/55">
              {runError}. Your on-screen result is still visible, but this run
              was not saved.
            </p>
          )}
        </div>

        <section className="rounded-sm border border-[#D1A866]/15 bg-[#1A2A2B]/25 p-5">
          <div className="mb-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Highest Exposure Scenarios
            </p>
            <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/50">
              Top three events with the lowest post-stress shield scores at
              current severity
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {topDamaging.map((test, index) => (
              <StressScenarioCard
                key={test.scenario}
                test={test}
                selected={selectedScenario === test.scenario}
                rank={index + 1}
                onSelect={() => setSelectedScenario(test.scenario)}
              />
            ))}
          </div>
        </section>

        <StressImpactPanel
          test={selectedTest}
          preStressRating={results.shield.rating}
        />

        <section>
          <div className="mb-4 border-b border-[#D1A866]/10 pb-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              All Stress Scenarios
            </p>
            <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
              Ten institutional disruption events
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {orderedTests.map((test) => (
              <StressScenarioCard
                key={test.scenario}
                test={test}
                selected={selectedScenario === test.scenario}
                onSelect={() => setSelectedScenario(test.scenario)}
              />
            ))}
          </div>
        </section>

        {mode === "cloud" && (
          <StressHistoryPanel runs={history} loading={historyLoading} />
        )}
      </div>
    </>
  );
}
