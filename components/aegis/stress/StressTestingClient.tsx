"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/components/aegis/ShieldScoreCard";
import StressEmptyState from "@/components/aegis/stress/StressEmptyState";
import StressImpactPanel from "@/components/aegis/stress/StressImpactPanel";
import StressScenarioCard from "@/components/aegis/stress/StressScenarioCard";
import StressSeveritySelector from "@/components/aegis/stress/StressSeveritySelector";
import {
  computeStressTestingFromProfile,
  loadDiscoverProfile,
  type DiscoverStoredProfile,
  type StressTestingPageResults,
} from "@/lib/aegis/localProfile";
import type { StressScenario, StressSeverity } from "@/src/lib/scoring/types";

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

type StressMode = "loading" | "empty" | "live";

export default function StressTestingClient() {
  const [mode, setMode] = useState<StressMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [severity, setSeverity] = useState<StressSeverity>("moderate");
  const [selectedScenario, setSelectedScenario] =
    useState<StressScenario>("income_loss");

  useEffect(() => {
    const saved = loadDiscoverProfile();
    setProfile(saved);
    setMode(saved ? "live" : "empty");
  }, []);

  const results: StressTestingPageResults | null = useMemo(() => {
    if (mode !== "live" || !profile) return null;
    return computeStressTestingFromProfile(profile, severity);
  }, [mode, profile, severity]);

  const orderedTests = useMemo(() => {
    if (!results) return [];
    const byScenario = new Map(
      results.stressTests.map((test) => [test.scenario, test])
    );
    return SCENARIO_ORDER.map(
      (scenario) => byScenario.get(scenario)!
    ).filter(Boolean);
  }, [results]);

  const topDamaging = useMemo(() => {
    if (!results) return [];
    return [...results.stressTests]
      .sort((a, b) => a.postStressScore - b.postStressScore)
      .slice(0, 3);
  }, [results]);

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

  return (
    <>
      <header className="mb-8 border-b border-[#D1A866]/15 pb-6 sm:mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
              Live Discover Profile
            </span>
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
        <StressSeveritySelector value={severity} onChange={setSeverity} />

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
      </div>
    </>
  );
}
