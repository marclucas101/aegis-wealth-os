"use client";

import { useEffect, useMemo, useState } from "react";
import BenchmarkCard from "@/components/aegis/BenchmarkCard";
import DashboardEmptyState from "@/components/aegis/DashboardEmptyState";
import ClientJourneyProgress from "@/components/aegis/client/ClientJourneyProgress";
import ClientModuleCard from "@/components/aegis/client/ClientModuleCard";
import ClientNextBestAction from "@/components/aegis/client/ClientNextBestAction";
import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import PillarBreakdown from "@/components/aegis/PillarBreakdown";
import PriorityGaps from "@/components/aegis/PriorityGaps";
import ShieldRadarChart from "@/components/aegis/ShieldRadarChart";
import ShieldScoreCard, { formatScore } from "@/components/aegis/ShieldScoreCard";
import StressTestPreview from "@/components/aegis/StressTestPreview";
import {
  buildJourneySteps,
  buildModuleCards,
  getNextBestAction,
} from "@/lib/aegis/clientJourney";
import {
  computeDashboardFromProfile,
  loadDiscoverProfile,
  type DashboardResults,
  type DiscoverStoredProfile,
} from "@/lib/aegis/localProfile";
import type { DashboardSnapshot } from "@/lib/supabase/dashboardQueries";
import {
  mockClientProfile,
  runMockScoringDemo,
} from "@/src/lib/scoring/mockExample";

type DashboardMode = "loading" | "empty" | "cloud" | "local" | "demo";
type ProfileSource = "cloud" | "local" | "demo";

function ProfileSourceBadge({ source }: { source: ProfileSource }) {
  const styles: Record<ProfileSource, string> = {
    cloud: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300/90",
    local: "border-[#D1A866]/35 bg-[#D1A866]/10 text-[#D1A866]",
    demo: "border-[#F3F1EA]/15 bg-[#F3F1EA]/5 text-[#F3F1EA]/45",
  };

  const labels: Record<ProfileSource, string> = {
    cloud: "Saved to your account",
    local: "Saved on this device",
    demo: "Demo preview",
  };

  return (
    <span
      className={`mb-3 inline-flex items-center rounded-sm border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] ${styles[source]}`}
    >
      {labels[source]}
    </span>
  );
}

function cloudSnapshotToResults(snapshot: DashboardSnapshot): DashboardResults {
  return {
    shield: snapshot.shield,
    awri: snapshot.awri,
    benchmark: snapshot.benchmark,
    stressTests: snapshot.stressTests,
    roadmap: snapshot.roadmap,
    client: snapshot.client,
    insights: {
      weakestPillar: snapshot.insights.weakestPillar,
      strongestPillar: snapshot.insights.strongestPillar,
      weakestPillars: [],
    },
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

function ShieldScoreExplainer({
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
            Your Shield Score
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/60">
            A single number summarising how well your finances are protected
            across seven pillars — from everyday cash flow to long-term legacy.
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

export default function DashboardClient() {
  const [mode, setMode] = useState<DashboardMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [cloudSnapshot, setCloudSnapshot] = useState<DashboardSnapshot | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard/current", {
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
          | ({ ok: true } & DashboardSnapshot)
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

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const localResults: DashboardResults | null = useMemo(() => {
    if (mode !== "local" || !profile) return null;
    return computeDashboardFromProfile(profile);
  }, [mode, profile]);

  const cloudResults: DashboardResults | null = useMemo(() => {
    if (mode !== "cloud" || !cloudSnapshot) return null;
    return cloudSnapshotToResults(cloudSnapshot);
  }, [mode, cloudSnapshot]);

  const demoResults = useMemo(() => runMockScoringDemo(), []);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading your dashboard…
        </p>
      </div>
    );
  }

  if (mode === "empty") {
    return <DashboardEmptyState onViewDemo={() => setMode("demo")} />;
  }

  const isCloud = mode === "cloud";
  const isLocal = mode === "local";
  const isDemo = mode === "demo";
  const activeResults = isCloud
    ? cloudResults
    : isLocal
      ? localResults
      : null;

  const shield = activeResults?.shield ?? demoResults.shield;
  const awri = activeResults?.awri ?? demoResults.awri;
  const benchmark = activeResults?.benchmark ?? demoResults.benchmark;
  const stressTests = activeResults?.stressTests ?? demoResults.stressTests;
  const roadmap = activeResults?.roadmap ?? demoResults.roadmap;
  const insights = activeResults?.insights ?? demoResults.insights;
  const client = activeResults?.client ?? mockClientProfile;
  const completedAt = activeResults?.completedAt ?? null;

  const profileSource: ProfileSource = isCloud
    ? "cloud"
    : isLocal
      ? "local"
      : "demo";

  const footerLabel = isCloud
    ? "Cloud Profile"
    : isLocal
      ? "Local Profile"
      : "Demo Preview";

  const roadmapCompleted = roadmap.filter(
    (item) => item.status === "completed",
  ).length;

  const journeyState = {
    hasProfile: !isDemo,
    hasShield: true,
    roadmapCompletedCount: roadmapCompleted,
    roadmapTotalCount: roadmap.length,
  };

  const journeySteps = buildJourneySteps(journeyState);
  const nextAction = getNextBestAction(journeyState);
  const moduleCards = buildModuleCards(journeyState);

  return (
    <>
      <ClientPortalHeader
        eyebrow="Shield Dashboard"
        title="Your financial shield at a glance"
        subtitle="Track your score, see where you're strong, and focus on what matters most — explained clearly, without jargon."
        clientDetail={
          client.occupation
            ? `${client.occupation} · Age ${client.age}`
            : `Age ${client.age}`
        }
        netWorth={client.netWorth}
        badge={<ProfileSourceBadge source={profileSource} />}
      />

      <div className="mb-8 flex flex-col gap-6">
        <ClientJourneyProgress steps={journeySteps} compact />
        <ClientNextBestAction
          action={nextAction}
          secondaryHref="/shield-diagnostic"
          secondaryLabel="Review diagnostic"
        />
      </div>

      <ShieldScoreExplainer
        score={shield.adjustedShieldScore}
        rating={shield.rating}
        confidence={shield.dataConfidenceFactor}
      />

      <div className="mt-6 flex flex-col gap-6">
        <ShieldScoreCard shield={shield} awri={awri} />

        <div className="grid gap-6 lg:grid-cols-2">
          <ShieldRadarChart pillarScores={shield.pillarScores} />
          <PillarBreakdown
            pillarScores={shield.pillarScores}
            weakestPillar={insights.weakestPillar}
            strongestPillar={insights.strongestPillar}
          />
        </div>

        <section>
          <div className="mb-4 border-b border-[#D1A866]/10 pb-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Priority gaps
            </p>
            <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/50">
              The three actions most likely to strengthen your shield — start
              with your Wealth Roadmap to track progress.
            </p>
          </div>
          <PriorityGaps roadmap={roadmap} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <BenchmarkCard benchmark={benchmark} />
          <StressTestPreview stressTests={stressTests} />
        </div>

        <section>
          <div className="mb-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Explore modules
            </p>
            <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/50">
              Continue your journey across reports, scenarios, and secure
              documents.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {moduleCards.slice(0, 6).map((module) => (
              <ClientModuleCard key={module.id} {...module} />
            ))}
          </div>
        </section>

        <ClientTrustNotice variant="full" context="general" />
      </div>

      <footer className="mt-10 border-t border-[#D1A866]/10 pt-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
          AEGIS Shield Dashboard™ · {footerLabel}
          {completedAt
            ? ` · Updated ${new Date(completedAt).toLocaleDateString("en-SG", {
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
