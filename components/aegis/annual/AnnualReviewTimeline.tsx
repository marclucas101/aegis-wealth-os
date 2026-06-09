"use client";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { AnnualReviewTimelineYear } from "@/lib/aegis/localProfile";

interface AnnualReviewTimelineProps {
  timeline: AnnualReviewTimelineYear[];
}

export default function AnnualReviewTimeline({
  timeline,
}: AnnualReviewTimelineProps) {
  const currentScore = timeline[0]?.adjustedShieldScore ?? 0;
  const targetScore =
    timeline[timeline.length - 1]?.adjustedShieldScore ?? currentScore;
  const maxScore = Math.max(currentScore, targetScore, ...timeline.map((y) => y.adjustedShieldScore));

  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/20 bg-[#10283A]/80">
      <div className="absolute inset-0 bg-gradient-to-br from-[#D1A866]/5 via-transparent to-transparent" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-[#D1A866]/50 to-transparent" />

      <div className="relative border-b border-[#D1A866]/10 px-6 py-5 sm:px-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Four-Year Progression
        </p>
        <h3 className="mt-1 text-base font-light tracking-wide text-[#F3F1EA] sm:text-lg">
          Shield score timeline
        </h3>
        <p className="mt-1 text-xs text-[#F3F1EA]/40">
          Roadmap-driven projection · Current architecture to target state
        </p>
      </div>

      <div className="relative px-6 py-8 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {timeline.map((year) => {
            const isCurrent = year.yearOffset === 0;
            const isTarget = year.yearOffset === 3;
            const barHeightPercent = Math.max(
              12,
              Math.round((year.adjustedShieldScore / maxScore) * 100)
            );

            return (
              <div
                key={year.calendarYear}
                className={`rounded-sm border px-5 py-5 ${
                  isTarget
                    ? "border-[#D1A866]/35 bg-[#1A2A2B]/50"
                    : isCurrent
                      ? "border-[#D1A866]/20 bg-[#071B2A]/50"
                      : "border-[#D1A866]/10 bg-[#10283A]/40"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-[#D1A866]/60">
                    {year.label}
                  </p>
                  <span className="font-mono text-[10px] tabular-nums text-[#F3F1EA]/35">
                    {year.calendarYear}
                  </span>
                </div>

                <div
                  className={`mt-4 flex h-16 items-end rounded-sm border px-2 pb-1 pt-2 ${
                    isTarget
                      ? "border-[#D1A866]/25 bg-[#071B2A]/40"
                      : "border-[#D1A866]/10 bg-[#071B2A]/30"
                  }`}
                  aria-hidden
                >
                  <div
                    className={`w-full rounded-sm ${
                      isTarget
                        ? "bg-[#D1A866]/70"
                        : isCurrent
                          ? "bg-[#D1A866]/45"
                          : "bg-[#D1A866]/30"
                    }`}
                    style={{ height: `${barHeightPercent}%` }}
                  />
                </div>

                <p
                  className={`mt-3 font-mono text-3xl font-light tabular-nums tracking-tight ${
                    isTarget ? "text-[#D1A866]" : "text-[#F3F1EA]"
                  }`}
                >
                  {formatScore(year.adjustedShieldScore)}
                </p>

                <p className="mt-1 text-xs text-[#F3F1EA]/45">
                  Rating {year.rating}
                </p>

                {!isCurrent && (
                  <div className="mt-4">
                    <div className="flex items-baseline justify-between text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
                      <span>Progress to target</span>
                      <span className="font-mono tabular-nums text-[#D1A866]/70">
                        {year.progressPercent}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-sm bg-[#071B2A]/60">
                      <div
                        className="h-full rounded-sm bg-[#D1A866]/50"
                        style={{ width: `${year.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {year.actionsCompleted > 0 && (
                  <p className="mt-3 text-[10px] text-[#F3F1EA]/35">
                    {year.actionsCompleted} roadmap action
                    {year.actionsCompleted === 1 ? "" : "s"} reflected
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
