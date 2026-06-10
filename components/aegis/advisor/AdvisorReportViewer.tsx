"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import ReportActionPlan from "@/components/aegis/reports/ReportActionPlan";
import ReportCoverPage from "@/components/aegis/reports/ReportCoverPage";
import ReportDisclaimer from "@/components/aegis/reports/ReportDisclaimer";
import ReportPrintShell from "@/components/aegis/reports/ReportPrintShell";
import ReportScoreSummary from "@/components/aegis/reports/ReportScoreSummary";
import ReportSection from "@/components/aegis/reports/ReportSection";
import type {
  AdvisorAnnualReviewDetail,
  AdvisorWealthBlueprintDetail,
} from "@/lib/supabase/advisorReportQueries";
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

const PILLAR_LABELS: Record<string, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SectionHeading({
  label,
  title,
}: {
  label: string;
  title: string;
}) {
  return (
    <div className="border-b border-[#D1A866]/10 pb-3">
      <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
        {label}
      </p>
      <h3 className="mt-1 text-sm font-light tracking-wide text-[#F3F1EA]">
        {title}
      </h3>
    </div>
  );
}

export function AdvisorWealthBlueprintViewer({
  report,
}: {
  report: AdvisorWealthBlueprintDetail;
}) {
  const { pillarSummary, roadmapSummary, stressSummary } = report;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
            Shield Score
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums text-[#D1A866]">
            {report.adjustedShieldScore != null
              ? formatScore(report.adjustedShieldScore)
              : "—"}
            {report.rating ? (
              <span className="ml-2 text-sm text-[#F3F1EA]/55">
                {report.rating}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
            AWRI
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums text-[#F3F1EA]/75">
            {report.awri != null ? formatScore(report.awri) : "—"}
          </p>
        </div>
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
            Generated
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/75">
            {formatDate(report.generatedAt)}
          </p>
        </div>
      </div>

      {report.executiveSummary ? (
        <section className="space-y-3">
          <SectionHeading label="Overview" title="Executive summary" />
          <p className="text-sm font-light leading-relaxed text-[#F3F1EA]/70">
            {report.executiveSummary}
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeading label="Diagnostics" title="Pillar summary" />
        <ul className="space-y-2">
          {pillarSummary.weakestPillars.map((entry) => (
            <li
              key={entry.pillar}
              className="flex items-center justify-between rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-2.5"
            >
              <span className="text-sm font-light text-[#F3F1EA]/75">
                {entry.label ?? PILLAR_LABELS[entry.pillar] ?? entry.pillar}
              </span>
              <span className="font-mono text-sm tabular-nums text-[#D1A866]">
                {formatScore(entry.score)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeading label="Roadmap" title="Implementation summary" />
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-3 py-2.5 text-center">
            <p className="font-mono text-lg tabular-nums text-[#D1A866]">
              {roadmapSummary.completed}
            </p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
              Completed
            </p>
          </div>
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-3 py-2.5 text-center">
            <p className="font-mono text-lg tabular-nums text-[#F3F1EA]/70">
              {roadmapSummary.inProgress}
            </p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
              In progress
            </p>
          </div>
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-3 py-2.5 text-center">
            <p className="font-mono text-lg tabular-nums text-[#F3F1EA]/50">
              {roadmapSummary.notStarted}
            </p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
              Not started
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          label="Stress"
          title="Top exposure summary"
        />
        {stressSummary.topExposures.length === 0 ? (
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No stress exposures recorded in this snapshot.
          </p>
        ) : (
          <ul className="space-y-2">
            {stressSummary.topExposures.map((test, index) => {
              const impact =
                test.preStressScore - test.postStressScore;

              return (
                <li
                  key={`${test.scenario}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-2.5"
                >
                  <div>
                    <p className="text-sm font-light text-[#F3F1EA]/75">
                      {SCENARIO_LABELS[test.scenario]}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
                      {test.severity} · post-stress{" "}
                      {formatScore(test.postStressScore)}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-red-200/80">
                    −{formatScore(impact)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AdvisorAnnualReviewViewer({
  report,
}: {
  report: AdvisorAnnualReviewDetail;
}) {
  const scoreMovement =
    report.totalImprovement ??
    (report.projectedAdjustedScore != null
      ? report.projectedAdjustedScore - report.adjustedShieldScore
      : null);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
            Review period
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/75">
            {report.reviewLabel ?? `${report.reviewYear} Annual Review`}
          </p>
        </div>
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
            Shield Score
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums text-[#D1A866]">
            {formatScore(report.adjustedShieldScore)} · {report.rating}
          </p>
        </div>
        <div className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/50 px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
            Generated
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/75">
            {formatDate(report.generatedAt)}
          </p>
        </div>
      </div>

      {scoreMovement != null ? (
        <section className="space-y-3">
          <SectionHeading label="Movement" title="Score trajectory" />
          <div className="flex flex-wrap items-center gap-4 rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
            <span className="font-mono text-sm tabular-nums text-[#F3F1EA]/70">
              Current {formatScore(report.adjustedShieldScore)}
            </span>
            {report.projectedAdjustedScore != null ? (
              <span className="font-mono text-sm tabular-nums text-[#D1A866]">
                Target {formatScore(report.projectedAdjustedScore)}
              </span>
            ) : null}
            <span
              className={`font-mono text-sm tabular-nums ${
                scoreMovement >= 0 ? "text-emerald-200/80" : "text-red-200/80"
              }`}
            >
              {scoreMovement >= 0 ? "+" : ""}
              {formatScore(scoreMovement)} projected
            </span>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <SectionHeading label="Diagnostics" title="Weakest pillars" />
        {report.weakestPillars.length === 0 ? (
          <p className="text-sm font-light text-[#F3F1EA]/45">
            No pillar diagnostics in this snapshot.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.weakestPillars.map((entry) => (
              <li
                key={entry.pillar}
                className="flex items-center justify-between rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-2.5"
              >
                <span className="text-sm font-light text-[#F3F1EA]/75">
                  {entry.label ?? PILLAR_LABELS[entry.pillar] ?? entry.pillar}
                </span>
                <span className="font-mono text-sm tabular-nums text-[#D1A866]">
                  {formatScore(entry.score)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionHeading label="Roadmap" title="Progress summary" />
        <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-2xl tabular-nums text-[#D1A866]">
              {report.roadmapProgress.percent}%
            </p>
            <p className="text-sm font-light text-[#F3F1EA]/55">
              {report.roadmapProgress.completed} of {report.roadmapProgress.total}{" "}
              actions completed
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#D1A866]/10">
            <div
              className="h-full rounded-full bg-[#D1A866]/70 transition-all"
              style={{ width: `${report.roadmapProgress.percent}%` }}
            />
          </div>
        </div>
      </section>

      {report.timeline.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading label="Timeline" title="Four-year progression" />
          <div className="grid gap-3 sm:grid-cols-2">
            {report.timeline.map((year) => (
              <div
                key={year.calendarYear}
                className={`rounded-sm border px-4 py-3 ${
                  year.yearOffset === 3
                    ? "border-[#D1A866]/30 bg-[#1A2A2B]/50"
                    : year.yearOffset === 0
                      ? "border-[#D1A866]/20 bg-[#071B2A]/50"
                      : "border-[#D1A866]/10 bg-[#071B2A]/40"
                }`}
              >
                <p className="text-[9px] uppercase tracking-[0.12em] text-[#D1A866]/60">
                  {year.label}
                </p>
                <p className="mt-1 font-mono text-lg tabular-nums text-[#D1A866]">
                  {formatScore(year.adjustedShieldScore)}
                  <span className="ml-2 text-sm text-[#F3F1EA]/50">
                    {year.rating}
                  </span>
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#F3F1EA]/35">
                  {year.actionsCompleted} actions · {year.progressPercent}% progress
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatPrintDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function buildPlanningPrioritiesFromBlueprint(
  report: AdvisorWealthBlueprintDetail,
): string[] {
  const priorities: string[] = [];

  for (const pillar of report.pillarSummary.weakestPillars.slice(0, 3)) {
    priorities.push(
      `Strengthen ${pillar.label ?? PILLAR_LABELS[pillar.pillar] ?? pillar.pillar} (score ${formatScore(pillar.score)})`,
    );
  }

  const nextItem = report.roadmapSummary.items.find(
    (item) => item.status !== "completed",
  );
  if (nextItem) {
    priorities.push(`Begin roadmap action: ${nextItem.title}`);
  }

  if (report.stressSummary.topExposures[0]) {
    priorities.push(
      `Review stress exposure: ${SCENARIO_LABELS[report.stressSummary.topExposures[0].scenario]}`,
    );
  }

  priorities.push("Schedule review with client and qualified advisors");

  return priorities;
}

function buildAnnualReviewHighlights(report: AdvisorAnnualReviewDetail): {
  changed: string[];
  reviewNext: string[];
} {
  const changed: string[] = [
    `Shield score is ${formatScore(report.adjustedShieldScore)} (${report.rating}).`,
  ];

  if (report.roadmapProgress.completed > 0) {
    changed.push(
      `${report.roadmapProgress.completed} roadmap milestone${report.roadmapProgress.completed === 1 ? "" : "s"} completed.`,
    );
  }

  if (report.totalImprovement != null && report.totalImprovement > 0) {
    changed.push(
      `Roadmap completion could raise score toward ${report.projectedAdjustedScore != null ? formatScore(report.projectedAdjustedScore) : "target"}.`,
    );
  }

  const reviewNext: string[] = [];
  const primary = report.weakestPillars[0];

  if (primary) {
    reviewNext.push(
      `Focus on ${primary.label ?? PILLAR_LABELS[primary.pillar] ?? primary.pillar} (score ${formatScore(primary.score)}).`,
    );
  }

  if (report.roadmapProgress.completed < report.roadmapProgress.total) {
    reviewNext.push("Advance outstanding roadmap milestones with the client.");
  }

  reviewNext.push("Confirm Discover profile reflects current client circumstances.");

  return { changed, reviewNext };
}

export function AdvisorWealthBlueprintPrintView({
  report,
  clientName,
  clientId,
  autoPrint = false,
}: {
  report: AdvisorWealthBlueprintDetail;
  clientName: string;
  clientId: string;
  autoPrint?: boolean;
}) {
  const reportDate = formatPrintDate(report.generatedAt);
  const priorities = buildPlanningPrioritiesFromBlueprint(report);

  return (
    <ReportPrintShell
      backHref={`/advisor/clients/${clientId}`}
      backLabel="Back to client file"
      autoPrint={autoPrint}
    >
      <ReportCoverPage
        reportType="Wealth Architecture Blueprint"
        reportTitle={report.title}
        clientName={clientName}
        generatedDate={reportDate}
        subtitle="Saved snapshot · Advisor export"
      />

      <ReportSection label="Section 1" title="Executive Summary">
        {report.executiveSummary ? (
          <p className="text-sm font-light leading-relaxed text-[#10283A]/80">
            {report.executiveSummary}
          </p>
        ) : (
          <p className="text-sm text-[#10283A]/50">
            No executive summary recorded for this snapshot.
          </p>
        )}
      </ReportSection>

      <ReportSection label="Section 2" title="Score Overview" pageBreakBefore>
        <ReportScoreSummary
          adjustedShieldScore={report.adjustedShieldScore}
          rating={report.rating}
          awri={report.awri}
        />
      </ReportSection>

      <ReportSection label="Section 3" title="Pillar Analysis" pageBreakBefore>
        {report.pillarSummary.weakestPillars.length === 0 ? (
          <p className="text-sm text-[#10283A]/50">
            No pillar diagnostics in this snapshot.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.pillarSummary.weakestPillars.map((entry) => (
              <li
                key={entry.pillar}
                className="flex items-center justify-between border border-[#10283A]/10 px-4 py-3"
              >
                <span className="text-sm text-[#10283A]">
                  {entry.label ?? PILLAR_LABELS[entry.pillar] ?? entry.pillar}
                </span>
                <span className="font-mono text-sm tabular-nums text-[#10283A]">
                  {formatScore(entry.score)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportSection label="Section 4" title="Stress Summary" pageBreakBefore>
        {report.stressSummary.topExposures.length === 0 ? (
          <p className="text-sm text-[#10283A]/50">
            No stress exposures recorded in this snapshot.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.stressSummary.topExposures.map((test, index) => {
              const impact = test.preStressScore - test.postStressScore;
              return (
                <li
                  key={`${test.scenario}-${index}`}
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

      <ReportSection label="Section 5" title="Roadmap Summary" pageBreakBefore>
        <ReportActionPlan summary={report.roadmapSummary} />
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
          AEGIS Wealth Blueprint™ · Advisor Export · Generated {reportDate}
        </p>
      </footer>
    </ReportPrintShell>
  );
}

export function AdvisorAnnualReviewPrintView({
  report,
  clientName,
  clientId,
  autoPrint = false,
}: {
  report: AdvisorAnnualReviewDetail;
  clientName: string;
  clientId: string;
  autoPrint?: boolean;
}) {
  const reportDate = formatPrintDate(report.generatedAt);
  const highlights = buildAnnualReviewHighlights(report);
  const title = report.reviewLabel ?? `${report.reviewYear} Annual Review`;

  return (
    <ReportPrintShell
      backHref={`/advisor/clients/${clientId}`}
      backLabel="Back to client file"
      autoPrint={autoPrint}
    >
      <ReportCoverPage
        reportType="Annual Shield Review"
        reportTitle={title}
        clientName={clientName}
        generatedDate={reportDate}
        subtitle="Saved snapshot · Advisor export"
      />

      <ReportSection label="Section 1" title="Current Score Position">
        <ReportScoreSummary
          adjustedShieldScore={report.adjustedShieldScore}
          rating={report.rating}
          projectedScore={report.projectedAdjustedScore}
          scoreMovement={report.totalImprovement}
        />
      </ReportSection>

      <ReportSection label="Section 2" title="Progress Overview" pageBreakBefore>
        <div className="border border-[#10283A]/10 px-5 py-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#10283A]/45">
            Roadmap completion
          </p>
          <p className="mt-2 font-mono text-2xl tabular-nums text-[#B8860B]">
            {report.roadmapProgress.percent}%
          </p>
          <p className="mt-1 text-sm text-[#10283A]/75">
            {report.roadmapProgress.completed} of {report.roadmapProgress.total}{" "}
            actions completed
          </p>
        </div>

        {report.timeline.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {report.timeline.map((year) => (
              <div
                key={year.calendarYear}
                className="border border-[#10283A]/10 px-4 py-3"
              >
                <p className="text-[9px] uppercase tracking-[0.12em] text-[#10283A]/45">
                  {year.label}
                </p>
                <p className="mt-1 font-mono text-lg tabular-nums text-[#10283A]">
                  {formatScore(year.adjustedShieldScore)} · {year.rating}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </ReportSection>

      <ReportSection label="Section 3" title="What Changed" pageBreakBefore>
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

      <ReportSection label="Section 4" title="What to Review Next" pageBreakBefore>
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
      </ReportSection>

      <ReportSection label="Section 5" title="Weakest Pillars" pageBreakBefore>
        {report.weakestPillars.length === 0 ? (
          <p className="text-sm text-[#10283A]/50">
            No pillar diagnostics in this snapshot.
          </p>
        ) : (
          <ul className="space-y-2">
            {report.weakestPillars.map((entry) => (
              <li
                key={entry.pillar}
                className="flex items-center justify-between border border-[#10283A]/10 px-4 py-3"
              >
                <span className="text-sm text-[#10283A]">
                  {entry.label ?? PILLAR_LABELS[entry.pillar] ?? entry.pillar}
                </span>
                <span className="font-mono text-sm tabular-nums text-[#10283A]">
                  {formatScore(entry.score)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ReportSection>

      <ReportDisclaimer />

      <footer className="report-print-avoid-break mt-10 border-t border-[#10283A]/10 pt-6 text-center">
        <p className="text-[9px] uppercase tracking-[0.2em] text-[#10283A]/35">
          AEGIS Annual Shield Review™ · Advisor Export · Generated {reportDate}
        </p>
      </footer>
    </ReportPrintShell>
  );
}
