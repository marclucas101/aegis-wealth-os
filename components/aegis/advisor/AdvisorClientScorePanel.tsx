"use client";

import { formatPercent, formatScore } from "@/components/aegis/ShieldScoreCard";
import type {
  AdvisorDiscoverSummary,
  AdvisorClientRecord,
} from "@/lib/supabase/advisorClientQueries";
import type {
  AWRIResult,
  BenchmarkResult,
  ClientProfile,
  ShieldScoreResult,
} from "@/src/lib/scoring/types";

interface AdvisorClientScorePanelProps {
  client: AdvisorClientRecord;
  discover: AdvisorDiscoverSummary | null;
  profile: ClientProfile | null;
  shield: ShieldScoreResult | null;
  awri: AWRIResult | null;
  benchmark: BenchmarkResult | null;
}

function MetricCell({
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
    <div className="rounded-sm border border-[#D1A866]/10 bg-[#071B2A]/40 px-4 py-3">
      <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-lg tabular-nums ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </p>
      {sublabel && (
        <p className="mt-0.5 text-[10px] text-[#F3F1EA]/35">{sublabel}</p>
      )}
    </div>
  );
}

export default function AdvisorClientScorePanel({
  client,
  discover,
  profile,
  shield,
  awri,
  benchmark,
}: AdvisorClientScorePanelProps) {
  if (!shield) {
    return (
      <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
        <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
            Score Overview
          </p>
          <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
            Detailed Shield diagnostic and benchmark positioning
          </p>
        </div>
        <div className="relative px-5 py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D1A866]/15 bg-[#071B2A]/50">
            <span className="font-mono text-sm text-[#D1A866]/50" aria-hidden>
              —
            </span>
          </div>
          <p className="text-sm font-light text-[#F3F1EA]/50">
            No Shield Score available yet.
          </p>
          <p className="mt-2 text-xs font-light text-[#F3F1EA]/30">
            The client has not completed Discover onboarding. Score diagnostics
            will populate automatically once intake is finished.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Score Overview
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Current Shield diagnostic and benchmark positioning
        </p>
      </div>

      <div className="relative space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCell
            label="Adjusted Shield"
            value={formatScore(shield.adjustedShieldScore)}
            highlight
          />
          <MetricCell
            label="Raw Shield"
            value={formatScore(shield.rawShieldScore)}
          />
          <MetricCell
            label="Discover Score"
            value={
              discover?.discoverScore != null
                ? formatScore(discover.discoverScore)
                : formatScore(shield.discoverScore)
            }
          />
          <MetricCell
            label="Data Confidence"
            value={formatPercent(
              discover?.dataConfidenceFactor ?? shield.dataConfidenceFactor,
            )}
          />
        </div>

        {awri && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCell label="AWRI" value={formatScore(awri.awri)} highlight />
            <MetricCell label="AWRI Rating" value={awri.rating} />
            <MetricCell
              label="Resilience"
              value={formatScore(awri.resilienceScore)}
            />
            <MetricCell
              label="Governance"
              value={formatScore(awri.governanceScore)}
            />
          </div>
        )}

        {benchmark && (
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/25 px-4 py-4">
            <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
              Benchmark · {benchmark.cohort}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <MetricCell
                label="Cohort Average"
                value={formatScore(benchmark.cohortAverage)}
              />
              <MetricCell
                label="Delta"
                value={`${benchmark.benchmarkDelta >= 0 ? "+" : ""}${formatScore(benchmark.benchmarkDelta)}`}
              />
              <MetricCell
                label="Classification"
                value={benchmark.classification}
              />
            </div>
          </div>
        )}

        {profile && (
          <div className="rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/25 px-4 py-4">
            <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
              Profile Summary
            </p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <p className="text-[#F3F1EA]/70">
                Age <span className="font-mono text-[#F3F1EA]">{profile.age}</span>
              </p>
              <p className="text-[#F3F1EA]/70">
                Status{" "}
                <span className="capitalize text-[#F3F1EA]">
                  {profile.maritalStatus}
                </span>
              </p>
              <p className="text-[#F3F1EA]/70">
                Currency{" "}
                <span className="font-mono text-[#F3F1EA]">
                  {client.currencyCode}
                </span>
              </p>
              <p className="text-[#F3F1EA]/70">
                Occupation{" "}
                <span className="text-[#F3F1EA]">
                  {profile.occupation ?? "—"}
                </span>
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
