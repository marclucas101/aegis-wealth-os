import { SHIELD_PILLAR_WEIGHTS } from "./constants";
import type { PillarScores, ShieldRating } from "./types";

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function getRating(score: number): ShieldRating {
  if (score >= 95) return "AAA";
  if (score >= 85) return "AA";
  if (score >= 75) return "A";
  if (score >= 60) return "BBB";
  if (score >= 40) return "BB";
  return "B";
}

export function calculateRawShieldScore(scores: PillarScores): number {
  return clamp(
    scores.foundation * SHIELD_PILLAR_WEIGHTS.foundation +
      scores.protect * SHIELD_PILLAR_WEIGHTS.protect +
      scores.grow * SHIELD_PILLAR_WEIGHTS.grow +
      scores.optimise * SHIELD_PILLAR_WEIGHTS.optimise +
      scores.transition * SHIELD_PILLAR_WEIGHTS.transition +
      scores.preserve * SHIELD_PILLAR_WEIGHTS.preserve +
      scores.legacy * SHIELD_PILLAR_WEIGHTS.legacy
  );
}

export function calculateDataConfidenceFactor(discoverScore: number): number {
  return 0.7 + (clamp(discoverScore) / 100) * 0.3;
}

export function calculateAdjustedShieldScore(
  rawShieldScore: number,
  dataConfidenceFactor: number
): number {
  return clamp(rawShieldScore * dataConfidenceFactor);
}

export function weightedAverage(
  factors: Array<{ score: number; weight: number; applicable?: boolean }>
): number {
  const applicable = factors.filter((factor) => factor.applicable !== false);

  if (applicable.length === 0) {
    return 0;
  }

  const totalWeight = applicable.reduce((sum, factor) => sum + factor.weight, 0);

  if (totalWeight === 0) {
    return 0;
  }

  const score = applicable.reduce(
    (sum, factor) => sum + factor.score * (factor.weight / totalWeight),
    0
  );

  return clamp(score);
}

export function ratioScore(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return numerator > 0 ? 100 : 0;
  }

  return clamp((numerator / denominator) * 100);
}

export function getWeakestPillar(scores: PillarScores): keyof PillarScores {
  const entries = Object.entries(scores) as Array<[keyof PillarScores, number]>;
  return entries.reduce((weakest, current) =>
    current[1] < weakest[1] ? current : weakest
  )[0];
}

export function getStrongestPillar(scores: PillarScores): keyof PillarScores {
  const entries = Object.entries(scores) as Array<[keyof PillarScores, number]>;
  return entries.reduce((strongest, current) =>
    current[1] > strongest[1] ? current : strongest
  )[0];
}
