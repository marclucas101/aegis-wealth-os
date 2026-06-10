"use client";

import { SCENARIO_LABELS } from "@/components/aegis/stress/StressScenarioCard";
import type { ClientReviewStatusDetail } from "@/lib/supabase/advisorReviewPipeline";
import type { StressTestResult } from "@/src/lib/scoring/types";
import type { PillarScores, ShieldPillar } from "@/src/lib/scoring/types";

const PILLAR_LABELS: Record<ShieldPillar, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

interface AdvisorClientRiskSummaryProps {
  pillarScores: PillarScores | null;
  weakestPillar: ShieldPillar | null;
  topStressExposures: StressTestResult[];
  review: ClientReviewStatusDetail | null;
}

function getWeakestPillars(
  pillarScores: PillarScores | null,
  fallback: ShieldPillar | null,
): ShieldPillar[] {
  if (!pillarScores) {
    return fallback ? [fallback] : [];
  }

  const ranked = (Object.entries(pillarScores) as [ShieldPillar, number][])
    .sort(([, a], [, b]) => a - b)
    .map(([pillar]) => pillar);

  return ranked.slice(0, 2);
}

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function AdvisorClientRiskSummary({
  pillarScores,
  weakestPillar,
  topStressExposures,
  review,
}: AdvisorClientRiskSummaryProps) {
  const weakestPillars = getWeakestPillars(pillarScores, weakestPillar);
  const topStress = topStressExposures[0] ?? null;
  const priorityReason = review?.priorityReasons[0] ?? null;
  const recommendedAction =
    review?.recommendedNextAction ??
    (weakestPillars.length > 0
      ? `Review ${PILLAR_LABELS[weakestPillars[0]]} pillar gaps and align roadmap actions.`
      : "Complete Discover onboarding to establish baseline risk diagnostics.");

  const hasRiskData =
    weakestPillars.length > 0 || topStress != null || priorityReason != null;

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="relative border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Risk Summary
        </p>
        <p className="mt-1 text-sm font-light text-[#F3F1EA]/45">
          Priority exposures and recommended advisory response
        </p>
      </div>

      {!hasRiskData ? (
        <div className="relative px-5 py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#D1A866]/15 bg-[#071B2A]/50">
            <span className="text-lg text-[#D1A866]/50" aria-hidden>
              ◇
            </span>
          </div>
          <p className="text-sm font-light text-[#F3F1EA]/50">
            Risk diagnostics will appear once the client completes Discover and
            stress testing.
          </p>
        </div>
      ) : (
        <div className="relative grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-[#D1A866]/8">
          <div className="space-y-0 divide-y divide-[#D1A866]/8">
            <div className="px-5 py-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
                Weakest pillars
              </p>
              {weakestPillars.length === 0 ? (
                <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
                  No pillar data available.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {weakestPillars.map((pillar, index) => (
                    <span
                      key={pillar}
                      className="inline-flex rounded-sm border border-[#F3F1EA]/15 bg-[#071B2A]/50 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/70"
                    >
                      {index === 0 ? "Primary gap · " : "Secondary · "}
                      {PILLAR_LABELS[pillar]}
                      {pillarScores ? (
                        <span className="ml-2 font-mono text-[#D1A866]">
                          {Math.round(pillarScores[pillar])}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
                Top stress exposure
              </p>
              {topStress ? (
                <div className="mt-3">
                  <p className="text-sm font-light text-[#F3F1EA]">
                    {SCENARIO_LABELS[topStress.scenario]}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
                    {topStress.severity} severity · post-stress{" "}
                    {Math.round(topStress.postStressScore)}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
                  No stress scenarios on file.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-0 divide-y divide-[#D1A866]/8">
            <div className="px-5 py-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
                High-priority reason
              </p>
              {priorityReason ? (
                <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/75">
                  {priorityReason}
                </p>
              ) : (
                <p className="mt-2 text-sm font-light text-[#F3F1EA]/45">
                  No elevated priority flags at this time.
                </p>
              )}
            </div>

            <div className="px-5 py-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#F3F1EA]/40">
                Recommended next action
              </p>
              <p className="mt-2 text-sm font-light leading-relaxed text-[#F3F1EA]/75">
                {recommendedAction}
              </p>
              <button
                type="button"
                onClick={() => scrollToSection("client-review")}
                className="mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-[#D1A866]/80 transition-colors hover:text-[#D1A866]"
              >
                Open review status →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
