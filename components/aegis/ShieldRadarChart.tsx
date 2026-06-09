"use client";

import type { PillarScores } from "@/src/lib/scoring/types";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

const PILLAR_LABELS: Record<keyof PillarScores, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

interface ShieldRadarChartProps {
  pillarScores: PillarScores;
}

export default function ShieldRadarChart({ pillarScores }: ShieldRadarChartProps) {
  const data = (Object.keys(pillarScores) as (keyof PillarScores)[]).map(
    (key) => ({
      pillar: PILLAR_LABELS[key],
      score: pillarScores[key],
      fullMark: 100,
    })
  );

  return (
    <section className="flex h-full flex-col rounded-sm border border-[#D1A866]/15 bg-[#10283A]/60">
      <div className="border-b border-[#D1A866]/10 px-5 py-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#D1A866]/70">
          Pillar Architecture
        </p>
        <h3 className="mt-0.5 text-sm font-light text-[#F3F1EA]">
          Seven-Pillar Shield Profile
        </h3>
      </div>

      <div className="flex flex-1 items-center justify-center px-2 py-4">
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
            <PolarGrid
              stroke="#D1A866"
              strokeOpacity={0.12}
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="pillar"
              tick={{ fill: "#F3F1EA", fontSize: 10, opacity: 0.7 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#F3F1EA", fontSize: 9, opacity: 0.35 }}
              tickCount={5}
              axisLine={false}
            />
            <Radar
              name="Shield Score"
              dataKey="score"
              stroke="#D1A866"
              fill="#D1A866"
              fillOpacity={0.18}
              strokeWidth={1.5}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
