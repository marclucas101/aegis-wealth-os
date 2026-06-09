"use client";

import { useEffect, useMemo, useState } from "react";
import BlueprintClientProfile from "@/components/aegis/blueprint/BlueprintClientProfile";
import BlueprintEmptyState from "@/components/aegis/blueprint/BlueprintEmptyState";
import BlueprintExecutiveSummary from "@/components/aegis/blueprint/BlueprintExecutiveSummary";
import BlueprintPillarAnalysis from "@/components/aegis/blueprint/BlueprintPillarAnalysis";
import BlueprintRoadmapSummary from "@/components/aegis/blueprint/BlueprintRoadmapSummary";
import BlueprintScoreOverview from "@/components/aegis/blueprint/BlueprintScoreOverview";
import BlueprintStressSummary from "@/components/aegis/blueprint/BlueprintStressSummary";
import {
  computeBlueprintFromProfile,
  loadDiscoverProfile,
  type BlueprintPageResults,
  type DiscoverStoredProfile,
} from "@/lib/aegis/localProfile";

type BlueprintMode = "loading" | "empty" | "live";

export default function WealthBlueprintClient() {
  const [mode, setMode] = useState<BlueprintMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);

  useEffect(() => {
    const saved = loadDiscoverProfile();
    setProfile(saved);
    setMode(saved ? "live" : "empty");
  }, []);

  const results: BlueprintPageResults | null = useMemo(() => {
    if (mode !== "live" || !profile) return null;
    return computeBlueprintFromProfile(profile);
  }, [mode, profile]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Preparing report preview…
        </p>
      </div>
    );
  }

  if (mode === "empty" || !results) {
    return <BlueprintEmptyState />;
  }

  const reportDate = new Date(results.completedAt).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const clientName =
    [
      results.formData.personal.firstName,
      results.formData.personal.lastName,
    ]
      .filter(Boolean)
      .join(" ") || "Client";

  return (
    <article className="mx-auto max-w-5xl">
      {/* Report header */}
      <header className="relative mb-10 overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80 pb-8 pt-10 sm:mb-12 sm:pb-10 sm:pt-12">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/8 via-transparent to-[#1A2A2B]/20" />
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/60 to-transparent" />

        <div className="relative px-6 sm:px-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#D1A866]/80">
                AEGIS Wealth Operating System™
              </p>
              <h1 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
                Wealth Architecture Blueprint™
              </h1>
              <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
                Institutional Diagnostic Report · Preview Edition
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
                Prepared For
              </p>
              <p className="mt-1 text-sm text-[#F3F1EA]">{clientName}</p>
              <p className="mt-3 text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
                Report Date
              </p>
              <p className="mt-1 text-sm text-[#F3F1EA]/70">{reportDate}</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-[#D1A866]/10 pt-6">
            <span className="inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
              Live Discover Profile
            </span>
            <span className="text-xs text-[#F3F1EA]/35">
              Shield Rating {results.shield.rating} · Confidential
            </span>
          </div>
        </div>
      </header>

      {/* Report sections */}
      <div className="flex flex-col gap-8 sm:gap-10">
        <BlueprintClientProfile
          client={results.client}
          formData={results.formData}
          completedAt={results.completedAt}
        />

        <BlueprintExecutiveSummary results={results} />

        <BlueprintScoreOverview
          shield={results.shield}
          awri={results.awri}
        />

        <BlueprintPillarAnalysis
          pillarScores={results.shield.pillarScores}
          weakestPillars={results.weakestPillars}
        />

        <BlueprintStressSummary
          topExposures={results.topStressExposures}
          preStressScore={results.shield.adjustedShieldScore}
        />

        <BlueprintRoadmapSummary
          shield={results.shield}
          projected={results.projected}
          roadmap={results.roadmap}
        />
      </div>

      {/* Report footer & export */}
      <footer className="mt-12 border-t border-[#D1A866]/15 pt-8 sm:mt-16">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
              AEGIS Wealth Blueprint™ · Confidential · For architectural review only
            </p>
            <p className="mt-2 text-xs font-light text-[#F3F1EA]/30">
              This document does not constitute financial, legal, or tax advice.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-sm border border-[#D1A866]/20 bg-[#1A2A2B]/40 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/35"
            aria-disabled="true"
            title="PDF export will be available in a future release"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 opacity-50"
              aria-hidden
            >
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            PDF Export Coming Soon
          </button>
        </div>
      </footer>
    </article>
  );
}
