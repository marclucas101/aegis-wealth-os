"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatCurrency } from "@/components/aegis/ShieldScoreCard";
import RoadmapActionCard from "@/components/aegis/roadmap/RoadmapActionCard";
import RoadmapEmptyState from "@/components/aegis/roadmap/RoadmapEmptyState";
import RoadmapProgressPanel from "@/components/aegis/roadmap/RoadmapProgressPanel";
import RoadmapTimeline from "@/components/aegis/roadmap/RoadmapTimeline";
import {
  computeRoadmapFromProfile,
  loadDiscoverProfile,
  loadRoadmapStatuses,
  saveRoadmapStatus,
  type DiscoverStoredProfile,
  type RoadmapItemStatus,
  type RoadmapPageResults,
} from "@/lib/aegis/localProfile";

type RoadmapMode = "loading" | "empty" | "live";

export default function RoadmapClient() {
  const [mode, setMode] = useState<RoadmapMode>("loading");
  const [profile, setProfile] = useState<DiscoverStoredProfile | null>(null);
  const [statuses, setStatuses] = useState<Record<string, RoadmapItemStatus>>({});

  useEffect(() => {
    const saved = loadDiscoverProfile();
    setProfile(saved);
    setStatuses(loadRoadmapStatuses());
    setMode(saved ? "live" : "empty");
  }, []);

  const results: RoadmapPageResults | null = useMemo(() => {
    if (mode !== "live" || !profile) return null;
    return computeRoadmapFromProfile(profile, statuses);
  }, [mode, profile, statuses]);

  const handleStatusChange = useCallback((id: string, status: RoadmapItemStatus) => {
    saveRoadmapStatus(id, status);
    setStatuses((current) => ({ ...current, [id]: status }));
  }, []);

  if (mode === "loading") {
    return (
      <div className="rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30 p-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/30">
          Loading roadmap…
        </p>
      </div>
    );
  }

  if (mode === "empty" || !results) {
    return <RoadmapEmptyState />;
  }

  const completedCount = results.roadmap.filter(
    (item) => item.status === "completed"
  ).length;
  const inProgressCount = results.roadmap.filter(
    (item) => item.status === "in_progress"
  ).length;

  return (
    <>
      <header className="mb-8 border-b border-[#D1A866]/15 pb-6 sm:mb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-sm border border-[#D1A866]/35 bg-[#D1A866]/10 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#D1A866]">
              Live Discover Profile
            </span>
            <p className="mt-3 text-sm text-[#F3F1EA]/45">
              Prioritised architecture actions derived from your weakest shield
              pillars
            </p>
          </div>

          <div className="rounded-sm border border-[#D1A866]/15 bg-[#10283A]/40 px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.15em] text-[#F3F1EA]/40">
              Client Profile
            </p>
            <p className="mt-1 text-sm text-[#F3F1EA]">
              {results.client.occupation ?? "Client"} · Age {results.client.age}
            </p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-[#D1A866]/70">
              Net Worth {formatCurrency(results.client.netWorth)}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <RoadmapProgressPanel
          shield={results.shield}
          projected={results.projected}
        />

        <div className="flex flex-wrap items-center gap-4 rounded-sm border border-[#D1A866]/10 bg-[#1A2A2B]/30 px-5 py-3">
          <StatPill label="Total Actions" value={String(results.roadmap.length)} />
          <StatPill label="In Progress" value={String(inProgressCount)} />
          <StatPill label="Completed" value={String(completedCount)} highlight />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <div className="border-b border-[#D1A866]/10 pb-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
                Priority Actions
              </p>
              <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
                Weakest pillar remediation queue
              </h3>
            </div>

            {results.roadmap.map((item, index) => (
              <RoadmapActionCard
                key={item.id}
                item={item}
                index={index}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>

          <RoadmapTimeline items={results.roadmap} />
        </div>
      </div>

      <footer className="mt-10 border-t border-[#D1A866]/10 pt-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#F3F1EA]/25">
          AEGIS Roadmap™ · Live Profile · Captured{" "}
          {new Date(results.completedAt).toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </footer>
    </>
  );
}

function StatPill({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9px] uppercase tracking-wider text-[#F3F1EA]/35">
        {label}
      </span>
      <span
        className={`font-mono text-sm tabular-nums ${
          highlight ? "text-[#D1A866]" : "text-[#F3F1EA]/75"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
