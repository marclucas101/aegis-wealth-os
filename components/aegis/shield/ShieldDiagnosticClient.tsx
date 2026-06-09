"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  computeShieldDiagnosticResult,
  getWeakestPillars,
  loadDiscoverProfile,
  type DiscoverStoredProfile,
} from "@/lib/aegis/localProfile";
import type { ShieldScoreResult } from "@/src/lib/scoring/types";
import ShieldDiagnosticSummary from "./ShieldDiagnosticSummary";
import ShieldPillarCards from "./ShieldPillarCards";
import ShieldReadinessPanel from "./ShieldReadinessPanel";

function EmptyState() {
  return (
    <div className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/50 p-8 sm:p-12">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/40 to-transparent" />

      <div className="relative mx-auto max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#D1A866]/20 bg-[#1A2A2B]/60">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-7 w-7 text-[#D1A866]/60"
            aria-hidden
          >
            <path
              d="M12 3L4 7v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-4z"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
          Shield Diagnostic™
        </p>
        <h2 className="mt-3 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
          Complete Discover™ first
        </h2>
        <p className="mt-4 text-sm font-light leading-relaxed text-[#F3F1EA]/45">
          Shield Diagnostic requires a completed Discover™ financial profile.
          Complete the onboarding flow to generate preliminary pillar scores
          and confidence-adjusted shield metrics.
        </p>

        <Link
          href="/discover"
          className="mt-8 inline-flex rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-8 py-3 text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
        >
          Start Discover™ →
        </Link>
      </div>
    </div>
  );
}

export default function ShieldDiagnosticClient() {
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfile(loadDiscoverProfile());
    setReady(true);
  }, []);

  const shield: ShieldScoreResult | null = useMemo(() => {
    if (!profile) return null;
    return computeShieldDiagnosticResult(profile);
  }, [profile]);

  const weakestPillars = useMemo(() => {
    if (!shield) return [];
    return getWeakestPillars(shield.pillarScores, 3);
  }, [shield]);

  if (!ready) {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading diagnostic…
        </p>
      </div>
    );
  }

  if (!profile || !shield) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col gap-6">
      <ShieldDiagnosticSummary shield={shield} />
      <ShieldPillarCards
        pillarScores={shield.pillarScores}
        weakestPillars={weakestPillars.map((item) => item.pillar)}
      />
      <ShieldReadinessPanel weakestPillars={weakestPillars} />

      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
        Preliminary diagnostic · Profile captured{" "}
        {new Date(profile.completedAt).toLocaleDateString("en-SG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
