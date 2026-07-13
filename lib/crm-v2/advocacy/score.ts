import "server-only";

import { createCrmAdvocacyAdmin } from "@/lib/crm-v2/advocacy/db";
import type { CrmAdvocacyEventType } from "@/lib/crm-v2/advocacy/types";
import { assertAdvocacyScoreNotUsedForPriority } from "@/lib/crm-v2/advocacy/restrictions";

type ScoreConfigRow = {
  event_type: string;
  points: number;
  category_cap: number | null;
  max_yearly_score: number | null;
};

export type AdvocacyYearScoreResult = {
  calendarYear: number;
  totalPoints: number;
  eventCount: number;
  cappedScore: number | null;
  explanation: string | null;
};

export async function computeAdvocacyYearScore(input: {
  clientId: string;
  calendarYear?: number;
}): Promise<AdvocacyYearScoreResult> {
  assertAdvocacyScoreNotUsedForPriority("work_queue_priority");

  const calendarYear = input.calendarYear ?? new Date().getFullYear();
  const yearStart = `${calendarYear}-01-01`;
  const yearEnd = `${calendarYear}-12-31`;
  const admin = createCrmAdvocacyAdmin();

  const [eventsResult, configResult] = await Promise.all([
    admin
      .from("advocacy_events")
      .select("event_type, points, score_eligible")
      .eq("client_id", input.clientId)
      .eq("active", true)
      .eq("score_eligible", true)
      .gte("event_date", yearStart)
      .lte("event_date", yearEnd),
    admin.from("advocacy_score_config").select("*").eq("active", true),
  ]);

  const events = (eventsResult.data ?? []) as Array<{
    event_type: string;
    points: number;
    score_eligible: boolean;
  }>;
  const configs = (configResult.data ?? []) as ScoreConfigRow[];

  if (events.length === 0) {
    return {
      calendarYear,
      totalPoints: 0,
      eventCount: 0,
      cappedScore: null,
      explanation: null,
    };
  }

  const configByType = new Map<string, ScoreConfigRow>();
  let globalMax: number | null = null;
  for (const row of configs) {
    configByType.set(row.event_type, row);
    if (row.max_yearly_score != null) {
      globalMax = row.max_yearly_score;
    }
  }

  const categoryTotals = new Map<string, number>();
  let totalPoints = 0;

  for (const event of events) {
    const config = configByType.get(event.event_type);
    const points = config?.points ?? event.points ?? 0;
    totalPoints += points;
    const current = categoryTotals.get(event.event_type) ?? 0;
    categoryTotals.set(event.event_type, current + points);
  }

  let cappedScore = totalPoints;
  for (const [eventType, total] of categoryTotals) {
    const cap = configByType.get(eventType)?.category_cap;
    if (cap != null && total > cap) {
      cappedScore -= total - cap;
    }
  }
  if (globalMax != null && cappedScore > globalMax) {
    cappedScore = globalMax;
  }

  return {
    calendarYear,
    totalPoints,
    eventCount: events.length,
    cappedScore,
    explanation: `Event-based score for ${calendarYear}: ${events.length} eligible events, ${cappedScore} points after caps.`,
  };
}

export function resolveEventPoints(eventType: CrmAdvocacyEventType, configPoints?: number): number {
  return configPoints ?? 0;
}
