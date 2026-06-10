"use client";

import Link from "next/link";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import AdvisorReviewStatusBadge from "@/components/aegis/advisor/AdvisorReviewStatusBadge";
import type { AdvisorClientRecord } from "@/lib/supabase/advisorClientQueries";
import type { ClientReviewStatusDetail } from "@/lib/supabase/advisorReviewPipeline";
import type { AdvisorActivityItem } from "@/lib/supabase/advisorQueries";
import type { ShieldRating } from "@/src/lib/scoring/types";

interface AdvisorClientCommandHeaderProps {
  client: AdvisorClientRecord;
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
  review: ClientReviewStatusDetail | null;
  lastActivity: AdvisorActivityItem | null;
}

function statusLabel(status: AdvisorClientRecord["status"]): string {
  return status.replace(/_/g, " ");
}

function formatRelativeActivity(iso: string | null): string {
  if (!iso) return "No recent activity";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "No recent activity";

  return date.toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function advisorLabel(client: AdvisorClientRecord): string {
  if (client.advisorFullName) return client.advisorFullName;
  if (client.advisorUserId) return "Assigned advisor";
  return "Unassigned";
}

export default function AdvisorClientCommandHeader({
  client,
  adjustedShieldScore,
  rating,
  review,
  lastActivity,
}: AdvisorClientCommandHeaderProps) {
  const activityTimestamp =
    lastActivity?.createdAt ?? client.updatedAt ?? null;

  return (
    <header className="relative overflow-hidden rounded-sm border border-[#D1A866]/18 bg-[#10283A]/70">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/8 via-transparent to-[#071B2A]/40" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#D1A866]/25 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-5 py-3 sm:px-6">
        <Link
          href="/advisor"
          className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70 transition-colors hover:text-[#D1A866]"
        >
          <span aria-hidden>←</span>
          Advisor Console
        </Link>
      </div>

      <div className="relative px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#D1A866]/75">
                Client File
              </p>
              <span className="hidden h-3 w-px bg-[#D1A866]/20 sm:block" />
              <span className="inline-flex rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-[#F3F1EA]/60">
                {statusLabel(client.status)}
              </span>
              {review ? (
                <AdvisorReviewStatusBadge state={review.servicingState} compact />
              ) : null}
            </div>

            <div>
              <h1 className="truncate text-2xl font-light tracking-tight text-[#F3F1EA] sm:text-3xl">
                {client.displayName}
              </h1>
              <p className="mt-2 text-sm font-light text-[#F3F1EA]/50">
                {client.email ?? "No email on file"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-light text-[#F3F1EA]/45">
              <span>
                Mandate ·{" "}
                <span className="text-[#F3F1EA]/70">{advisorLabel(client)}</span>
              </span>
              {client.nextReviewDue ? (
                <span>
                  Next review{" "}
                  {new Date(client.nextReviewDue).toLocaleDateString("en-SG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              ) : null}
              <span>Last activity {formatRelativeActivity(activityTimestamp)}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-6 sm:gap-8 xl:justify-end">
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
                Shield Score
              </p>
              <p className="mt-1 font-mono text-3xl font-light tabular-nums text-[#D1A866] sm:text-4xl">
                {adjustedShieldScore != null
                  ? formatScore(adjustedShieldScore)
                  : "—"}
              </p>
              <p className="mt-1 font-mono text-sm text-[#F3F1EA]/55">
                {rating ?? "No rating"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
