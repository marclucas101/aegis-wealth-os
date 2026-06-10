"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import BlueprintClientProfile from "@/components/aegis/blueprint/BlueprintClientProfile";
import BlueprintEmptyState from "@/components/aegis/blueprint/BlueprintEmptyState";
import BlueprintExecutiveSummary from "@/components/aegis/blueprint/BlueprintExecutiveSummary";
import BlueprintPillarAnalysis from "@/components/aegis/blueprint/BlueprintPillarAnalysis";
import BlueprintRoadmapSummary from "@/components/aegis/blueprint/BlueprintRoadmapSummary";
import BlueprintScoreOverview from "@/components/aegis/blueprint/BlueprintScoreOverview";
import BlueprintStressSummary from "@/components/aegis/blueprint/BlueprintStressSummary";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import {
  computeBlueprintFromProfile,
  loadDiscoverProfile,
  type BlueprintPageResults,
  type DiscoverStoredProfile,
} from "@/lib/aegis/localProfile";
import type { WealthBlueprintSnapshot } from "@/lib/supabase/moduleQueries";

type BlueprintMode = "loading" | "empty" | "cloud" | "local";
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

export default function WealthBlueprintClient() {
  const [mode, setMode] = useState<BlueprintMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [cloudSnapshot, setCloudSnapshot] =
    useState<WealthBlueprintSnapshot | null>(null);
  const [saveState, setSaveState] = useState<SnapshotSaveState>("idle");
  const [latestSavedAt, setLatestSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBlueprint() {
      try {
        const response = await fetch("/api/wealth-blueprint/current", {
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
          | ({ ok: true } & WealthBlueprintSnapshot)
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

    void loadBlueprint();

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
        const response = await fetch("/api/wealth-blueprint/history", {
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
      const response = await fetch("/api/wealth-blueprint/save", {
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

  const localResults: BlueprintPageResults | null = useMemo(() => {
    if (mode !== "local" || !profile) return null;
    return computeBlueprintFromProfile(profile);
  }, [mode, profile]);

  const cloudResults: BlueprintPageResults | null = useMemo(() => {
    if (mode !== "cloud" || !cloudSnapshot) return null;
    return cloudSnapshotToResults(cloudSnapshot);
  }, [mode, cloudSnapshot]);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Preparing report preview…
        </p>
      </div>
    );
  }

  const results = mode === "cloud" ? cloudResults : localResults;

  if (mode === "empty" || !results) {
    return <BlueprintEmptyState />;
  }

  const profileSource: ProfileSource = mode === "cloud" ? "cloud" : "local";
  const badgeLabel = mode === "cloud" ? "Cloud Profile" : "Local Profile";

  const reportDate = new Date(results.completedAt).toLocaleDateString("en-SG", {
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
                Wealth Blueprint™
              </h1>
              <p className="mt-2 text-sm font-light text-[#F3F1EA]/50">
                Your personal planning report · For review with your advisor
              </p>
            </div>

            <div className="shrink-0 text-left sm:text-right">
              <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
                Prepared For
              </p>
              <p className="mt-1 text-sm text-[#F3F1EA]">{clientName}</p>
              <p className="mt-3 text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
                Report Date
              </p>
              <p className="mt-1 text-sm text-[#F3F1EA]/70">{reportDate}</p>
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

      <nav
        aria-label="Report sections"
        className="mb-8 rounded-sm border border-[#D1A866]/12 bg-[#071B2A]/40 px-5 py-4 sm:px-6"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
          In this report
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-light text-[#F3F1EA]/50">
          {[
            "Profile summary",
            "Executive overview",
            "Shield scores",
            "Pillar analysis",
            "Stress highlights",
            "Roadmap outlook",
          ].map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <span className="text-[#D1A866]/50">·</span>
              {item}
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-8 sm:gap-10">
        <ReportSection label="Section 1" title="Profile summary">
          <BlueprintClientProfile
            client={results.client}
            formData={results.formData}
            completedAt={results.completedAt}
          />
        </ReportSection>

        <ReportSection label="Section 2" title="Executive overview">
          <BlueprintExecutiveSummary
            results={results}
            saveState={mode === "cloud" ? saveState : undefined}
          />
        </ReportSection>

        <ReportSection label="Section 3" title="Shield scores">
          <BlueprintScoreOverview
            shield={results.shield}
            awri={results.awri}
          />
        </ReportSection>

        <ReportSection label="Section 4" title="Pillar analysis">
          <BlueprintPillarAnalysis
            pillarScores={results.shield.pillarScores}
            weakestPillars={results.weakestPillars}
          />
        </ReportSection>

        <ReportSection label="Section 5" title="Stress highlights">
          <BlueprintStressSummary
            topExposures={results.topStressExposures}
            preStressScore={results.shield.adjustedShieldScore}
          />
        </ReportSection>

        <ReportSection label="Section 6" title="Roadmap outlook">
          <BlueprintRoadmapSummary
            shield={results.shield}
            projected={results.projected}
            roadmap={results.roadmap}
          />
        </ReportSection>

        <ClientTrustNotice variant="full" context="planning" />
      </div>

      <footer className="mt-12 border-t border-[#D1A866]/15 pt-8 sm:mt-16">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
              AEGIS Wealth Blueprint™ · {badgeLabel} · Confidential · For
              architectural review only
            </p>
            <p className="mt-2 text-xs font-light text-[#F3F1EA]/35">
              Planning support only — not financial, legal, or tax advice.
              Discuss outputs with your qualified advisor before acting.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
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
                      : "Save Blueprint Snapshot"}
              </button>
            )}

            <Link
              href="/wealth-blueprint/print?print=1"
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
              Export / Print Report
            </Link>
          </div>
        </div>
      </footer>
    </article>
  );
}

function ReportSection({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3 border-b border-[#D1A866]/10 pb-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/60">
          {label}
        </span>
        <h2 className="text-base font-light text-[#F3F1EA]/85">{title}</h2>
      </div>
      {children}
    </section>
  );
}
