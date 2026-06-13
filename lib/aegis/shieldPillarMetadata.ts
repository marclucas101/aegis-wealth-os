import type { RoadmapItem, ShieldPillar } from "@/src/lib/scoring/types";
import { SHIELD_PILLAR_WEIGHTS } from "@/src/lib/scoring/constants";
import { getRating } from "@/src/lib/scoring/utils";

export const PILLAR_DISPLAY_LABELS: Record<ShieldPillar, string> = {
  foundation: "Foundation",
  protect: "Protect",
  grow: "Grow",
  optimise: "Optimise",
  transition: "Transition",
  preserve: "Preserve",
  legacy: "Legacy",
};

export const PILLAR_MODULE_LINKS: Record<ShieldPillar, string> = {
  foundation: "/discover",
  protect: "/shield-diagnostic",
  grow: "/wealth-blueprint",
  optimise: "/budget-optimiser",
  transition: "/roadmap",
  preserve: "/annual-review",
  legacy: "/document-vault",
};

export const PILLAR_EXPLANATIONS: Record<ShieldPillar, string> = {
  foundation:
    "Measures everyday survivability — liquidity, hospitalisation cover, and income stability.",
  protect:
    "Evaluates catastrophe defence — life, critical illness, disability, and estate liquidity.",
  grow:
    "Tracks wealth creation discipline through savings, investments, and retirement funding.",
  optimise:
    "Assesses leakage reduction across debt costs, tax efficiency, and premium load.",
  transition:
    "Reflects readiness for life-stage shifts such as family, property, and career changes.",
  preserve:
    "Examines retirement durability, healthcare funding, and drawdown strategy.",
  legacy:
    "Reviews estate readiness — wills, nominations, governance, and succession planning.",
};

export function pillarStrengthText(score: number): string {
  if (score >= 80) return "Institutional-grade resilience in this pillar.";
  if (score >= 60) return "Solid baseline with room to strengthen further.";
  if (score >= 40) return "Functional but exposed under stress scenarios.";
  return "Material vulnerability — prioritise remediation.";
}

export function pillarGapText(score: number): string {
  if (score >= 80) return "Maintain review cadence; monitor drift after life events.";
  if (score >= 60) return "Targeted improvements could lift overall shield rating.";
  if (score >= 40) return "Meaningful gaps remain — align with roadmap priorities.";
  return "Critical gap — address before expanding growth or legacy planning.";
}

export function recommendedPillarStep(
  pillar: ShieldPillar,
  roadmap: RoadmapItem[],
): string {
  const match = roadmap.find(
    (item) => item.pillar === pillar && item.status !== "completed",
  );
  if (match) return match.title;
  return `Review ${PILLAR_DISPLAY_LABELS[pillar]} in your Wealth Roadmap`;
}

export function pillarRating(score: number): string {
  return getRating(score);
}

export function pillarWeightPercent(pillar: ShieldPillar): number {
  return Math.round(SHIELD_PILLAR_WEIGHTS[pillar] * 100);
}
