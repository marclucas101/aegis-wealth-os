"use client";

import { useEffect, useState } from "react";

import AdvisorMetricCard from "@/components/aegis/advisor/AdvisorMetricCard";
import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AdvisorOverview } from "@/lib/supabase/advisorQueries";
import type { AdvisorReviewPipeline } from "@/lib/supabase/advisorReviewPipeline";

interface AdvisorBookHealthPanelProps {
  overview: AdvisorOverview;
}

type LoadState = "loading" | "ready" | "error";

export default function AdvisorBookHealthPanel({
  overview,
}: AdvisorBookHealthPanelProps) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [pipelineSummary, setPipelineSummary] =
    useState<AdvisorReviewPipeline["summary"] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPipelineSummary() {
      try {
        const response = await fetch("/api/advisor/review-pipeline", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (!response.ok) {
          setLoadState("error");
          return;
        }

        const data = (await response.json()) as
          | ({ ok: true } & AdvisorReviewPipeline)
          | { ok: false };

        if (!data.ok) {
          setLoadState("error");
          return;
        }

        setPipelineSummary(data.summary);
        setLoadState("ready");
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    void loadPipelineSummary();

    return () => {
      cancelled = true;
    };
  }, []);

  const reviewDueCount =
    pipelineSummary != null
      ? pipelineSummary.dueThisMonthCount
      : null;
  const reviewOverdueCount =
    pipelineSummary != null ? pipelineSummary.overdueCount : null;

  return (
    <section
      className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Book Health
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Portfolio quality, servicing cadence, and document activity across
          your mandate.
        </p>
      </div>

      <div className="relative grid gap-3 px-5 py-5 sm:grid-cols-2">
        <AdvisorMetricCard
          label="Average Shield Score"
          value={
            overview.averageShieldScore != null
              ? formatScore(overview.averageShieldScore)
              : "—"
          }
          highlight
          compact
        />
        <AdvisorMetricCard
          label="High-risk clients"
          value={overview.highRiskClients}
          sublabel="Shield, stress, or review signals"
          alert={overview.highRiskClients > 0}
          compact
        />
        <AdvisorMetricCard
          label="Onboarding clients"
          value={overview.onboardingClients}
          sublabel={`${overview.activeClients} active in book`}
          compact
        />
        <AdvisorMetricCard
          label="Reviews due this month"
          value={
            loadState === "loading"
              ? "…"
              : reviewDueCount != null
                ? reviewDueCount
                : "—"
          }
          sublabel={
            loadState === "ready" && reviewOverdueCount != null
              ? `${reviewOverdueCount} overdue`
              : "Annual review servicing"
          }
          alert={
            loadState === "ready" &&
            reviewOverdueCount != null &&
            reviewOverdueCount > 0
          }
          compact
        />
        <AdvisorMetricCard
          label="Documents uploaded"
          value={overview.documentsUploaded}
          sublabel={`${overview.pendingRoadmapItems} pending roadmap items`}
          compact
          className="sm:col-span-2"
        />
      </div>

      {loadState === "error" ? (
        <p className="relative px-5 pb-4 text-xs font-light text-[#F3F1EA]/35">
          Review pipeline counts unavailable. Open the pipeline section below
          for full detail.
        </p>
      ) : null}
    </section>
  );
}
