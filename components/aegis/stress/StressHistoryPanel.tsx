"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { SCENARIO_LABELS } from "@/components/aegis/stress/StressScenarioCard";
import type { StressScenario, StressSeverity } from "@/src/lib/scoring/types";
import type { PillarScores } from "@/src/lib/scoring/types";

export type StressTestHistoryEntry = {
  id: string;
  client_id: string;
  shield_score_id: string;
  scenario: StressScenario;
  severity: StressSeverity;
  pre_stress_score: number;
  post_stress_score: number;
  score_drop: number;
  affected_pillars: Partial<PillarScores>;
  mitigation_notes: string;
  created_at: string;
};

function formatRunTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface StressHistoryPanelProps {
  runs: StressTestHistoryEntry[];
  loading?: boolean;
}

export default function StressHistoryPanel({
  runs,
  loading = false,
}: StressHistoryPanelProps) {
  return (
    <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 p-5">
      <div className="mb-4 border-b border-[#D1A866]/10 pb-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Recent Stress Test History
        </p>
        <p className="mt-0.5 text-sm font-light text-[#F3F1EA]/50">
          Saved scenario runs for your cloud profile
        </p>
      </div>

      {loading ? (
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading history…
        </p>
      ) : runs.length === 0 ? (
        <p className="text-sm font-light text-[#F3F1EA]/40">
          No saved stress runs yet. Run a scenario to build your history.
        </p>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex flex-col gap-2 rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F3F1EA]">
                  {SCENARIO_LABELS[run.scenario]}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
                  {run.severity} severity · {formatRunTimestamp(run.created_at)}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-4 text-right">
                <div>
                  <p className="font-mono text-xs tabular-nums text-[#F3F1EA]/70">
                    {formatScore(run.pre_stress_score)} →{" "}
                    {formatScore(run.post_stress_score)}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/30">
                    Shield transition
                  </p>
                </div>
                <div>
                  <p className="font-mono text-xs tabular-nums text-[#D1A866]/80">
                    −{formatScore(run.score_drop)}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/30">
                    Score drop
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
