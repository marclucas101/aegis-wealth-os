"use client";

import Link from "next/link";
import type { ShieldPillar } from "@/src/lib/scoring/types";

interface WeakestPillarItem {
  pillar: ShieldPillar;
  label: string;
  score: number;
}

interface ShieldReadinessPanelProps {
  weakestPillars: WeakestPillarItem[];
}

export default function ShieldReadinessPanel({
  weakestPillars,
}: ShieldReadinessPanelProps) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[#D1A866]/25 bg-[#1A2A2B]/40">
      <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,_#D1A866_0%,_transparent_70%)] opacity-10" />

      <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/80">
            Where to focus first
          </p>
          <h3 className="mt-2 text-lg font-light text-[#F3F1EA]">
            Your three lowest-scoring pillars
          </h3>
          <p className="mt-2 max-w-xl text-sm font-light text-[#F3F1EA]/45">
            These are starting points — not judgments. Your Wealth Roadmap turns
            them into practical steps with expected impact.
          </p>

          <ol className="mt-6 space-y-3">
            {weakestPillars.map((item, index) => (
              <li
                key={item.pillar}
                className="flex items-center justify-between border-b border-[#D1A866]/8 pb-3 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[10px] text-[#D1A866]/50">
                    {index + 1}
                  </span>
                  <span className="text-sm font-light text-[#F3F1EA]/75">
                    {item.label}
                  </span>
                </div>
                <span className="font-mono text-sm tabular-nums text-[#D1A866]/80">
                  {Math.round(item.score)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-4 lg:min-w-[16rem]">
          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50 p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D1A866]/70">
              Recommended next step
            </p>
            <p className="mt-2 text-base font-light text-[#F3F1EA]">
              Open your Wealth Roadmap
            </p>
            <p className="mt-1 text-xs font-light text-[#F3F1EA]/45">
              See prioritised actions tailored to your gaps — mark progress as
              you go.
            </p>
          </div>

          <Link
            href="/roadmap"
            className="rounded-sm border border-[#D1A866]/40 bg-[#D1A866]/10 px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.15em] text-[#D1A866] transition-colors hover:bg-[#D1A866]/20"
          >
            Wealth Roadmap →
          </Link>
          <Link
            href="/dashboard"
            className="text-center text-[10px] uppercase tracking-[0.14em] text-[#F3F1EA]/40 transition-colors hover:text-[#F3F1EA]/65"
          >
            View full dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}
