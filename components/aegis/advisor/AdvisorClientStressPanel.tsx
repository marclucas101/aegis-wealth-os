"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { SCENARIO_LABELS } from "@/components/aegis/stress/StressScenarioCard";
import type {
  AdvisorStressHistoryEntry,
} from "@/lib/supabase/advisorClientQueries";
import type { StressTestResult } from "@/src/lib/scoring/types";

interface AdvisorClientStressPanelProps {
  topStressExposures: StressTestResult[];
  stressHistory: AdvisorStressHistoryEntry[];
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityStyles(severity: string): string {
  switch (severity) {
    case "extreme":
    case "severe":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    case "moderate":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    default:
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }
}

export default function AdvisorClientStressPanel({
  topStressExposures,
  stressHistory,
}: AdvisorClientStressPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Stress Exposure
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Top vulnerabilities and recent scenario runs
        </p>
      </div>

      <div className="relative space-y-5 p-5">
        <div>
          <p className="mb-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
            Top Exposures
          </p>
          {topStressExposures.length === 0 ? (
            <div className="rounded-sm border border-[#D1A866]/8 bg-[#071B2A]/30 px-4 py-6 text-center">
              <p className="text-sm font-light text-[#F3F1EA]/50">
                No stress test data available.
              </p>
              <p className="mt-2 text-xs font-light text-[#F3F1EA]/30">
                Run stress scenarios from the client portal to surface
                vulnerability exposures here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {topStressExposures.map((test) => (
                <li
                  key={`${test.scenario}-${test.severity}`}
                  className="flex items-center justify-between gap-3 rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/25 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[#F3F1EA]">
                      {SCENARIO_LABELS[test.scenario]}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] ${severityStyles(test.severity)}`}
                    >
                      {test.severity}
                    </span>
                  </div>
                  <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                    <p className="text-[#F3F1EA]/70">
                      {formatScore(test.preStressScore)} →{" "}
                      {formatScore(test.postStressScore)}
                    </p>
                    <p className="mt-0.5 text-red-300/80">
                      −{formatScore(test.preStressScore - test.postStressScore)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[#D1A866]/65">
            Recent History
          </p>
          {stressHistory.length === 0 ? (
            <div className="rounded-sm border border-[#D1A866]/8 bg-[#071B2A]/30 px-4 py-6 text-center">
              <p className="text-sm font-light text-[#F3F1EA]/50">
                No saved stress runs yet.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#D1A866]/8 rounded-sm border border-[#D1A866]/10">
              {stressHistory.slice(0, 6).map((run) => (
                <li
                  key={run.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-[#F3F1EA]">
                      {SCENARIO_LABELS[run.scenario]}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
                      {run.severity} · {formatTimestamp(run.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-xs tabular-nums text-[#F3F1EA]/60">
                    −{formatScore(run.scoreDrop)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
