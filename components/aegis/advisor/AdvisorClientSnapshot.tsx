"use client";

import { formatPercent, formatScore } from "@/components/aegis/ShieldScoreCard";
import type {
  AdvisorAnnualReviewEntry,
  AdvisorDiscoverSummary,
} from "@/lib/supabase/advisorClientQueries";
import type { ShieldRating, ShieldScoreResult } from "@/src/lib/scoring/types";

interface AdvisorClientSnapshotProps {
  discover: AdvisorDiscoverSummary | null;
  shield: ShieldScoreResult | null;
  roadmapCompletionPercent: number;
  documentCount: number;
  openTaskCount: number | null;
  lastAnnualReview: AdvisorAnnualReviewEntry | null;
}

function SnapshotMetric({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/45 px-4 py-3.5">
      <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
        {label}
      </p>
      <p
        className={`mt-1.5 font-mono text-xl tabular-nums ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1 text-[10px] font-light text-[#F3F1EA]/35">
          {sublabel}
        </p>
      ) : null}
    </div>
  );
}

function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdvisorClientSnapshot({
  discover,
  shield,
  roadmapCompletionPercent,
  documentCount,
  openTaskCount,
  lastAnnualReview,
}: AdvisorClientSnapshotProps) {
  const discoverScore =
    discover?.discoverScore ?? shield?.discoverScore ?? null;
  const dataConfidence =
    discover?.dataConfidenceFactor ?? shield?.dataConfidenceFactor ?? null;
  const rating: ShieldRating | null = shield?.rating ?? null;

  return (
    <section
      id="client-overview"
      className="relative scroll-mt-24 overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Client Snapshot
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Key intelligence at a glance for servicing and review preparation
        </p>
      </div>

      <div className="relative grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <SnapshotMetric
          label="Shield Score"
          value={
            shield?.adjustedShieldScore != null
              ? formatScore(shield.adjustedShieldScore)
              : "—"
          }
          sublabel={rating ?? "Awaiting Discover"}
          highlight
        />
        <SnapshotMetric
          label="Discover Score"
          value={discoverScore != null ? formatScore(discoverScore) : "—"}
          sublabel={
            discover?.completedAt
              ? `Completed ${formatReviewDate(discover.completedAt)}`
              : "Not completed"
          }
        />
        <SnapshotMetric
          label="Data Confidence"
          value={
            dataConfidence != null ? formatPercent(dataConfidence) : "—"
          }
        />
        <SnapshotMetric
          label="Roadmap Completion"
          value={`${roadmapCompletionPercent}%`}
          sublabel="Active architecture plan"
        />
        <SnapshotMetric
          label="Documents"
          value={String(documentCount)}
          sublabel={documentCount === 1 ? "Vault record" : "Vault records"}
        />
        <SnapshotMetric
          label="Open Tasks"
          value={openTaskCount != null ? String(openTaskCount) : "…"}
          sublabel="Follow-ups in progress"
        />
        <SnapshotMetric
          label="Last Annual Review"
          value={
            lastAnnualReview
              ? formatReviewDate(lastAnnualReview.generatedAt)
              : "—"
          }
          sublabel={
            lastAnnualReview
              ? `${lastAnnualReview.reviewYear} · ${lastAnnualReview.rating}`
              : "No review on file"
          }
        />
        <SnapshotMetric
          label="Rating"
          value={rating ?? "—"}
          sublabel="Current Shield classification"
          highlight={Boolean(rating)}
        />
      </div>
    </section>
  );
}
