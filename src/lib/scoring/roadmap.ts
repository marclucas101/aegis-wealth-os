import { ROADMAP_PRIORITY_THRESHOLDS, SHIELD_PILLAR_WEIGHTS } from "./constants";
import type {
  PillarScores,
  ProjectedShieldResult,
  RoadmapItem,
  RoadmapPriority,
  ShieldPillar,
} from "./types";
import {
  calculateAdjustedShieldScore,
  calculateRawShieldScore,
  clamp,
  getRating,
  weightedAverage,
} from "./utils";

export function calculateRoadmapPriorityScore(item: RoadmapItem): number {
  return clamp(
    (item.gapSeverity ?? 0) * 0.4 +
      (item.stressExposure ?? 0) * 0.3 +
      (item.impactPotential ?? item.estimatedImpact) * 0.2 +
      (item.urgency ?? 0) * 0.1
  );
}

export function getRoadmapPriority(priorityScore: number): RoadmapPriority {
  for (const threshold of ROADMAP_PRIORITY_THRESHOLDS) {
    if (priorityScore >= threshold.min) {
      return threshold.priority;
    }
  }

  return "low";
}

export function enrichRoadmapItem(item: RoadmapItem): RoadmapItem {
  const priorityScore = calculateRoadmapPriorityScore(item);

  return {
    ...item,
    priority: getRoadmapPriority(priorityScore),
  };
}

export function calculateProjectedPillarScores(
  currentScores: PillarScores,
  items: RoadmapItem[]
): PillarScores {
  const projected: PillarScores = { ...currentScores };

  (Object.keys(currentScores) as ShieldPillar[]).forEach((pillar) => {
    const pillarImpact = items
      .filter(
        (item) =>
          item.pillar === pillar &&
          (item.status === "completed" || item.status === "in_progress")
      )
      .reduce((sum, item) => sum + item.estimatedImpact, 0);

    projected[pillar] = clamp(currentScores[pillar] + pillarImpact);
  });

  return projected;
}

export function calculateProjectedShield(
  currentScores: PillarScores,
  items: RoadmapItem[],
  dataConfidenceFactor: number
): ProjectedShieldResult {
  const projectedPillarScores = calculateProjectedPillarScores(
    currentScores,
    items
  );
  const projectedRawShieldScore = calculateRawShieldScore(projectedPillarScores);
  const projectedAdjustedShieldScore = calculateAdjustedShieldScore(
    projectedRawShieldScore,
    dataConfidenceFactor
  );

  return {
    projectedPillarScores,
    projectedRawShieldScore,
    projectedAdjustedShieldScore,
    projectedRating: getRating(projectedAdjustedShieldScore),
  };
}

export function sortRoadmapByPriority(items: RoadmapItem[]): RoadmapItem[] {
  const priorityOrder: Record<RoadmapPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...items]
    .map(enrichRoadmapItem)
    .sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return b.estimatedImpact - a.estimatedImpact;
    });
}

export function estimatePillarGapSeverity(
  currentScore: number,
  targetScore = 80
): number {
  return clamp(targetScore - currentScore);
}

export function estimateShieldImprovement(
  pillar: ShieldPillar,
  impact: number
): number {
  return clamp(impact * SHIELD_PILLAR_WEIGHTS[pillar]);
}

export function summariseRoadmapImpact(items: RoadmapItem[]): {
  totalEstimatedImpact: number;
  byPillar: Partial<Record<ShieldPillar, number>>;
} {
  const byPillar: Partial<Record<ShieldPillar, number>> = {};

  const totalEstimatedImpact = items.reduce((sum, item) => {
    byPillar[item.pillar] = (byPillar[item.pillar] ?? 0) + item.estimatedImpact;
    return sum + item.estimatedImpact;
  }, 0);

  return {
    totalEstimatedImpact: clamp(totalEstimatedImpact),
    byPillar,
  };
}
