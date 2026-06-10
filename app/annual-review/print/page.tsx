"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatScore } from "@/components/aegis/ShieldScoreCard";
import ReportActionPlan from "@/components/aegis/reports/ReportActionPlan";
import ReportCoverPage from "@/components/aegis/reports/ReportCoverPage";
import ReportDisclaimer from "@/components/aegis/reports/ReportDisclaimer";
import ReportPrintShell from "@/components/aegis/reports/ReportPrintShell";
import ReportScoreSummary from "@/components/aegis/reports/ReportScoreSummary";
import ReportSection from "@/components/aegis/reports/ReportSection";
import {
  applyRoadmapStatuses,
  computeAnnualReviewFromProfile,
  loadDiscoverProfile,
  loadRoadmapStatuses,
  PILLAR_LABELS,
  type AnnualReviewPageResults,
  type RoadmapItemStatus,
} from "@/lib/aegis/localProfile";
import type { AnnualReviewSnapshot } from "@/lib/supabase/moduleQueries";
import { calculateProjectedShield } from "@/src/lib/scoring";
import type { StressTestResult } from "@/src/lib/scoring/types";

const SCENARIO_LABELS: Record<StressTestResult["scenario"], string> = {
  income_loss: "Income Loss",
  critical_illness: "Critical Illness",
  death_event: "Death Event",
  disability: "Disability",
  market_crash: "Market Crash",
  inflation_shock: "Inflation Shock",
  longevity: "Longevity",
  business_failure: "Business Failure",
  parent_care: "Parent Care",
  estate_delay: "Estate Transfer Delay",
};

type PrintMode = "loading" | "empty" | "ready";

function cloudSnapshotToResults(
  snapshot: AnnualReviewSnapshot,
  statuses: Record<string, RoadmapItemStatus>,
): AnnualReviewPageResults {
  const roadmap = applyRoadmapStatuses(snapshot.roadmap, statuses);
  const projected = calculateProjectedShield(
    snapshot.shield.pillarScores,
    roadmap.map((item) => ({ ...item, status: "completed" as const })),
    snapshot.shield.dataConfidenceFactor,
  );

  return {
    shield: snapshot.shield,
    awri: snapshot.awri,
    projected,
    roadmap,
    timeline: snapshot.timeline,
    topStressExposures: snapshot.topStressExposures,
    weakestPillars: snapshot.weakestPillars,
    discoverScore: snapshot.discoverScore,
    dataConfidenceFactor: snapshot.dataConfidenceFactor,
    totalImprovement:
      projected.projectedAdjustedShieldScore -
      snapshot.shield.adjustedShieldScore,
    client: snapshot.client,
    formData: snapshot.formData,
    completedAt: snapshot.completedAt,
  };
}

function buildReviewHighlights(results: AnnualReviewPageResults): {
  changed: string[];
  reviewNext: string[];
} {
  const {
    shield,
    projected,
    totalImprovement,
    weakestPillars,
    roadmap,
    topStressExposures,
  } = results;

  const completedCount = roadmap.filter((item) => item.status === "completed").length;
  const inProgressCount = roadmap.filter(
    (item) => item.status === "in_progress",
  ).length;
  const primaryPillar = weakestPillars[0];

  const changed: string[] = [
    `Shield score is ${formatScore(shield.adjustedShieldScore)} (${shield.rating}) based on your latest profile.`,
  ];

  if (completedCount > 0) {
    changed.push(
      `${completedCount} roadmap milestone${completedCount === 1 ? "" : "s"} marked complete.`,
    );
  }

  if (totalImprovement > 0) {
    changed.push(
      `Completing your roadmap could raise your score toward ${formatScore(projected.projectedAdjustedShieldScore)}.`,
    );
  }

  const reviewNext: string[] = [];

  if (primaryPillar) {
    reviewNext.push(
      `Focus on ${primaryPillar.label} (score ${formatScore(primaryPillar.score)}).`,
    );
  }

  if (inProgressCount > 0) {
    reviewNext.push(
      `Continue ${inProgressCount} in-progress roadmap action${inProgressCount === 1 ? "" : "s"}.`,
    );
  } else if (roadmap.length > 0 && completedCount < roadmap.length) {
    reviewNext.push("Start your top roadmap milestone.");
  }

  if (topStressExposures.length > 0) {
    const label = SCENARIO_LABELS[topStressExposures[0].scenario];
    reviewNext.push(`Revisit stress testing for "${label}".`);
  }

  reviewNext.push(
    "Refresh Discover if your income, protection, or family situation has changed.",
  );

  return { changed, reviewNext };
}

export default function AnnualReviewPrintPage() {
  return (
    <Suspense
      fallback={
        <ReportPrintShell backHref="/annual-review" backLabel="Back to Annual Review">
          <p className="py-16 text-center text-sm text-[#10283A]/45">
            Preparing review for export…
          </p>
        </ReportPrintShell>
      }
    >
      <AnnualReviewPrintContent />
    </Suspense>
  );
}

function AnnualReviewPrintContent() {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [mode, setMode] = useState<PrintMode>("loading");
  const [results, setResults] = useState<AnnualReviewPageResults | null>(null);
  const [statuses, setStatuses] = useState<Record<string, RoadmapItemStatus>>(
    {},
  );

  useEffect(() => {
    setStatuses(loadRoadmapStatuses());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/annual-review/current", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.status === 401) {
          const saved = loadDiscoverProfile();
          if (saved) {
            setResults(computeAnnualReviewFromProfile(saved, statuses));
            setMode("ready");
          } else {
            setMode("empty");
          }
          return;
        }

        const data = (await response.json()) as
          | ({ ok: true } & AnnualReviewSnapshot)
          | { ok: false };

        if (data.ok) {
          setResults(cloudSnapshotToResults(data, statuses));
          setMode("ready");
          return;
        }

        const saved = loadDiscoverProfile();
        if (saved) {
          setResults(computeAnnualReviewFromProfile(saved, statuses));
          setMode("ready");
        } else {
          setMode("empty");
        }
      } catch {
        if (cancelled) return;
        const saved = loadDiscoverProfile();
        if (saved) {
          setResults(computeAnnualReviewFromProfile(saved, statuses));
          setMode("ready");
        } else {
          setMode("empty");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [statuses]);

  const clientName = useMemo(() => {
    if (!results) return "Client";
    return (
      [
        results.formData.personal.firstName,
        results.formData.personal.lastName,
      ]
        .filter(Boolean)
        .join(" ") || "Client"
    );
  }, [results]);

  const reportDate = useMemo(() => {
    if (!results) {
      return new Date().toLocaleDateString("en-SG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return new Date(results.completedAt).toLocaleDateString("en-SG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [results]);

  if (mode === "loading") {
    return (
      <ReportPrintShell backHref="/annual-review" backLabel="Back to Annual Review">
        <p className="py-16 text-center text-sm text-[#10283A]/45">
          Preparing review for export…
        </p>
      </ReportPrintShell>
    );
  }

  if (mode === "empty" || !results) {
    return (
      <ReportPrintShell backHref="/annual-review" backLabel="Back to Annual Review">
        <div className="py-16 text-center">
          <p className="text-base font-light text-[#10283A]">
            No Annual Review data available
          </p>
          <p className="mt-3 text-sm text-[#10283A]/55">
            Complete Discover™ and open your Annual Review before exporting.
          </p>
        </div>
      </ReportPrintShell>
    );
  }

  const highlights = buildReviewHighlights(results);
  const completedCount = results.roadmap.filter(
    (item) => item.status === "completed",
  ).length;
  const primaryGap = results.weakestPillars[0];

  return (
    <ReportPrintShell
      backHref="/annual-review"
      backLabel="Back to Annual Review"
      autoPrint={autoPrint}
    >
      <ReportCoverPage
        reportType="Annual Shield Review"
        reportTitle="Annual Shield Review™"
        clientName={clientName}
        generatedDate={reportDate}
        subtitle="Year-ahead summary · Plain-language review"
      />

      <ReportSection label="Section 1" title="Current Score Position">
        <ReportScoreSummary
          adjustedShieldScore={results.shield.adjustedShieldScore}
          rawShieldScore={results.shield.rawShieldScore}
          rating={results.shield.rating}
          awri={results.awri.awri}
          awriRating={results.awri.rating}
          discoverScore={results.discoverScore}
          dataConfidenceFactor={results.dataConfidenceFactor}
          projectedScore={results.projected.projectedAdjustedShieldScore}
          projectedRating={results.projected.projectedRating}
          scoreMovement={results.totalImprovement}
        />
      </ReportSection>

      <ReportSection
        label="Section 2"
        title="Progress Overview"
        pageBreakBefore
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {results.timeline.map((year) => (
            <div
              key={year.calendarYear}
              className="border border-[#10283A]/10 px-4 py-4"
            >
              <p className="text-[9px] uppercase tracking-[0.12em] text-[#10283A]/45">
                {year.label}
              </p>
              <p className="mt-1 font-mono text-lg tabular-nums text-[#10283A]">
                {formatScore(year.adjustedShieldScore)}
                <span className="ml-2 text-sm text-[#10283A]/50">
                  {year.rating}
                </span>
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#10283A]/40">
                {year.actionsCompleted} actions · {year.progressPercent}% progress
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 border border-[#10283A]/10 px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#10283A]/45">
            Roadmap completion
          </p>
          <p className="mt-2 text-sm text-[#10283A]/75">
            {completedCount} of {results.roadmap.length} actions completed
          </p>
        </div>
      </ReportSection>

      <ReportSection
        label="Section 3"
        title="What Changed"
        pageBreakBefore
      >
        <ul className="space-y-2">
          {highlights.changed.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-sm font-light leading-relaxed text-[#10283A]/80"
            >
              <span className="text-emerald-700">·</span>
              {item}
            </li>
          ))}
        </ul>
      </ReportSection>

      <ReportSection
        label="Section 4"
        title="What to Review Next"
        pageBreakBefore
      >
        <ul className="space-y-2">
          {highlights.reviewNext.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-sm font-light leading-relaxed text-[#10283A]/80"
            >
              <span className="text-[#B8860B]">→</span>
              {item}
            </li>
          ))}
        </ul>

        {primaryGap ? (
          <div className="mt-6 border border-[#D1A866]/30 bg-[#F8F7F4] px-5 py-4">
            <p className="text-[9px] uppercase tracking-[0.15em] text-[#B8860B]">
              Primary Architecture Focus
            </p>
            <p className="mt-2 text-sm text-[#10283A]/75">
              {PILLAR_LABELS[primaryGap.pillar]} pillar · Score{" "}
              {formatScore(primaryGap.score)}
            </p>
          </div>
        ) : null}
      </ReportSection>

      <ReportSection
        label="Section 5"
        title="Stress Review"
        pageBreakBefore
      >
        {results.topStressExposures.length === 0 ? (
          <p className="text-sm text-[#10283A]/50">
            No stress test exposures recorded for this review.
          </p>
        ) : (
          <ul className="space-y-2">
            {results.topStressExposures.map((test) => {
              const impact = test.preStressScore - test.postStressScore;
              return (
                <li
                  key={test.scenario}
                  className="flex items-center justify-between border border-[#10283A]/10 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-[#10283A]">
                      {SCENARIO_LABELS[test.scenario]}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#10283A]/40">
                      {test.severity} · post-stress{" "}
                      {formatScore(test.postStressScore)}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-[#10283A]/70">
                    −{formatScore(impact)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ReportSection>

      <ReportSection
        label="Section 6"
        title="Roadmap Review"
        pageBreakBefore
      >
        <ReportActionPlan items={results.roadmap} />
      </ReportSection>

      <ReportDisclaimer />

      <footer className="report-print-avoid-break mt-10 border-t border-[#10283A]/10 pt-6 text-center">
        <p className="text-[9px] uppercase tracking-[0.2em] text-[#10283A]/35">
          AEGIS Annual Shield Review™ · Confidential · Generated {reportDate}
        </p>
      </footer>
    </ReportPrintShell>
  );
}
