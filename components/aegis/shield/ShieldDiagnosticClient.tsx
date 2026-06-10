"use client";

import { useEffect, useMemo, useState } from "react";
import ClientEmptyState from "@/components/aegis/client/ClientEmptyState";
import ClientPortalHeader from "@/components/aegis/client/ClientPortalHeader";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
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
  const label =
    source === "cloud" ? "Saved to your account" : "Saved on this device";

  return (
    <span className="mb-3 inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
      {label}
    </span>
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
          Preparing your diagnostic…
        </p>
      </div>
    );
  }

  if (mode === "empty") {
    return (
      <ClientEmptyState
        eyebrow="Shield Diagnostic"
        title="Complete Discover first"
        description="Your Shield Diagnostic uses the profile you build in Discover. It takes about 15 minutes and unlocks your personalised scores."
        primaryHref="/discover"
        primaryLabel="Start Discover"
        steps={[
          "Finish your Discover profile",
          "Return here for pillar scores",
          "Open your Roadmap for next steps",
        ]}
      />
    );
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
      <ClientPortalHeader
        eyebrow="Shield Diagnostic"
        title="Your seven-pillar financial health check"
        subtitle="Each pillar reflects a part of your financial life — from everyday stability to long-term legacy. Lower scores highlight where a roadmap action could help most."
        badge={<ProfileSourceBadge source={profileSource} />}
      />

      <div className="rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 px-5 py-4">
        <p className="text-sm font-light text-[#F3F1EA]/55">
          <span className="text-[#F3F1EA]/75">What this means: </span>
          Your Shield score combines these pillars. Focus on flagged gaps first —
          they offer the biggest improvement opportunity.
        </p>
      </div>

      <ShieldDiagnosticSummary shield={shield} />
      <ShieldPillarCards
        pillarScores={shield.pillarScores}
        weakestPillars={weakestPillars.map((item) => item.pillar)}
      />
      <ShieldReadinessPanel weakestPillars={weakestPillars} />

      <ClientTrustNotice variant="compact" context="planning" />

      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
        Diagnostic · {footerLabel} · Profile from{" "}
        {new Date(completedAt).toLocaleDateString("en-SG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
