"use client";

import AdvisorMetricCard from "@/components/aegis/advisor/AdvisorMetricCard";
import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AdvisorOverview } from "@/lib/supabase/advisorQueries";

interface AdvisorCommandMetricsProps {
  overview: AdvisorOverview;
}

export default function AdvisorCommandMetrics({
  overview,
}: AdvisorCommandMetricsProps) {
  return (
    <section aria-label="Book summary metrics" className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
        Executive summary
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdvisorMetricCard
          label="Total clients"
          value={overview.totalClients}
          sublabel={`${overview.activeClients} active · ${overview.onboardingClients} onboarding`}
        />
        <AdvisorMetricCard
          label="Average Shield Score"
          value={
            overview.averageShieldScore != null
              ? formatScore(overview.averageShieldScore)
              : "—"
          }
          highlight
        />
        <AdvisorMetricCard
          label="High-risk clients"
          value={overview.highRiskClients}
          sublabel="Shield, stress, or review signals"
          alert={overview.highRiskClients > 0}
        />
        <AdvisorMetricCard
          label="Pending roadmap items"
          value={overview.pendingRoadmapItems}
          sublabel={`${overview.documentsUploaded} documents uploaded`}
        />
      </div>
    </section>
  );
}
