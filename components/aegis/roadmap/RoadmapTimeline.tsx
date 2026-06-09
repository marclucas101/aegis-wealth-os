"use client";

import { PILLAR_LABELS } from "@/lib/aegis/localProfile";
import type { RoadmapItem } from "@/src/lib/scoring/types";

interface RoadmapTimelineProps {
  items: RoadmapItem[];
}

export default function RoadmapTimeline({ items }: RoadmapTimelineProps) {
  const sorted = [...items].sort(
    (a, b) => a.timelineMonths - b.timelineMonths
  );
  const maxMonths = Math.max(...sorted.map((item) => item.timelineMonths), 12);

  return (
    <section className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Implementation Timeline
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Sequenced action horizon
        </h3>
      </div>

      <div className="space-y-0 px-5 py-6 sm:px-6">
        <div className="mb-6 flex justify-between text-[9px] uppercase tracking-wider text-[#F3F1EA]/30">
          <span>Now</span>
          <span>{maxMonths} months</span>
        </div>

        <div className="space-y-4">
          {sorted.map((item) => {
            const widthPercent = Math.max(
              8,
              Math.round((item.timelineMonths / maxMonths) * 100)
            );
            const isCompleted = item.status === "completed";
            const isInProgress = item.status === "in_progress";

            return (
              <div key={item.id} className="group">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <p
                    className={`truncate text-xs ${
                      isCompleted
                        ? "text-[#F3F1EA]/40 line-through"
                        : "text-[#F3F1EA]/75"
                    }`}
                  >
                    {item.title}
                  </p>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-[#D1A866]/60">
                    {item.timelineMonths}mo
                  </span>
                </div>

                <div className="relative h-2 overflow-hidden rounded-sm bg-[#071B2A]/60">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-sm transition-all duration-500 ${
                      isCompleted
                        ? "bg-[#D1A866]/50"
                        : isInProgress
                          ? "bg-[#D1A866]/35"
                          : "bg-[#D1A866]/20"
                    }`}
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>

                <p className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#F3F1EA]/30">
                  {PILLAR_LABELS[item.pillar]} · {item.priority} priority
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
