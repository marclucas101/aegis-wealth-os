import { PILLAR_LABELS } from "@/lib/aegis/localProfile";
import type { RoadmapItem } from "@/src/lib/scoring/types";

const STATUS_LABELS: Record<RoadmapItem["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

interface RoadmapSummaryCounts {
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
}

interface ReportActionPlanProps {
  items?: RoadmapItem[];
  summary?: RoadmapSummaryCounts;
  emptyMessage?: string;
  title?: string;
}

export default function ReportActionPlan({
  items = [],
  summary,
  emptyMessage = "No roadmap actions recorded for this report.",
  title = "Priority Actions",
}: ReportActionPlanProps) {
  const counts =
    summary ??
    (items.length > 0
      ? {
          completed: items.filter((i) => i.status === "completed").length,
          inProgress: items.filter((i) => i.status === "in_progress").length,
          notStarted: items.filter((i) => i.status === "not_started").length,
          total: items.length,
        }
      : null);

  if (!counts && items.length === 0) {
    return (
      <p className="text-sm font-light text-[#10283A]/50">{emptyMessage}</p>
    );
  }

  return (
    <div className="space-y-6">
      {counts ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-[#10283A]/10 px-4 py-3 text-center">
            <p className="font-mono text-xl tabular-nums text-[#B8860B]">
              {counts.completed}
            </p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#10283A]/45">
              Completed
            </p>
          </div>
          <div className="border border-[#10283A]/10 px-4 py-3 text-center">
            <p className="font-mono text-xl tabular-nums text-[#10283A]">
              {counts.inProgress}
            </p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#10283A]/45">
              In Progress
            </p>
          </div>
          <div className="border border-[#10283A]/10 px-4 py-3 text-center">
            <p className="font-mono text-xl tabular-nums text-[#10283A]/55">
              {counts.notStarted}
            </p>
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#10283A]/45">
              Not Started
            </p>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#10283A]/45">
            {title}
          </p>
          <ul className="mt-3 space-y-2">
            {items.map((item, index) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 border border-[#10283A]/8 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-[#10283A]">
                    <span className="mr-2 font-mono text-[10px] text-[#10283A]/35">
                      {index + 1}.
                    </span>
                    {item.title}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#10283A]/40">
                    {PILLAR_LABELS[item.pillar] ?? item.pillar} ·{" "}
                    {item.timelineMonths} mo timeline
                  </p>
                </div>
                <span className="shrink-0 text-[10px] uppercase tracking-[0.08em] text-[#10283A]/50">
                  {STATUS_LABELS[item.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
