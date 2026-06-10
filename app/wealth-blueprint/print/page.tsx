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
  computeBlueprintFromProfile,
  loadDiscoverProfile,
  PILLAR_LABELS,
  type BlueprintPageResults,
} from "@/lib/aegis/localProfile";
import type { WealthBlueprintSnapshot } from "@/lib/supabase/moduleQueries";
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

const PILLAR_ORDER = [
  "foundation",
  "protect",
  "grow",
  "optimise",
  "transition",
  "preserve",
  "legacy",
] as const;

type PrintMode = "loading" | "empty" | "ready";

function cloudSnapshotToResults(
  snapshot: WealthBlueprintSnapshot,
): BlueprintPageResults {
  return {
    shield: snapshot.shield,
    awri: snapshot.awri,
    stressTests: snapshot.stressTests,
    topStressExposures: snapshot.topStressExposures,
    roadmap: snapshot.roadmap,
    projected: snapshot.projected,
    weakestPillars: snapshot.weakestPillars,
    client: snapshot.client,
    formData: snapshot.formData,
    completedAt: snapshot.completedAt,
  };
}

function buildExecutiveSummaryParagraphs(results: BlueprintPageResults): string[] {
  const { shield, awri, weakestPillars, projected } = results;
  const weakestLabels = weakestPillars.map((p) => p.label).join(", ");
  const improvement =
    projected.projectedAdjustedShieldScore - shield.adjustedShieldScore;
  const confidencePct = Math.round(shield.dataConfidenceFactor * 100);

  const paragraphs = [
    `This Wealth Architecture Blueprint presents a diagnostic assessment derived from information captured through Discover™. The composite Adjusted Shield Score of ${formatScore(shield.adjustedShieldScore)} reflects a ${shield.rating} rating across seven architecture pillars.`,
    `The Architecture Wealth Resilience Index (AWRI) stands at ${formatScore(awri.awri)}. Primary architecture attention is directed toward ${weakestLabels || "identified pillar gaps"}, which represent the lowest-scoring pillars in the current diagnostic.`,
  ];

  if (improvement > 0) {
    paragraphs.push(
      `Implementation of prioritised roadmap actions is projected to advance the Adjusted Shield Score from ${formatScore(shield.adjustedShieldScore)} to ${formatScore(projected.projectedAdjustedShieldScore)}, representing an estimated improvement of ${formatScore(improvement)} points.`,
    );
  }

  paragraphs.push(
    `This assessment is based on client-provided information with a data confidence factor of ${confidencePct}%.`,
  );

  return paragraphs;
}

function buildPlanningPriorities(results: BlueprintPageResults): string[] {
  const priorities: string[] = [];

  for (const pillar of results.weakestPillars.slice(0, 3)) {
    priorities.push(
      `Strengthen ${pillar.label} pillar (current score ${formatScore(pillar.score)})`,
    );
  }

  const topAction = results.roadmap.find(
    (item) => item.status !== "completed",
  );
  if (topAction) {
    priorities.push(`Begin roadmap action: ${topAction.title}`);
  }

  if (results.topStressExposures[0]) {
    const label = SCENARIO_LABELS[results.topStressExposures[0].scenario];
    priorities.push(`Review stress exposure: ${label}`);
  }

  priorities.push("Schedule review with your qualified wealth advisor");

  return priorities;
}

export default function WealthBlueprintPrintPage() {
  return (
    <Suspense
      fallback={
        <ReportPrintShell backHref="/wealth-blueprint" backLabel="Back to Wealth Blueprint">
          <p className="py-16 text-center text-sm text-[#10283A]/45">
            Preparing report for export…
          </p>
        </ReportPrintShell>
      }
    >
      <WealthBlueprintPrintContent />
    </Suspense>
  );
}

function WealthBlueprintPrintContent() {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const [mode, setMode] = useState<PrintMode>("loading");
  const [results, setResults] = useState<BlueprintPageResults | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/wealth-blueprint/current", {
          cache: "no-store",
        });

        if (cancelled) return;

        if (response.status === 401) {
          const saved = loadDiscoverProfile();
          if (saved) {
            setResults(computeBlueprintFromProfile(saved));
            setMode("ready");
          } else {
            setMode("empty");
          }
          return;
        }

        const data = (await response.json()) as
          | ({ ok: true } & WealthBlueprintSnapshot)
          | { ok: false };

        if (data.ok) {
          setResults(cloudSnapshotToResults(data));
          setMode("ready");
          return;
        }

        const saved = loadDiscoverProfile();
        if (saved) {
          setResults(computeBlueprintFromProfile(saved));
          setMode("ready");
        } else {
          setMode("empty");
        }
      } catch {
        if (cancelled) return;
        const saved = loadDiscoverProfile();
        if (saved) {
          setResults(computeBlueprintFromProfile(saved));
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
  }, []);

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
    if (!results) return new Date().toLocaleDateString("en-SG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return new Date(results.completedAt).toLocaleDateString("en-SG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [results]);

  if (mode === "loading") {
    return (
      <ReportPrintShell backHref="/wealth-blueprint" backLabel="Back to Wealth Blueprint">
        <p className="py-16 text-center text-sm text-[#10283A]/45">
          Preparing report for export…
        </p>
      </ReportPrintShell>
    );
  }

  if (mode === "empty" || !results) {
    return (
      <ReportPrintShell backHref="/wealth-blueprint" backLabel="Back to Wealth Blueprint">
        <div className="py-16 text-center">
          <p className="text-base font-light text-[#10283A]">
            No Wealth Blueprint data available
          </p>
          <p className="mt-3 text-sm text-[#10283A]/55">
            Complete Discover™ and open your Wealth Blueprint before exporting.
          </p>
        </div>
      </ReportPrintShell>
    );
  }

  const executiveSummary = buildExecutiveSummaryParagraphs(results);
  const priorities = buildPlanningPriorities(results);
  const improvement =
    results.projected.projectedAdjustedShieldScore -
    results.shield.adjustedShieldScore;

  return (
    <ReportPrintShell
      backHref="/wealth-blueprint"
      backLabel="Back to Wealth Blueprint"
      autoPrint={autoPrint}
    >
      <ReportCoverPage
        reportType="Wealth Architecture Blueprint"
        reportTitle="Wealth Blueprint™"
        clientName={clientName}
        generatedDate={reportDate}
        subtitle="Personal planning report · For review with your advisor"
      />

      <ReportSection label="Section 1" title="Executive Summary">
        <div className="space-y-4">
          {executiveSummary.map((paragraph, index) => (
            <p
              key={index}
              className="text-sm font-light leading-relaxed text-[#10283A]/80"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </ReportSection>

      <ReportSection
        label="Section 2"
        title="Score Overview"
        pageBreakBefore
      >
        <ReportScoreSummary
          adjustedShieldScore={results.shield.adjustedShieldScore}
          rawShieldScore={results.shield.rawShieldScore}
          rating={results.shield.rating}
          awri={results.awri.awri}
          awriRating={results.awri.rating}
          discoverScore={results.shield.discoverScore}
          dataConfidenceFactor={results.shield.dataConfidenceFactor}
          projectedScore={results.projected.projectedAdjustedShieldScore}
          projectedRating={results.projected.projectedRating}
          scoreMovement={improvement}
        />
      </ReportSection>

      <ReportSection
        label="Section 3"
        title="Pillar Analysis"
        pageBreakBefore
      >
        {results.weakestPillars.length === 0 ? (
          <p className="text-sm text-[#10283A]/50">
            Pillar diagnostics are not available for this report.
          </p>
        ) : (
          <ul className="space-y-2">
            {PILLAR_ORDER.map((pillar) => {
              const score = results.shield.pillarScores[pillar];
              const isWeakest = results.weakestPillars.some(
                (entry) => entry.pillar === pillar,
              );

              return (
                <li
                  key={pillar}
                  className={`flex items-center justify-between border px-4 py-3 ${
                    isWeakest
                      ? "border-[#D1A866]/40 bg-[#F8F7F4]"
                      : "border-[#10283A]/10"
                  }`}
                >
                  <span className="text-sm text-[#10283A]">
                    {PILLAR_LABELS[pillar]}
                    {isWeakest ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-[#B8860B]">
                        Focus area
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-[#10283A]">
                    {formatScore(score)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </ReportSection>

      <ReportSection
        label="Section 4"
        title="Stress Summary"
        pageBreakBefore
      >
        {results.topStressExposures.length === 0 ? (
          <p className="text-sm text-[#10283A]/50">
            No stress test exposures recorded for this report.
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
        label="Section 5"
        title="Roadmap Summary"
        pageBreakBefore
      >
        <ReportActionPlan items={results.roadmap} />
      </ReportSection>

      <ReportSection
        label="Section 6"
        title="Next Planning Priorities"
        pageBreakBefore
      >
        <ul className="space-y-2">
          {priorities.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-sm font-light leading-relaxed text-[#10283A]/80"
            >
              <span className="text-[#B8860B]">→</span>
              {item}
            </li>
          ))}
        </ul>
      </ReportSection>

      <ReportDisclaimer />

      <footer className="report-print-avoid-break mt-10 border-t border-[#10283A]/10 pt-6 text-center">
        <p className="text-[9px] uppercase tracking-[0.2em] text-[#10283A]/35">
          AEGIS Wealth Blueprint™ · Confidential · Generated {reportDate}
        </p>
      </footer>
    </ReportPrintShell>
  );
}
