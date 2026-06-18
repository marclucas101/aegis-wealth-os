"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { AdvisorClientDashboardResponse } from "@/app/api/advisor/clients/[clientId]/dashboard/route";
import BenchmarkCard from "@/components/aegis/BenchmarkCard";
import PillarBreakdown from "@/components/aegis/PillarBreakdown";
import PriorityGaps from "@/components/aegis/PriorityGaps";
import ShieldScoreCard, { formatScore } from "@/components/aegis/ShieldScoreCard";
import StressTestPreview from "@/components/aegis/StressTestPreview";
import AdvisorClientReadOnlyBanner from "@/components/aegis/advisor/AdvisorClientReadOnlyBanner";

const ShieldArchitectureModule = dynamic(
  () => import("@/components/aegis/charts/ShieldArchitectureModule"),
  {
    loading: () => (
      <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-5 py-10 text-center text-sm font-light text-[#F3F1EA]/45">
        Loading shield architecture…
      </div>
    ),
    ssr: false,
  },
);

type PanelMode = "loading" | "empty" | "ready" | "error";

interface AdvisorClientDashboardPanelProps {
  clientId: string;
}

function DashboardScoreExplainer({
  score,
  rating,
  confidence,
}: {
  score: number;
  rating: string;
  confidence: number;
}) {
  return (
    <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/45 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Client Shield Score
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/60">
            Current adjusted score across seven pillars, using the same scoring
            engine as the client dashboard.
          </p>
        </div>
        <div className="flex shrink-0 items-baseline gap-4 sm:text-right">
          <div>
            <p className="font-mono text-3xl font-light tabular-nums text-[#D1A866] sm:text-4xl">
              {formatScore(score)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
              Rating {rating}
            </p>
          </div>
          <div className="hidden h-10 w-px bg-[#D1A866]/15 sm:block" />
          <div className="hidden sm:block">
            <p className="font-mono text-lg tabular-nums text-[#F3F1EA]/70">
              {Math.round(confidence * 100)}%
            </p>
            <p className="text-[10px] uppercase tracking-wider text-[#F3F1EA]/35">
              Data confidence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdvisorClientDashboardPanel({
  clientId,
}: AdvisorClientDashboardPanelProps) {
  const [mode, setMode] = useState<PanelMode>("loading");
  const [snapshot, setSnapshot] = useState<
    Extract<AdvisorClientDashboardResponse, { ok: true }> | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setMode("loading");
      setErrorMessage(null);

      try {
        const response = await fetch(
          `/api/advisor/clients/${clientId}/dashboard`,
          { cache: "no-store" },
        );

        if (cancelled) return;

        if (response.status === 403 || response.status === 404) {
          setMode("error");
          setErrorMessage("Unable to load this client dashboard.");
          return;
        }

        const data = (await response.json()) as AdvisorClientDashboardResponse;

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
        setErrorMessage(data.error ?? "Failed to load client dashboard.");
      } catch {
        if (cancelled) return;
        setMode("error");
        setErrorMessage("Failed to load client dashboard.");
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading client dashboard…
        </p>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="rounded-sm border border-red-400/20 bg-red-400/5 px-6 py-10 text-center">
        <p className="text-sm font-light text-red-200/80">
          {errorMessage ?? "Unable to load client dashboard."}
        </p>
      </div>
    );
  }

  if (mode === "empty" || !snapshot) {
    return (
      <div className="space-y-4">
        <AdvisorClientReadOnlyBanner />
        <div className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/40 px-6 py-12 text-center">
          <p className="text-sm font-light text-[#F3F1EA]/50">
            This client has not completed Discover yet. Their dashboard will
            appear here once a current profile and shield score exist.
          </p>
        </div>
      </div>
    );
  }

  const { shield, protectionCore, awri, benchmark, stressTests, roadmap, insights } =
    snapshot;

  return (
    <div className="space-y-6">
      <AdvisorClientReadOnlyBanner />

      <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/35 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
          Client snapshot
        </p>
        <p className="mt-1 text-sm text-[#F3F1EA]">
          {snapshot.client.occupation
            ? `${snapshot.client.occupation} · Age ${snapshot.client.age}`
            : `Age ${snapshot.client.age}`}
          {snapshot.client.netWorth > 0
            ? ` · Net worth S$${snapshot.client.netWorth.toLocaleString("en-SG")}`
            : ""}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/30">
          Profile updated{" "}
          {new Date(snapshot.completedAt).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>

      <DashboardScoreExplainer
        score={shield.adjustedShieldScore}
        rating={shield.rating}
        confidence={shield.dataConfidenceFactor}
      />

      <ShieldScoreCard shield={shield} awri={awri} />

      <ShieldArchitectureModule
        pillarScores={shield.pillarScores}
        protectionCore={protectionCore}
        roadmap={roadmap}
        weakestPillar={insights.weakestPillar}
        strongestPillar={insights.strongestPillar}
      />

      <PillarBreakdown
        pillarScores={shield.pillarScores}
        weakestPillar={insights.weakestPillar}
        strongestPillar={insights.strongestPillar}
      />

      <section>
        <div className="mb-4 border-b border-[#D1A866]/10 pb-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Priority gaps
          </p>
          <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/50">
            Top roadmap actions from the client&apos;s current profile.
          </p>
        </div>
        <PriorityGaps roadmap={roadmap} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <BenchmarkCard benchmark={benchmark} />
        <StressTestPreview stressTests={stressTests} />
      </div>
    </div>
  );
}
