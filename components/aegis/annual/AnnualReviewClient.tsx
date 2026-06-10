"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatScore } from "@/components/aegis/ShieldScoreCard";
import AnnualReviewEmptyState from "@/components/aegis/annual/AnnualReviewEmptyState";
import AnnualReviewProgressPanel from "@/components/aegis/annual/AnnualReviewProgressPanel";
import AnnualReviewRoadmapSummary from "@/components/aegis/annual/AnnualReviewRoadmapSummary";
import AnnualReviewScoreCard from "@/components/aegis/annual/AnnualReviewScoreCard";
import AnnualReviewStressSummary from "@/components/aegis/annual/AnnualReviewStressSummary";
import AnnualReviewTimeline from "@/components/aegis/annual/AnnualReviewTimeline";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import {
  applyRoadmapStatuses,
  computeAnnualReviewFromProfile,
  loadDiscoverProfile,
  loadRoadmapStatuses,
  PILLAR_LABELS,
  type AnnualReviewPageResults,
  type AnnualReviewTimelineYear,
  type DiscoverStoredProfile,
  type RoadmapItemStatus,
} from "@/lib/aegis/localProfile";
import type { AnnualReviewSnapshot } from "@/lib/supabase/moduleQueries";
import { calculateProjectedShield } from "@/src/lib/scoring";
import type { RoadmapItem, ShieldRating, ShieldScoreResult } from "@/src/lib/scoring/types";

type AnnualReviewMode = "loading" | "empty" | "cloud" | "local";
type ProfileSource = "cloud" | "local";
type SnapshotSaveState = "idle" | "saving" | "saved" | "error";

function formatSavedTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProfileSourceBadge({ source }: { source: ProfileSource }) {
  const label = source === "cloud" ? "Cloud Profile" : "Local Profile";

  return (
    <span className="inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
      {label}
    </span>
  );
}

function roadmapAtYearOffset(
  items: RoadmapItem[],
  yearOffset: number,
): RoadmapItem[] {
  if (yearOffset === 0) {
    return items;
  }

  const monthsCutoff = yearOffset * 12;
  const includeAll = yearOffset >= 3;

  return items.map((item) => {
    if (item.status === "completed") {
      return item;
    }
    if (includeAll || item.timelineMonths <= monthsCutoff) {
      return { ...item, status: "completed" as const };
    }
    return item;
  });
}

function buildTimeline(
  currentScore: number,
  shield: ShieldScoreResult,
  roadmap: RoadmapItem[],
): AnnualReviewTimelineYear[] {
  const currentYear = new Date().getFullYear();
  const targetRoadmap = roadmapAtYearOffset(roadmap, 3);
  const targetProjected = calculateProjectedShield(
    shield.pillarScores,
    targetRoadmap,
    shield.dataConfidenceFactor,
  );
  const targetScore = targetProjected.projectedAdjustedShieldScore;
  const scoreRange = targetScore - currentScore;
  const labels = ["Current Year", "Year +1", "Year +2", "Year +3 Target"];

  return [0, 1, 2, 3].map((yearOffset) => {
    let score: number;
    let rating: ShieldRating;
    let actionsCompleted: number;

    if (yearOffset === 0) {
      score = currentScore;
      rating = shield.rating;
      actionsCompleted = roadmap.filter((item) => item.status === "completed").length;
    } else {
      const yearRoadmap = roadmapAtYearOffset(roadmap, yearOffset);
      const projected = calculateProjectedShield(
        shield.pillarScores,
        yearRoadmap,
        shield.dataConfidenceFactor,
      );
      score = projected.projectedAdjustedShieldScore;
      rating = projected.projectedRating;
      actionsCompleted = yearRoadmap.filter(
        (item) => item.status === "completed",
      ).length;
    }

    const progressPercent =
      scoreRange > 0
        ? Math.round(((score - currentScore) / scoreRange) * 100)
        : 100;

    return {
      calendarYear: currentYear + yearOffset,
      yearOffset,
      label: labels[yearOffset],
      adjustedShieldScore: score,
      rating,
      progressPercent: Math.max(0, Math.min(100, progressPercent)),
      actionsCompleted,
    };
  });
}

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
    timeline: buildTimeline(
      snapshot.shield.adjustedShieldScore,
      snapshot.shield,
      roadmap,
    ),
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
    `Your Shield score is ${formatScore(shield.adjustedShieldScore)} (${shield.rating}) based on your latest profile.`,
  ];

  if (completedCount > 0) {
    changed.push(
      `${completedCount} roadmap milestone${completedCount === 1 ? "" : "s"} marked complete since your profile was captured.`,
    );
  }

  if (totalImprovement > 0) {
    changed.push(
      `Completing your roadmap could raise your score toward ${formatScore(projected.projectedAdjustedShieldScore)} over the review horizon.`,
    );
  }

  const reviewNext: string[] = [];

  if (primaryPillar) {
    reviewNext.push(
      `Focus on ${primaryPillar.label} (score ${formatScore(primaryPillar.score)}) — your biggest improvement opportunity.`,
    );
  }

  if (inProgressCount > 0) {
    reviewNext.push(
      `Continue ${inProgressCount} in-progress roadmap action${inProgressCount === 1 ? "" : "s"} and update status when done.`,
    );
  } else if (roadmap.length > 0 && completedCount < roadmap.length) {
    reviewNext.push(
      "Start your top roadmap milestone — small steps compound over the year.",
    );
  }

  if (topStressExposures.length > 0) {
    const label = topStressExposures[0].scenario.replace(/_/g, " ");
    reviewNext.push(
      `Revisit stress testing for "${label}" — one of your more sensitive scenarios.`,
    );
  }

  reviewNext.push(
    "Refresh Discover if your income, protection, or family situation has changed.",
  );

  return { changed, reviewNext };
}

export default function AnnualReviewClient() {
  const [mode, setMode] = useState<AnnualReviewMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [cloudSnapshot, setCloudSnapshot] =
    useState<AnnualReviewSnapshot | null>(null);
  const [statuses, setStatuses] = useState<Record<string, RoadmapItemStatus>>(
    {},
  );
  const [saveState, setSaveState] = useState<SnapshotSaveState>("idle");
  const [latestSavedAt, setLatestSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setStatuses(loadRoadmapStatuses());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAnnualReview() {
      try {
        const response = await fetch("/api/annual-review/current", {
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
          | ({ ok: true } & AnnualReviewSnapshot)
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

    void loadAnnualReview();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "cloud") {
      setLatestSavedAt(null);
      setSaveState("idle");
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      try {
        const response = await fetch("/api/annual-review/history", {
          cache: "no-store",
        });

        if (cancelled || !response.ok) return;

        const data = (await response.json()) as
          | { ok: true; snapshots: Array<{ generated_at: string }> }
          | { ok: false };

        if (data.ok && data.snapshots.length > 0) {
          setLatestSavedAt(data.snapshots[0].generated_at);
        }
      } catch {
        // History is optional for display; ignore fetch errors.
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const handleSaveSnapshot = useCallback(async () => {
    if (mode !== "cloud") return;

    setSaveState("saving");

    try {
      const response = await fetch("/api/annual-review/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await response.json()) as
        | { ok: true; generated_at: string }
        | { ok: false; reason?: string; error?: string };

      if (!response.ok || !data.ok) {
        setSaveState("error");
        return;
      }

      setLatestSavedAt(data.generated_at);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [mode]);

  const localResults: AnnualReviewPageResults | null = useMemo(() => {
    if (mode !== "local" || !profile) return null;
    return computeAnnualReviewFromProfile(profile, statuses);
  }, [mode, profile, statuses]);

  const cloudResults: AnnualReviewPageResults | null = useMemo(() => {
    if (mode !== "cloud" || !cloudSnapshot) return null;
    return cloudSnapshotToResults(cloudSnapshot, statuses);
  }, [mode, cloudSnapshot, statuses]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Preparing annual review…
        </p>
      </div>
    );
  }

  const results = mode === "cloud" ? cloudResults : localResults;

  if (mode === "empty" || !results) {
    return <AnnualReviewEmptyState />;
  }

  const profileSource: ProfileSource = mode === "cloud" ? "cloud" : "local";
  const badgeLabel = mode === "cloud" ? "Cloud Profile" : "Local Profile";

  const narrative = buildAnnualReviewNarrative(results);
  const highlights = buildReviewHighlights(results);
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
              <p className="mt-2 text-sm font-light text-[#F3F1EA]/50">
                Your year-ahead summary · Plain-language review
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
            <ProfileSourceBadge source={profileSource} />
            <span className="text-xs text-[#F3F1EA]/35">
              Shield Rating {results.shield.rating} · Confidential
            </span>
            {mode === "cloud" && latestSavedAt && (
              <span className="text-xs text-[#F3F1EA]/35">
                Last saved {formatSavedTimestamp(latestSavedAt)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-8 sm:gap-10">
        <AnnualReviewTimeline timeline={results.timeline} />

        <AnnualReviewScoreCard results={results} />

        <AnnualReviewProgressPanel
          results={results}
          saveState={mode === "cloud" ? saveState : undefined}
        />

        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/45 p-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              What we see today
            </p>
            <ul className="mt-4 space-y-3">
              {highlights.changed.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm font-light leading-relaxed text-[#F3F1EA]/65"
                >
                  <span className="text-emerald-400/70">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-sm border border-[#D1A866]/20 bg-[#1A2A2B]/40 p-6">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              What to review next
            </p>
            <ul className="mt-4 space-y-3">
              {highlights.reviewNext.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm font-light leading-relaxed text-[#F3F1EA]/65"
                >
                  <span className="text-[#D1A866]/70">→</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#1A2A2B]/40">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
          <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

          <div className="relative border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Detailed summary
            </p>
            <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
              Full review narrative
            </h3>
            <p className="mt-1 text-xs text-[#F3F1EA]/40">
              A deeper read for you and your advisor
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

        <ClientTrustNotice variant="full" context="planning" />
      </div>

      <footer className="mt-12 border-t border-[#D1A866]/15 pt-8 sm:mt-16">
        <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          {mode === "cloud" && (
            <button
              type="button"
              onClick={() => void handleSaveSnapshot()}
              disabled={saveState === "saving"}
              className="inline-flex items-center gap-2 rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20 disabled:cursor-wait disabled:opacity-60"
            >
              {saveState === "saving"
                ? "Saving Snapshot…"
                : saveState === "saved"
                  ? "Snapshot Saved"
                  : saveState === "error"
                    ? "Save Failed — Retry"
                    : "Save Annual Review Snapshot"}
            </button>
          )}

          <Link
            href="/annual-review/print?print=1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-6 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4"
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
            Export / Print Review
          </Link>
        </div>

        <p className="text-center text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
          AEGIS Annual Shield Review™ · {badgeLabel} · Confidential · For
          architectural review only
        </p>
        <p className="mt-2 text-center text-xs font-light text-[#F3F1EA]/35">
          Planning support only — not financial, legal, or tax advice.
        </p>
      </footer>
    </article>
  );
}
