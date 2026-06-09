"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import StressPillarImpact from "@/components/aegis/stress/StressPillarImpact";
import { SCENARIO_LABELS } from "@/components/aegis/stress/StressScenarioCard";
import { getRating } from "@/src/lib/scoring";
import type { ShieldRating, StressTestResult } from "@/src/lib/scoring/types";

interface StressImpactPanelProps {
  test: StressTestResult;
  preStressRating: ShieldRating;
}

function ShieldVisual({
  preScore,
  postScore,
}: {
  preScore: number;
  postScore: number;
}) {
  const stabilityRatio = postScore / Math.max(preScore, 1);
  const weakened = stabilityRatio < 0.9;
  const severelyWeakened = stabilityRatio < 0.75;

  const shieldOpacity = 0.45 + stabilityRatio * 0.55;
  const borderOpacity = weakened ? 0.35 : 0.75;
  const fillClass = severelyWeakened
    ? "text-[#F3F1EA]/20"
    : weakened
      ? "text-[#F3F1EA]/35"
      : "text-[#D1A866]/50";

  return (
    <div className="relative flex items-center justify-center py-6">
      <div
        className="absolute inset-0 rounded-full blur-3xl transition-opacity duration-700"
        style={{
          background: severelyWeakened
            ? "radial-gradient(circle, rgba(243,241,234,0.04) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(209,168,102,0.12) 0%, transparent 70%)",
          opacity: shieldOpacity,
        }}
      />

      <svg
        viewBox="0 0 120 140"
        className={`relative h-32 w-28 transition-all duration-700 sm:h-36 sm:w-32 ${fillClass}`}
        style={{ opacity: shieldOpacity }}
        aria-hidden
      >
        <path
          d="M60 8L12 28v38c0 32 20 58 48 66 28-8 48-34 48-66V28L60 8z"
          fill="currentColor"
          stroke="#D1A866"
          strokeOpacity={borderOpacity}
          strokeWidth="1.5"
        />
        {weakened && (
          <>
            <path
              d="M38 52 L52 68 M82 48 L68 66"
              stroke="#F3F1EA"
              strokeOpacity={severelyWeakened ? 0.35 : 0.2}
              strokeWidth="1"
              strokeLinecap="round"
            />
            {severelyWeakened && (
              <path
                d="M60 38 L60 78 M44 58 L76 58"
                stroke="#F3F1EA"
                strokeOpacity="0.15"
                strokeWidth="0.75"
                strokeLinecap="round"
              />
            )}
          </>
        )}
      </svg>

      <div className="absolute bottom-2 text-center">
        <p className="text-[9px] uppercase tracking-[0.15em] text-[#F3F1EA]/35">
          {severelyWeakened
            ? "Elevated absorption strain"
            : weakened
              ? "Moderate structural adjustment"
              : "Architecture remains resilient"}
        </p>
      </div>
    </div>
  );
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
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
        {label}
      </span>
      <span
        className={`font-mono text-xl font-light tabular-nums tracking-tight sm:text-2xl ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]"
        }`}
      >
        {value}
      </span>
      {sublabel && (
        <span className="text-[10px] text-[#F3F1EA]/40">{sublabel}</span>
      )}
    </div>
  );
}

export default function StressImpactPanel({
  test,
  preStressRating,
}: StressImpactPanelProps) {
  const postStressRating = getRating(test.postStressScore);
  const scoreImpact = test.preStressScore - test.postStressScore;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Scenario Impact Analysis
            </p>
            <h3 className="mt-1 text-lg font-light text-[#F3F1EA]">
              {SCENARIO_LABELS[test.scenario]}
            </h3>
            <p className="mt-2 max-w-xl text-sm font-light leading-relaxed text-[#F3F1EA]/45">
              This scenario tests how well the client&apos;s architecture absorbs
              disruption. Outcomes reflect pillar vulnerability, severity
              calibration, and existing mitigation safeguards.
            </p>
          </div>

          <span className="self-start rounded-sm border border-[#D1A866]/20 px-2.5 py-1 text-[9px] uppercase tracking-wider text-[#D1A866]/70">
            {test.severity} severity
          </span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
          <ShieldVisual
            preScore={test.preStressScore}
            postScore={test.postStressScore}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCell
              label="Current Shield Score"
              value={formatScore(test.preStressScore)}
              sublabel={`Rating ${preStressRating}`}
            />
            <MetricCell
              label="Post-Stress Shield Score"
              value={formatScore(test.postStressScore)}
              sublabel={`Rating ${postStressRating}`}
              highlight
            />
            <MetricCell
              label="Score Impact"
              value={`−${formatScore(scoreImpact)}`}
              sublabel="Net shield adjustment"
            />
            <MetricCell
              label="Stress Penalty"
              value={formatScore(test.stressPenalty)}
              sublabel={`Mitigation +${formatScore(test.mitigationCredit)}`}
            />
          </div>
        </div>

        <div className="mt-8 grid gap-6 border-t border-[#D1A866]/10 pt-8 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Rating Transition
            </p>
            <div className="flex items-center gap-4 rounded-sm border border-[#D1A866]/12 bg-[#1A2A2B]/30 px-5 py-4">
              <div className="text-center">
                <p className="font-mono text-2xl font-light text-[#F3F1EA]/70">
                  {preStressRating}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-[#F3F1EA]/30">
                  Pre-stress
                </p>
              </div>
              <span className="text-[#D1A866]/40">→</span>
              <div className="text-center">
                <p className="font-mono text-2xl font-light text-[#D1A866]">
                  {postStressRating}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-[#F3F1EA]/30">
                  Post-stress
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
              Affected Pillars
            </p>
            <StressPillarImpact affectedPillars={test.affectedPillars} />
          </div>
        </div>
      </div>
    </section>
  );
}
