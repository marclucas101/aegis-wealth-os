"use client";

import { useEffect, useMemo, useState } from "react";

import type { AdvisorClientStressTestsResponse } from "@/app/api/advisor/clients/[clientId]/stress-tests/route";
import AdvisorClientReadOnlyBanner from "@/components/aegis/advisor/AdvisorClientReadOnlyBanner";
import StressHistoryPanel from "@/components/aegis/stress/StressHistoryPanel";
import StressImpactPanel from "@/components/aegis/stress/StressImpactPanel";
import StressScenarioCard from "@/components/aegis/stress/StressScenarioCard";
import type { StressScenario } from "@/src/lib/scoring/types";

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

type PanelMode = "loading" | "empty" | "ready" | "error";

interface AdvisorClientStressTestsPanelProps {
  clientId: string;
}

export default function AdvisorClientStressTestsPanel({
  clientId,
}: AdvisorClientStressTestsPanelProps) {
  const [mode, setMode] = useState<PanelMode>("loading");
  const [snapshot, setSnapshot] = useState<
    Extract<AdvisorClientStressTestsResponse, { ok: true }> | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] =
    useState<StressScenario>("income_loss");

  useEffect(() => {
    let cancelled = false;

    async function loadStressTests() {
      setMode("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/stress-tests`,
          { cache: "no-store" },
        );

        if (cancelled) return;

        if (response.status === 403 || response.status === 404) {
          setMode("error");
          setErrorMessage("Unable to load stress test results.");
          return;
        }

        const data = (await response.json()) as AdvisorClientStressTestsResponse;

        if (data.ok) {
          setSnapshot(data);
          setMode("ready");
          return;
        }

        if (data.reason === "no_profile") {
          setSnapshot(null);
          setMode("empty");
          return;
        }

        setMode("error");
        setErrorMessage(data.error ?? "Failed to load stress tests.");
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load stress tests.");
      }
    }

    void loadStressTests();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const orderedTests = useMemo(() => {
    if (!snapshot) return [];

    const byScenario = new Map(
      snapshot.stressTests.map((test) => [test.scenario, test]),
    );

    return SCENARIO_ORDER.map((scenario) => byScenario.get(scenario)!).filter(
      Boolean,
    );
  }, [snapshot]);

  const topDamaging = useMemo(() => {
    if (!snapshot) return [];

    return [...snapshot.stressTests]
      .sort((a, b) => a.postStressScore - b.postStressScore)
      .slice(0, 3);
  }, [snapshot]);

  const selectedTest = useMemo(() => {
    return (
      orderedTests.find((test) => test.scenario === selectedScenario) ?? null
    );
  }, [orderedTests, selectedScenario]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading stress test results…
        </p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-6 py-10 text-center">
        <p className="text-sm font-light text-red-200/80">
          {errorMessage ?? "Unable to load stress test results."}
        </p>
      </div>
    );
  }

  if (mode === "empty" || !snapshot || !selectedTest) {
    return (
      <div className="space-y-4">
        <AdvisorClientReadOnlyBanner />
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-12 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/50">
            This client has not completed Discover yet. Stress test results will
            appear here once a current shield score exists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdvisorClientReadOnlyBanner />

      <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/35 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
          Stress Testing
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/55">
          Read-only view of scenario impacts at the client&apos;s stored
          severity levels. Advisers cannot run new scenarios on behalf of the
          client.
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/30">
          Profile from{" "}
          {new Date(snapshot.completedAt).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <section className="rounded-sm border border-[#D1A866]/15 bg-[#1A2A2B]/25 p-5">
        <div className="mb-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Highest-impact scenarios
          </p>
          <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/50">
            The three events that lower this client&apos;s Shield score the most
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
        preStressRating={snapshot.shield.rating}
      />

      <section>
        <div className="mb-4 border-b border-[#D1A866]/10 pb-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            All scenarios
          </p>
          <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]/55">
            Select a scenario to review the impact on this client&apos;s Shield
            score
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

      <StressHistoryPanel runs={snapshot.history} />
    </div>
  );
}
