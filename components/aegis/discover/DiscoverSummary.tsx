"use client";

import Link from "next/link";
import ClientTrustNotice from "@/components/aegis/client/ClientTrustNotice";
import type { DiscoverCompleteness, DiscoverScoreResult } from "@/src/lib/scoring/types";

export interface SectionSummary {
  id: keyof DiscoverCompleteness;
  title: string;
  completeness: number;
}

interface DiscoverSummaryProps {
  result: DiscoverScoreResult;
  sections: SectionSummary[];
  onBack: () => void;
  saveWarning?: string | null;
  isSavingRemote?: boolean;
}

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#D1A866"
            strokeOpacity="0.1"
            strokeWidth="4"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#D1A866"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-light tabular-nums text-[#D1A866]">
            {Math.round(score)}
          </span>
        </div>
      </div>
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
        {label}
      </p>
    </div>
  );
}

function SaveStatusBanner({
  saveWarning,
  isSavingRemote,
}: {
  saveWarning?: string | null;
  isSavingRemote?: boolean;
}) {
  if (saveWarning) {
    return (
      <div
        role="status"
        className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3"
      >
        <p className="text-sm font-light text-amber-200/90">{saveWarning}</p>
        <p className="mt-1 text-xs text-amber-200/60">
          Your profile is still saved on this device. Sign in to sync across
          devices.
        </p>
      </div>
    );
  }

  if (isSavingRemote) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-4 py-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D1A866]" />
        <p className="text-sm font-light text-[#F3F1EA]/50">
          Saving to your secure account…
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-sm border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
      <span className="text-emerald-400/90">✓</span>
      <p className="text-sm font-light text-emerald-200/90">
        Profile saved — you can return and update anytime.
      </p>
    </div>
  );
}

export default function DiscoverSummary({
  result,
  sections,
  onBack,
  saveWarning,
  isSavingRemote = false,
}: DiscoverSummaryProps) {
  const completed = sections.filter((section) => section.completeness >= 80);
  const missing = sections.filter((section) => section.completeness < 50);
  const confidencePct = Math.round(result.dataConfidenceFactor * 100);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 p-6 sm:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/8 via-transparent to-transparent" />
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
            Profile complete
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
            You&apos;re ready for your Shield Diagnostic
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/50">
            We&apos;ve captured your financial picture. Next, we&apos;ll score
            seven pillars of your shield and show where to focus.
          </p>
        </div>
      </header>

      <SaveStatusBanner
        saveWarning={saveWarning}
        isSavingRemote={isSavingRemote}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <ScoreRing score={result.discoverScore} label="Profile quality" />

        <div className="hidden h-24 w-px bg-[#D1A866]/15 lg:block" />

        <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-6 sm:p-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Score accuracy
          </p>
          <p className="mt-3 font-mono text-4xl font-light tabular-nums text-[#F3F1EA]">
            {confidencePct}%
          </p>
          <p className="mt-2 text-xs font-light text-[#F3F1EA]/40">
            Based on how complete and recent your answers are. Higher accuracy
            means a more reliable Shield score.
          </p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[#D1A866]/10">
            <div
              className="h-full bg-gradient-to-r from-[#D1A866]/50 to-[#D1A866] transition-all duration-700"
              style={{
                width: `${((result.dataConfidenceFactor - 0.7) / 0.3) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
            Sections in good shape
            <span className="ml-2 font-mono text-[#F3F1EA]/50">
              ({completed.length})
            </span>
          </p>
          {completed.length > 0 ? (
            <ul className="space-y-2">
              {completed.map((section) => (
                <li
                  key={section.id}
                  className="flex items-center justify-between border-b border-[#D1A866]/6 pb-2 last:border-0"
                >
                  <span className="text-sm font-light text-[#F3F1EA]/70">
                    {section.title}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-emerald-400/80">
                    {Math.round(section.completeness)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-light text-[#F3F1EA]/35">
              Keep refining — stronger sections improve your Shield score
              accuracy.
            </p>
          )}
        </section>

        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[#F3F1EA]/40">
            Worth revisiting
            <span className="ml-2 font-mono text-[#F3F1EA]/30">
              ({missing.length})
            </span>
          </p>
          {missing.length > 0 ? (
            <ul className="space-y-2">
              {missing.map((section) => (
                <li
                  key={section.id}
                  className="flex items-center justify-between border-b border-[#D1A866]/6 pb-2 last:border-0"
                >
                  <span className="text-sm font-light text-[#F3F1EA]/50">
                    {section.title}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#F3F1EA]/30">
                    {Math.round(section.completeness)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-light text-[#F3F1EA]/50">
              All sections meet a solid minimum — great work.
            </p>
          )}
        </section>
      </div>

      <section className="rounded-sm border border-[#D1A866]/15 bg-[#071B2A]/45 p-6 sm:p-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          What happens next
        </p>
        <ol className="mt-4 space-y-3">
          {[
            "Shield Diagnostic scores seven areas of your financial life",
            "Your Shield Dashboard brings score, gaps, and benchmarks together",
            "Your Wealth Roadmap turns gaps into clear, trackable actions",
          ].map((step, index) => (
            <li
              key={step}
              className="flex gap-3 text-sm font-light text-[#F3F1EA]/60"
            >
              <span className="font-mono text-[10px] text-[#D1A866]/70">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>

      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/25 bg-[#1A2A2B]/40 p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,_#D1A866_0%,_transparent_70%)] opacity-10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/80">
              Ready when you are
            </p>
            <p className="mt-2 text-lg font-light text-[#F3F1EA]">
              View your Shield Diagnostic
            </p>
            <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
              See your pillar scores and where to focus first.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              className="rounded-sm border border-[#D1A866]/20 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/60 transition-colors hover:border-[#D1A866]/35 hover:text-[#F3F1EA]"
            >
              Edit profile
            </button>
            <Link
              href="/shield-diagnostic"
              className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
            >
              Shield Diagnostic →
            </Link>
          </div>
        </div>
      </section>

      <ClientTrustNotice variant="compact" context="general" />

      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
        Profile quality {formatScore(result.discoverScore)} · Accuracy{" "}
        {confidencePct}%
      </p>
    </div>
  );
}
