"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  computeShieldDiagnosticResult,
  getWeakestPillars,
  loadDiscoverProfile,
  type DiscoverStoredProfile,
} from "@/lib/aegis/localProfile";
import type { ShieldDiagnosticSnapshot } from "@/lib/supabase/moduleQueries";
import type { ShieldScoreResult } from "@/src/lib/scoring/types";
import ShieldDiagnosticSummary from "./ShieldDiagnosticSummary";
import ShieldPillarCards from "./ShieldPillarCards";
import ShieldReadinessPanel from "./ShieldReadinessPanel";

type ShieldMode = "loading" | "empty" | "cloud" | "local";
type ProfileSource = "cloud" | "local";

function ProfileSourceBadge({ source }: { source: ProfileSource }) {
  const label = source === "cloud" ? "Cloud Profile" : "Local Profile";

  return (
    <span className="inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
      {label}
    </span>
  );
}

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

export default function ShieldDiagnosticClient() {
  const [mode, setMode] = useState<ShieldMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [cloudSnapshot, setCloudSnapshot] =
    useState<ShieldDiagnosticSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnostic() {
      try {
        const response = await fetch("/api/shield-diagnostic/current", {
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
          | ({ ok: true } & ShieldDiagnosticSnapshot)
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

    void loadDiagnostic();

    return () => {
      cancelled = true;
    };
  }, []);

  const localShield: ShieldScoreResult | null = useMemo(() => {
    if (mode !== "local" || !profile) return null;
    return computeShieldDiagnosticResult(profile);
  }, [mode, profile]);

  const localWeakestPillars = useMemo(() => {
    if (!localShield) return [];
    return getWeakestPillars(localShield.pillarScores, 3);
  }, [localShield]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading diagnostic…
        </p>
      </div>
    );
  }

  if (mode === "empty") {
    return <EmptyState />;
  }

  const isCloud = mode === "cloud";
  const shield = isCloud ? cloudSnapshot!.shield : localShield!;
  const weakestPillars = isCloud
    ? cloudSnapshot!.weakestPillars
    : localWeakestPillars;
  const completedAt = isCloud
    ? cloudSnapshot!.completedAt
    : profile!.completedAt;
  const profileSource: ProfileSource = isCloud ? "cloud" : "local";
  const footerLabel = isCloud ? "Cloud Profile" : "Local Profile";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <ProfileSourceBadge source={profileSource} />
      </div>

      <ShieldDiagnosticSummary shield={shield} />
      <ShieldPillarCards
        pillarScores={shield.pillarScores}
        weakestPillars={weakestPillars.map((item) => item.pillar)}
      />
      <ShieldReadinessPanel weakestPillars={weakestPillars} />

      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
        Preliminary diagnostic · {footerLabel} · Profile captured{" "}
        {new Date(completedAt).toLocaleDateString("en-SG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
