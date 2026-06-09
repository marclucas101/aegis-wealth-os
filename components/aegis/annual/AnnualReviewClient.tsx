"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatScore } from "@/components/aegis/ShieldScoreCard";
import AnnualReviewEmptyState from "@/components/aegis/annual/AnnualReviewEmptyState";
import AnnualReviewProgressPanel from "@/components/aegis/annual/AnnualReviewProgressPanel";
import AnnualReviewRoadmapSummary from "@/components/aegis/annual/AnnualReviewRoadmapSummary";
import AnnualReviewScoreCard from "@/components/aegis/annual/AnnualReviewScoreCard";
import AnnualReviewStressSummary from "@/components/aegis/annual/AnnualReviewStressSummary";
import AnnualReviewTimeline from "@/components/aegis/annual/AnnualReviewTimeline";
import {
  computeAnnualReviewFromProfile,
  loadDiscoverProfile,
  loadRoadmapStatuses,
  PILLAR_LABELS,
  type AnnualReviewPageResults,
  type DiscoverStoredProfile,
} from "@/lib/aegis/localProfile";

type AnnualReviewMode = "loading" | "empty" | "live";

function buildAnnualReviewNarrative(results: AnnualReviewPageResults): string[] {
  const {
    shield,
    awri,
    weakestPillars,
    projected,
    totalImprovement,
    dataConfidenceFactor,
    topStressExposures,
    roadmap,
  } = results;

  const weakestLabels = weakestPillars.map((p) => p.label).join(", ");
  const primaryPillar = weakestPillars[0];
  const confidencePct = Math.round(dataConfidenceFactor * 100);
  const completedCount = roadmap.filter((item) => item.status === "completed").length;

  const paragraphs: string[] = [];

  paragraphs.push(
    `The client's current architecture is functional, with improvement potential concentrated in ${weakestLabels}. The composite Adjusted Shield Score of ${formatScore(shield.adjustedShieldScore)} reflects a ${shield.rating} rating, indicating a ${shield.rating === "AAA" || shield.rating === "AA" ? "well-structured position with meaningful resilience across core pillars" : shield.rating === "A" || shield.rating === "BBB" ? "broadly sound structure with identifiable refinement opportunities" : "developing architecture with clear areas for measured structural advancement"}.`
  );

  if (primaryPillar) {
    paragraphs.push(
      `Primary architecture attention is directed toward the ${primaryPillar.label} pillar, which scores ${formatScore(primaryPillar.score)} in the current diagnostic. This area defines the strategic concentration for wealth architecture progression over the annual review cycle.`
    );
  }

  paragraphs.push(
    `The Architecture Wealth Resilience Index (AWRI™) stands at ${formatScore(awri.awri)}, incorporating resilience, behavioural discipline, governance maturity, and continuity planning alongside the core shield assessment. This composite measure provides a broader view of architectural readiness beyond pillar scores alone.`
  );

  if (totalImprovement > 0) {
    paragraphs.push(
      `Implementation of the prioritised roadmap over the review horizon is projected to advance the Adjusted Shield Score from ${formatScore(shield.adjustedShieldScore)} to ${formatScore(projected.projectedAdjustedShieldScore)}, representing an estimated improvement of ${formatScore(totalImprovement)} points. This projection assumes sequential completion of identified actions within their respective timelines and reflects architectural progression rather than a guaranteed outcome.`
    );
  } else {
    paragraphs.push(
      `The current architecture demonstrates relative balance across pillars. Continued monitoring and periodic review are recommended to maintain structural integrity as circumstances evolve.`
    );
  }

  if (topStressExposures.length > 0) {
    const exposureLabels = topStressExposures
      .slice(0, 3)
      .map((test) => test.scenario.replace(/_/g, " "))
      .join(", ");
    paragraphs.push(
      `Stress testing indicates the most notable disruption sensitivities relate to ${exposureLabels}. These exposures inform monitoring priorities within the annual review framework and should be assessed alongside roadmap progression.`
    );
  }

  paragraphs.push(
    `This assessment is based on client-provided information with a data confidence factor of ${confidencePct}%. ${completedCount > 0 ? `${completedCount} roadmap action${completedCount === 1 ? " has" : "s have"} been marked as completed, informing the current progression baseline.` : "Roadmap actions remain at initial status; progression projections reflect planned implementation sequencing."} This review is prepared for architectural assessment purposes and does not constitute financial, legal, or tax advice.`
  );

  return paragraphs;
}

export default function AnnualReviewClient() {
  const [mode, setMode] = useState<AnnualReviewMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [statuses, setStatuses] = useState(loadRoadmapStatuses);

  useEffect(() => {
    const saved = loadDiscoverProfile();
    setProfile(saved);
    setStatuses(loadRoadmapStatuses());
    setMode(saved ? "live" : "empty");
  }, []);

  const results: AnnualReviewPageResults | null = useMemo(() => {
    if (mode !== "live" || !profile) return null;
    return computeAnnualReviewFromProfile(profile, statuses);
  }, [mode, profile, statuses]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Preparing annual review…
        </p>
      </div>
    );
  }

  if (mode === "empty" || !results) {
    return <AnnualReviewEmptyState />;
  }

  const narrative = buildAnnualReviewNarrative(results);
  const reviewDate = new Date(results.completedAt).toLocaleDateString("en-SG", {
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

  const primaryGap = results.weakestPillars[0];

  return (
    <article className="mx-auto max-w-5xl">
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
                Annual Shield Review™
              </h1>
              <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
                Four-year architecture progression · Institutional review
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
                Prepared For
              </p>
              <p className="mt-1 text-sm text-[#F3F1EA]">{clientName}</p>
              <p className="mt-3 text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
                Review Date
              </p>
              <p className="mt-1 text-sm text-[#F3F1EA]/70">{reviewDate}</p>
              <p className="mt-3 font-mono text-xs tabular-nums text-[#D1A866]/70">
                Net Worth {formatCurrency(results.client.netWorth)}
              </p>
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

      <div className="flex flex-col gap-8 sm:gap-10">
        <AnnualReviewTimeline timeline={results.timeline} />

        <AnnualReviewScoreCard results={results} />

        <AnnualReviewProgressPanel results={results} />

        <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#1A2A2B]/40">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
          <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

          <div className="relative border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Annual Review Narrative
            </p>
            <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
              Architecture assessment overview
            </h3>
            <p className="mt-1 text-xs text-[#F3F1EA]/40">
              Institutional review language · Calm diagnostic framing
            </p>
          </div>

          <div className="relative space-y-5 px-6 py-6 sm:px-8 sm:py-8">
            {narrative.map((paragraph, index) => (
              <p
                key={index}
                className="text-sm font-light leading-[1.85] text-[#F3F1EA]/75"
              >
                {paragraph}
              </p>
            ))}

            {primaryGap && (
              <div className="mt-6 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 px-5 py-4">
                <p className="text-[9px] uppercase tracking-[0.15em] text-[#D1A866]/60">
                  Primary Architecture Focus
                </p>
                <p className="mt-2 text-sm text-[#F3F1EA]/70">
                  {PILLAR_LABELS[primaryGap.pillar]} pillar · Score{" "}
                  {formatScore(primaryGap.score)} · Concentrated improvement area
                </p>
              </div>
            )}
          </div>
        </section>

        <AnnualReviewStressSummary
          topExposures={results.topStressExposures}
          preStressScore={results.shield.adjustedShieldScore}
        />

        <AnnualReviewRoadmapSummary roadmap={results.roadmap} />
      </div>

      <footer className="mt-12 border-t border-[#D1A866]/15 pt-8 sm:mt-16">
        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
          AEGIS Annual Shield Review™ · Confidential · For architectural review only
        </p>
        <p className="mt-2 text-center text-xs font-light text-[#F3F1EA]/30">
          This document does not constitute financial, legal, or tax advice.
        </p>
      </footer>
    </article>
  );
}
