import type { TodayCardDto } from "./types";

/**
 * Permitted ordering signals only — operational urgency from source facts.
 * Prohibited: advocacy score, wealth, premium, ethnicity, sales signals.
 */
export function compareTodayCards(a: TodayCardDto, b: TodayCardDto): number {
  if (a.blocked !== b.blocked) {
    return a.blocked ? -1 : 1;
  }
  if (a.actionRequired !== b.actionRequired) {
    return a.actionRequired ? -1 : 1;
  }

  const severityRank = (s: TodayCardDto["severity"]) =>
    s === "urgent" ? 0 : s === "attention" ? 1 : 2;
  const severityDiff = severityRank(a.severity) - severityRank(b.severity);
  if (severityDiff !== 0) return severityDiff;

  const aDue = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
  const bDue = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) return aDue - bDue;

  const aFresh = Date.parse(a.freshnessAt);
  const bFresh = Date.parse(b.freshnessAt);
  if (aFresh !== bFresh) return bFresh - aFresh;

  return a.id.localeCompare(b.id);
}

export function sortTodayCards(cards: TodayCardDto[]): TodayCardDto[] {
  return [...cards].sort(compareTodayCards);
}
