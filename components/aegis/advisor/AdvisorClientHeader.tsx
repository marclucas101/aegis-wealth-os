"use client";

import Link from "next/link";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AdvisorClientRecord } from "@/lib/supabase/advisorClientQueries";
import type { ShieldRating } from "@/src/lib/scoring/types";

interface AdvisorClientHeaderProps {
  client: AdvisorClientRecord;
  adjustedShieldScore: number | null;
  rating: ShieldRating | null;
}

function statusLabel(status: AdvisorClientRecord["status"]): string {
  return status.replace(/_/g, " ");
}

export default function AdvisorClientHeader({
  client,
  adjustedShieldScore,
  rating,
}: AdvisorClientHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <Link
          href="/advisor"
          className="inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70 transition-colors hover:text-[#D1A866]"
        >
          <span aria-hidden>←</span>
          Advisor Console
        </Link>
      </div>

      <div className="relative flex flex-col gap-6 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Client Workspace
          </p>
          <h1 className="mt-2 truncate text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
            {client.displayName}
          </h1>
          <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
            {client.email ?? "No email on file"}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-sm border border-[#D1A866]/20 bg-[#071B2A]/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-[#F3F1EA]/60">
              {statusLabel(client.status)}
            </span>
            {client.nextReviewDue && (
              <span className="text-xs text-[#F3F1EA]/35">
                Next review due{" "}
                {new Date(client.nextReviewDue).toLocaleDateString("en-SG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Shield Score
          </p>
          <p className="mt-1 font-mono text-3xl font-light tabular-nums text-[#D1A866] sm:text-4xl">
            {adjustedShieldScore != null ? formatScore(adjustedShieldScore) : "—"}
          </p>
          <p className="mt-1 font-mono text-sm text-[#F3F1EA]/55">
            {rating ?? "No rating"}
          </p>
        </div>
      </div>
    </header>
  );
}
