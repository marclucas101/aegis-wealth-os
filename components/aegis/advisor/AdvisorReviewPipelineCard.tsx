"use client";

import Link from "next/link";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import AdvisorReviewStatusBadge from "@/components/aegis/advisor/AdvisorReviewStatusBadge";
import type { ReviewPipelineClient } from "@/lib/supabase/advisorReviewPipeline";

interface AdvisorReviewPipelineCardProps {
  client: ReviewPipelineClient;
}

function formatReviewDate(isoDate: string | null): string {
  if (!isoDate) return "—";

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdvisorReviewPipelineCard({
  client,
}: AdvisorReviewPipelineCardProps) {
  return (
    <article className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 p-4 transition-colors hover:border-[#D1A866]/25">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/advisor/clients/${client.clientId}`}
            className="text-sm font-light text-[#F3F1EA] transition-colors hover:text-[#D1A866]"
          >
            {client.displayName}
          </Link>
          <div className="mt-2">
            <AdvisorReviewStatusBadge state={client.servicingState} compact />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm tabular-nums text-[#D1A866]">
            {client.adjustedShieldScore != null
              ? formatScore(client.adjustedShieldScore)
              : "—"}
          </p>
          <p className="mt-0.5 font-mono text-xs text-[#F3F1EA]/50">
            {client.rating ?? "—"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
            Last review
          </dt>
          <dd className="mt-0.5 font-light text-[#F3F1EA]/70">
            {formatReviewDate(client.lastAnnualReviewDate)}
          </dd>
        </div>
        <div>
          <dt className="text-[9px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
            Roadmap
          </dt>
          <dd className="mt-0.5 font-mono text-[#F3F1EA]/70">
            {client.roadmapCompletionPercent}%
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs font-light leading-relaxed text-[#F3F1EA]/50">
        {client.recommendedNextAction}
      </p>

      {client.priorityReasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {client.priorityReasons.slice(0, 3).map((reason) => (
            <span
              key={reason}
              className="inline-flex rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60 px-2 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[#F3F1EA]/45"
            >
              {reason}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
