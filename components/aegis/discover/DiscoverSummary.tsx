"use client";

import Link from "next/link";
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
}

function formatScore(value: number): string {
  return new Intl.NumberFormat("en-SG", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFactor(value: number): string {
  return value.toFixed(3);
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

export default function DiscoverSummary({
  result,
  sections,
  onBack,
}: DiscoverSummaryProps) {
  const completed = sections.filter((section) => section.completeness >= 80);
  const missing = sections.filter((section) => section.completeness < 50);

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/60 p-6 sm:p-10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/8 via-transparent to-transparent" />
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

        <div className="relative">
          <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-[#D1A866]/80">
            Discover™ Summary
          </p>
          <h2 className="mt-2 text-2xl font-light tracking-wide text-[#F3F1EA] sm:text-3xl">
            Financial Profile Architecture Complete
          </h2>
          <p className="mt-3 max-w-2xl text-sm font-light leading-relaxed text-[#F3F1EA]/45">
            Your institutional financial profile has been captured. Discover Score™
            and Data Confidence Factor™ establish the foundation for Shield
            Diagnostic analysis.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <ScoreRing score={result.discoverScore} label="Discover Score™" />

        <div className="hidden h-24 w-px bg-[#D1A866]/15 lg:block" />

        <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-6 sm:p-8">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Data Confidence Factor™
          </p>
          <p className="mt-3 font-mono text-4xl font-light tabular-nums text-[#F3F1EA]">
            {formatFactor(result.dataConfidenceFactor)}
          </p>
          <p className="mt-2 text-xs font-light text-[#F3F1EA]/40">
            Range 0.70 – 1.00 · Applied to Shield Score adjustment
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
            Completed Sections
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
                  <span className="font-mono text-xs tabular-nums text-[#D1A866]/70">
                    {Math.round(section.completeness)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-light text-[#F3F1EA]/35">
              No sections fully complete yet. Continue refining your profile.
            </p>
          )}
        </section>

        <section className="rounded-sm border border-[#D1A866]/12 bg-[#10283A]/35 p-6">
          <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.18em] text-[#F3F1EA]/40">
            Missing Sections
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
              All sections meet minimum completeness thresholds.
            </p>
          )}
        </section>
      </div>

      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/25 bg-[#1A2A2B]/40 p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,_#D1A866_0%,_transparent_70%)] opacity-10" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/80">
              Suggested Next Step
            </p>
            <p className="mt-2 text-lg font-light text-[#F3F1EA]">
              Proceed to Shield Diagnostic
            </p>
            <p className="mt-1 text-sm font-light text-[#F3F1EA]/40">
              Run the AEGIS Shield™ composite assessment against your captured
              profile.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onBack}
              className="rounded-sm border border-[#D1A866]/20 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.15em] text-[#F3F1EA]/60 transition-colors hover:border-[#D1A866]/35 hover:text-[#F3F1EA]"
            >
              Review Profile
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

      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-[#F3F1EA]/20">
        Discover Score {formatScore(result.discoverScore)} · Confidence{" "}
        {formatFactor(result.dataConfidenceFactor)}
      </p>
    </div>
  );
}
