"use client";

import { useEffect, useMemo, useState } from "react";
import BenchmarkCard from "@/components/aegis/BenchmarkCard";
import DashboardEmptyState from "@/components/aegis/DashboardEmptyState";
import PillarBreakdown from "@/components/aegis/PillarBreakdown";
import PriorityGaps from "@/components/aegis/PriorityGaps";
import ShieldRadarChart from "@/components/aegis/ShieldRadarChart";
import ShieldScoreCard, {
  formatCurrency,
} from "@/components/aegis/ShieldScoreCard";
import StressTestPreview from "@/components/aegis/StressTestPreview";
import {
  computeDashboardFromProfile,
  loadDiscoverProfile,
  type DashboardResults,
  type DiscoverStoredProfile,
} from "@/lib/aegis/localProfile";
import {
  mockClientProfile,
  runMockScoringDemo,
} from "@/src/lib/scoring/mockExample";

type DashboardMode = "loading" | "empty" | "live" | "demo";

function ProfileSourceBadge({ mode }: { mode: "live" | "demo" }) {
  const isLive = mode === "live";

  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] ${
        isLive
          ? "border-[#D1A866]/35 bg-[#D1A866]/10 text-[#D1A866]"
          : "border-[#F3F1EA]/15 bg-[#F3F1EA]/5 text-[#F3F1EA]/45"
      }`}
    >
      {isLive ? "Live Discover Profile" : "Demo Profile"}
    </span>
  );
}

export default function DashboardClient() {
  const [mode, setMode] = useState<DashboardMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);

  useEffect(() => {
    const saved = loadDiscoverProfile();
    setProfile(saved);
    setMode(saved ? "live" : "empty");
  }, []);

  const liveResults: DashboardResults | null = useMemo(() => {
    if (mode !== "live" || !profile) return null;
    return computeDashboardFromProfile(profile);
  }, [mode, profile]);

  const demoResults = useMemo(() => runMockScoringDemo(), []);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading dashboard…
        </p>
      </div>
    );
  }

  if (mode === "empty") {
    return <DashboardEmptyState onViewDemo={() => setMode("demo")} />;
  }

  const isLive = mode === "live";
  const shield = isLive && liveResults ? liveResults.shield : demoResults.shield;
  const awri = isLive && liveResults ? liveResults.awri : demoResults.awri;
  const benchmark =
    isLive && liveResults ? liveResults.benchmark : demoResults.benchmark;
  const stressTests =
    isLive && liveResults ? liveResults.stressTests : demoResults.stressTests;
  const roadmap =
    isLive && liveResults ? liveResults.roadmap : demoResults.roadmap;
  const insights =
    isLive && liveResults ? liveResults.insights : demoResults.insights;
  const client =
    isLive && liveResults ? liveResults.client : mockClientProfile;
  const completedAt =
    isLive && liveResults ? liveResults.completedAt : null;

  return (
    <>
      <header className="mb-8 border-b border-[#D1A866]/15 pb-6 sm:mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3">
            <ProfileSourceBadge mode={isLive ? "live" : "demo"} />
            <p className="text-sm text-[#F3F1EA]/45">
              Composite shield overview and architecture monitoring
            </p>
          </div>

          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
              Client Profile
            </p>
            <p className="mt-1 text-sm text-[#F3F1EA]">
              {client.occupation ?? "Client"} · Age {client.age}
            </p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-[#D1A866]/70">
              Net Worth {formatCurrency(client.netWorth)}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <ShieldScoreCard shield={shield} awri={awri} />

        <div className="grid gap-6 lg:grid-cols-2">
          <ShieldRadarChart pillarScores={shield.pillarScores} />
          <PillarBreakdown
            pillarScores={shield.pillarScores}
            weakestPillar={insights.weakestPillar}
            strongestPillar={insights.strongestPillar}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <BenchmarkCard benchmark={benchmark} />
          <StressTestPreview stressTests={stressTests} />
        </div>

        <PriorityGaps roadmap={roadmap} />
      </div>

      <footer className="mt-10 border-t border-[#D1A866]/10 pt-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
          AEGIS Shield Diagnostic™ · {isLive ? "Live Profile" : "Mock Demo"}
          {completedAt
            ? ` · Captured ${new Date(completedAt).toLocaleDateString("en-SG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}`
            : ""}
        </p>
      </footer>
    </>
  );
}
