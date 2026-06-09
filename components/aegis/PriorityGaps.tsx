import { formatScore } from "@/components/aegis/ShieldScoreCard";
import type { RoadmapItem, ShieldPillar } from "@/src/lib/scoring/types";

const PILLAR_LABELS: Record<ShieldPillar, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

const PRIORITY_STYLES: Record<RoadmapItem["priority"], string> = {
  critical: "border-[#D1A866]/50 text-[#D1A866] bg-[#D1A866]/10",
  high: "border-[#D1A866]/35 text-[#D1A866]/90 bg-[#D1A866]/5",
  medium: "border-[#F3F1EA]/20 text-[#F3F1EA]/70 bg-[#F3F1EA]/5",
  low: "border-[#F3F1EA]/15 text-[#F3F1EA]/50 bg-transparent",
};

interface PriorityGapsProps {
  roadmap: RoadmapItem[];
}

export default function PriorityGaps({ roadmap }: PriorityGapsProps) {
  const topGaps = roadmap.slice(0, 3);

  return (
    <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Gap Analysis
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Top Priority Gaps
        </h3>
      </div>

      <div className="grid gap-px bg-[#D1A866]/8 sm:grid-cols-3">
        {topGaps.map((item, index) => (
          <article
            key={item.id}
            className="flex flex-col bg-[#10283A]/80 p-5 sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[#D1A866]/50">
                0{index + 1}
              </span>
              <span
                className={`rounded-sm border px-2 py-0.5 text-[9px] uppercase tracking-wider ${PRIORITY_STYLES[item.priority]}`}
              >
                {item.priority}
              </span>
            </div>

            <h4 className="mb-2 text-sm leading-snug text-[#F3F1EA]">
              {item.title}
            </h4>

            <p className="mb-4 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/40">
              {PILLAR_LABELS[item.pillar]} Pillar
            </p>

            <div className="mt-auto grid grid-cols-3 gap-3 border-t border-[#D1A866]/10 pt-4">
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
                  Impact
                </p>
                <p className="mt-0.5 font-mono text-sm tabular-nums text-[#D1A866]">
                  +{formatScore(item.estimatedImpact)}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
                  Timeline
                </p>
                <p className="mt-0.5 font-mono text-sm text-[#F3F1EA]/80">
                  {item.timelineMonths}mo
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
                  Severity
                </p>
                <p className="mt-0.5 font-mono text-sm text-[#F3F1EA]/80">
                  {item.gapSeverity ?? "—"}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
