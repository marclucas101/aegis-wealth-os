import "server-only";

import type { PublishedOutputType } from "./types";

/** Configurable stale thresholds by output type (days since data-as-at or publish). */
export const STALE_OUTPUT_THRESHOLDS_DAYS: Partial<
  Record<PublishedOutputType, number>
> = {
  financial_overview: 180,
  financial_readiness_snapshot: 90,
  client_plan_summary: 365,
  roadmap_summary: 180,
  annual_review_summary: 365,
  goal_plan_summary: 365,
  wealth_blueprint_summary: 365,
  meeting_summary: 180,
  insights_update: 90,
};

export type StaleOutputAssessment = {
  isStale: boolean;
  reviewRecommended: boolean;
  staleMessage: string | null;
  thresholdDays: number | null;
};

export function assessOutputStaleness(input: {
  outputType: PublishedOutputType;
  dataAsAt: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
}): StaleOutputAssessment {
  if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
    return {
      isStale: true,
      reviewRecommended: true,
      staleMessage: "Review recommended — this summary has expired.",
      thresholdDays: null,
    };
  }

  const thresholdDays = STALE_OUTPUT_THRESHOLDS_DAYS[input.outputType] ?? null;
  if (!thresholdDays) {
    return {
      isStale: false,
      reviewRecommended: false,
      staleMessage: null,
      thresholdDays: null,
    };
  }

  const referenceDate = input.dataAsAt ?? input.publishedAt;
  if (!referenceDate) {
    return {
      isStale: true,
      reviewRecommended: true,
      staleMessage: "Review recommended — publication date is unavailable.",
      thresholdDays,
    };
  }

  const parsed = new Date(referenceDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      isStale: true,
      reviewRecommended: true,
      staleMessage: "Review recommended — publication date could not be verified.",
      thresholdDays,
    };
  }

  const ageMs = Date.now() - parsed.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const isStale = ageDays > thresholdDays;

  return {
    isStale,
    reviewRecommended: isStale,
    staleMessage: isStale
      ? "Review recommended — your planning information may no longer reflect your current circumstances."
      : null,
    thresholdDays,
  };
}
