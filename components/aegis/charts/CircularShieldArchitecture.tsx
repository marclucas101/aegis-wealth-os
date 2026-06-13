"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import { formatScore } from "@/components/aegis/ShieldScoreCard";
import { PILLAR_DISPLAY_LABELS } from "@/lib/aegis/shieldPillarMetadata";
import type { ProtectionCoreMetricResult } from "@/src/lib/scoring/protectionCoreTypes";
import type { PillarScores, ShieldPillar } from "@/src/lib/scoring/types";

import type { ShieldSelection } from "./ShieldArchitectureDetailPanel";

const VIEW = 420;
const CX = VIEW / 2;
const CY = VIEW / 2;

const OUTER_INNER = 148;
const OUTER_OUTER = 188;
const CORE_INNER = 68;
const CORE_OUTER = 118;

const PILLAR_ORDER: ShieldPillar[] = [
  "foundation",
  "protect",
  "grow",
  "optimise",
  "transition",
  "preserve",
  "legacy",
];

const CORE_ORDER: ProtectionCoreMetricResult["id"][] = [
  "death",
  "tpd",
  "critical_illness",
  "emergency_savings",
];

const CORE_SHORT_LABELS: Record<ProtectionCoreMetricResult["id"], string> = {
  death: "Death",
  tpd: "TPD",
  critical_illness: "CI",
  emergency_savings: "Savings",
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function donutSlicePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function scoreFillOpacity(score: number | null, missing: boolean): number {
  if (missing || score === null) return 0.12;
  if (score >= 80) return 0.55;
  if (score >= 60) return 0.42;
  if (score >= 40) return 0.3;
  return 0.22;
}

function scoreStroke(score: number | null, missing: boolean): string {
  if (missing || score === null) return "rgba(243,241,234,0.18)";
  if (score >= 80) return "rgba(209,168,102,0.85)";
  if (score >= 60) return "rgba(209,168,102,0.55)";
  return "rgba(209,168,102,0.35)";
}

interface CircularShieldArchitectureProps {
  pillarScores: PillarScores;
  coreMetrics: ProtectionCoreMetricResult[];
  aggregateCoreScore: number | null;
  selection: ShieldSelection | null;
  onSelect: (selection: ShieldSelection | null) => void;
}

export default function CircularShieldArchitecture({
  pillarScores,
  coreMetrics,
  aggregateCoreScore,
  selection,
  onSelect,
}: CircularShieldArchitectureProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const timer = window.setTimeout(() => setAnimated(true), 60);
    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  const mounted = reducedMotion || animated;

  const outerSegments = useMemo(() => {
    const sweep = 360 / PILLAR_ORDER.length;
    const gap = 2.5;
    return PILLAR_ORDER.map((pillar, index) => {
      const start = -90 + index * sweep + gap / 2;
      const end = start + sweep - gap;
      const mid = (start + end) / 2;
      const labelPos = polarToCartesian(CX, CY, (OUTER_INNER + OUTER_OUTER) / 2, mid);
      const score = pillarScores[pillar];
      return {
        pillar,
        start,
        end,
        mid,
        labelPos,
        score,
        label: PILLAR_DISPLAY_LABELS[pillar],
      };
    });
  }, [pillarScores]);

  const coreSegments = useMemo(() => {
    const sweep = 360 / CORE_ORDER.length;
    const gap = 3;
    return CORE_ORDER.map((metricId, index) => {
      const metric = coreMetrics.find((item) => item.id === metricId);
      const start = -90 + index * sweep + gap / 2;
      const end = start + sweep - gap;
      const mid = (start + end) / 2;
      const labelPos = polarToCartesian(CX, CY, (CORE_INNER + CORE_OUTER) / 2, mid);
      const missing = metric?.status === "data_missing" || metric?.score === null;
      return {
        metricId,
        metric,
        start,
        end,
        mid,
        labelPos,
        missing,
        score: metric?.score ?? null,
        label: CORE_SHORT_LABELS[metricId],
      };
    });
  }, [coreMetrics]);

  const isSelected = useCallback(
    (candidate: ShieldSelection) => {
      if (!selection) return false;
      if (selection.kind !== candidate.kind) return false;
      return selection.kind === "core"
        ? selection.metricId === (candidate as { kind: "core"; metricId: string }).metricId
        : selection.pillar === (candidate as { kind: "pillar"; pillar: ShieldPillar }).pillar;
    },
    [selection],
  );

  const handleKeyActivate = (
    event: KeyboardEvent<HTMLButtonElement>,
    next: ShieldSelection,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(isSelected(next) ? null : next);
    }
  };

  const animDuration = reducedMotion ? 0 : 1100;
  const animDelay = reducedMotion ? 0 : 120;

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,28rem)]">
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="h-auto w-full"
        role="img"
        aria-label="AEGIS circular shield architecture"
      >
        <defs>
          <radialGradient id="shieldCoreGlow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="rgba(209,168,102,0.14)" />
            <stop offset="100%" stopColor="rgba(7,27,42,0)" />
          </radialGradient>
          <filter id="shieldSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={198} fill="url(#shieldCoreGlow)" />

        <path
          d={`M ${CX} ${CY - 42} L ${CX + 34} ${CY - 8} L ${CX + 28} ${CY + 36} L ${CX} ${CY + 52} L ${CX - 28} ${CY + 36} L ${CX - 34} ${CY - 8} Z`}
          fill="rgba(16,40,58,0.75)"
          stroke="rgba(209,168,102,0.25)"
          strokeWidth="1"
          style={{
            transform: mounted ? "scale(1)" : "scale(0.82)",
            transformOrigin: `${CX}px ${CY}px`,
            transition: reducedMotion
              ? "none"
              : `transform ${animDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
        />

        {outerSegments.map((segment, index) => {
          const selected = isSelected({ kind: "pillar", pillar: segment.pillar });
          const weak = segment.score < 40;
          const path = donutSlicePath(
            CX,
            CY,
            OUTER_INNER,
            OUTER_OUTER,
            segment.start,
            segment.end,
          );

          return (
            <g key={segment.pillar}>
              <path
                d={path}
                fill={scoreStroke(segment.score, false)}
                fillOpacity={scoreFillOpacity(segment.score, false)}
                stroke={selected ? "rgba(209,168,102,0.9)" : "rgba(209,168,102,0.15)"}
                strokeWidth={selected ? 1.8 : 0.8}
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "scale(1)" : "scale(0.9)",
                  transformOrigin: `${CX}px ${CY}px`,
                  transition: reducedMotion
                    ? "none"
                    : `opacity ${animDuration}ms ease, transform ${animDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  transitionDelay: reducedMotion ? "0ms" : `${index * animDelay}ms`,
                }}
                className={weak && mounted && !reducedMotion ? "animate-[shieldWeakPulse_1.2s_ease-out_1]" : undefined}
              />
              <text
                x={segment.labelPos.x}
                y={segment.labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(243,241,234,0.75)"
                fontSize="9"
                style={{
                  opacity: mounted ? 1 : 0,
                  transition: reducedMotion ? "none" : `opacity ${animDuration}ms ease`,
                  transitionDelay: reducedMotion ? "0ms" : `${index * animDelay + 200}ms`,
                }}
              >
                {segment.label}
              </text>
              <text
                x={segment.labelPos.x}
                y={segment.labelPos.y + 11}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(209,168,102,0.85)"
                fontSize="8"
                fontFamily="ui-monospace, monospace"
              >
                {formatScore(segment.score)}
              </text>
            </g>
          );
        })}

        {coreSegments.map((segment, index) => {
          const selected = isSelected({ kind: "core", metricId: segment.metricId });
          const path = donutSlicePath(
            CX,
            CY,
            CORE_INNER,
            CORE_OUTER,
            segment.start,
            segment.end,
          );

          return (
            <g key={segment.metricId}>
              <path
                d={path}
                fill={scoreStroke(segment.score, segment.missing)}
                fillOpacity={scoreFillOpacity(segment.score, segment.missing)}
                stroke={selected ? "rgba(209,168,102,0.95)" : "rgba(209,168,102,0.2)"}
                strokeWidth={selected ? 1.6 : 0.8}
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "scale(1)" : "scale(0.75)",
                  transformOrigin: `${CX}px ${CY}px`,
                  transition: reducedMotion
                    ? "none"
                    : `opacity ${animDuration}ms ease, transform ${animDuration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                  transitionDelay: reducedMotion
                    ? "0ms"
                    : `${outerSegments.length * animDelay + index * animDelay}ms`,
                }}
              />
              <text
                x={segment.labelPos.x}
                y={segment.labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={segment.missing ? "rgba(243,241,234,0.35)" : "rgba(243,241,234,0.85)"}
                fontSize="8.5"
              >
                {segment.label}
              </text>
            </g>
          );
        })}

        <circle
          cx={CX}
          cy={CY}
          r={54}
          fill="rgba(7,27,42,0.92)"
          stroke="rgba(209,168,102,0.35)"
          strokeWidth="1"
        />
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          fill="rgba(209,168,102,0.75)"
          fontSize="8"
          letterSpacing="2"
        >
          CORE
        </text>
        <text
          x={CX}
          y={CY + 12}
          textAnchor="middle"
          fill="rgba(243,241,234,0.9)"
          fontSize="16"
          fontFamily="ui-monospace, monospace"
        >
          {aggregateCoreScore === null ? "—" : formatScore(aggregateCoreScore)}
        </text>
      </svg>

      <div className="pointer-events-none absolute inset-0">
        {outerSegments.map((segment) => {
          const buttonPos = polarToCartesian(CX, CY, 168, segment.mid);
          const leftPct = (buttonPos.x / VIEW) * 100;
          const topPct = (buttonPos.y / VIEW) * 100;
          const selected = isSelected({ kind: "pillar", pillar: segment.pillar });

          return (
            <button
              key={`btn-${segment.pillar}`}
              type="button"
              className={`pointer-events-auto absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D1A866]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071B2A] ${
                selected
                  ? "scale-110 border-[#D1A866]/60 bg-[#D1A866]/10"
                  : "border-transparent bg-transparent hover:border-[#D1A866]/25 hover:bg-[#D1A866]/5"
              }`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              aria-label={`${segment.label} pillar, score ${formatScore(segment.score)}`}
              aria-pressed={selected}
              onClick={() =>
                onSelect(
                  selected
                    ? null
                    : { kind: "pillar", pillar: segment.pillar },
                )
              }
              onKeyDown={(event) =>
                handleKeyActivate(event, {
                  kind: "pillar",
                  pillar: segment.pillar,
                })
              }
            />
          );
        })}

        {coreSegments.map((segment) => {
          const buttonPos = polarToCartesian(CX, CY, 93, segment.mid);
          const leftPct = (buttonPos.x / VIEW) * 100;
          const topPct = (buttonPos.y / VIEW) * 100;
          const selected = isSelected({ kind: "core", metricId: segment.metricId });
          const metric = segment.metric;

          return (
            <button
              key={`btn-core-${segment.metricId}`}
              type="button"
              className={`pointer-events-auto absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D1A866]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071B2A] ${
                selected
                  ? "scale-110 border-[#D1A866]/70 bg-[#D1A866]/12"
                  : "border-transparent bg-transparent hover:border-[#D1A866]/30 hover:bg-[#D1A866]/5"
              }`}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              aria-label={`${metric?.label ?? segment.label}, ${
                segment.missing
                  ? "data required"
                  : `completion ${Math.round((metric?.completionRatio ?? 0) * 100)} percent`
              }`}
              aria-pressed={selected}
              onClick={() =>
                onSelect(
                  selected
                    ? null
                    : { kind: "core", metricId: segment.metricId },
                )
              }
              onKeyDown={(event) =>
                handleKeyActivate(event, {
                  kind: "core",
                  metricId: segment.metricId,
                })
              }
            />
          );
        })}
      </div>
    </div>
  );
}
