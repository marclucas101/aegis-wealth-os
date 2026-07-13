import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { buildAdviserWorkQueue, WORK_QUEUE_FEATURE_FLAG_KEY } from "@/lib/work-queue/buildAdviserWorkQueue";

import {
  CRM_V2_TODAY_MAX_CARDS_PER_SECTION,
  CRM_V2_TODAY_MAX_TOTAL_CARDS,
} from "./constants";
import { sortTodayCards } from "./ordering";
import { createEmptySections, sectionDefinition } from "./sections";
import { loadGoogleCalendarTodayCards } from "./sourceAdapters/googleCalendarAdapter";
import { mapWorkItemsToTodayCards } from "./sourceAdapters/workQueueAdapter";
import type {
  AdviserTodayProjectionDto,
  CrmTodayResult,
  TodayCardDto,
  TodaySectionDto,
  TodaySectionKey,
  TodaySourceFailureDto,
} from "./types";
import { buildTodayWorkQueuePanel } from "./workQueuePanel";

export type LoadAdviserTodayProjectionInput = {
  authUserId: string;
  userRole: "advisor" | "admin";
  operatingDate?: string;
  timezone?: string;
};

function formatDateLabel(isoDate: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-SG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: timezone,
    }).format(new Date(`${isoDate}T12:00:00`));
  } catch {
    return isoDate;
  }
}

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function groupCardsBySection(cards: TodayCardDto[]): Map<TodaySectionKey, TodayCardDto[]> {
  const grouped = new Map<TodaySectionKey, TodayCardDto[]>();
  for (const card of cards) {
    const list = grouped.get(card.section) ?? [];
    list.push(card);
    grouped.set(card.section, list);
  }
  return grouped;
}

function applySectionBounds(
  grouped: Map<TodaySectionKey, TodayCardDto[]>,
): { sections: TodaySectionDto[]; totalCards: number } {
  const empty = createEmptySections();
  let totalCards = 0;

  const sections = empty.map((section) => {
    const cards = sortTodayCards(grouped.get(section.key) ?? []).slice(
      0,
      CRM_V2_TODAY_MAX_CARDS_PER_SECTION,
    );
    totalCards += cards.length;
    return {
      ...section,
      cards,
    };
  });

  return { sections, totalCards: Math.min(totalCards, CRM_V2_TODAY_MAX_TOTAL_CARDS) };
}

/**
 * Central server-only Today projection. Read-only; no persisted Today authority.
 * Partial source failures are isolated — one adapter failure does not collapse the dashboard.
 */
export async function loadAdviserTodayProjection(
  input: LoadAdviserTodayProjectionInput,
): Promise<CrmTodayResult<AdviserTodayProjectionDto>> {
  const timezone = input.timezone ?? "Asia/Singapore";
  const now = new Date();
  const operatingDate =
    input.operatingDate ??
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
  const generatedAt = now.toISOString();
  const sourceFailures: TodaySourceFailureDto[] = [];
  const allCards: TodayCardDto[] = [];

  if (input.userRole === "advisor") {
    try {
      const queue = await buildAdviserWorkQueue({
        authUserId: input.authUserId,
        userRole: input.userRole,
        nowIso: generatedAt,
        timezone,
      });
      allCards.push(...mapWorkItemsToTodayCards(queue.items));

      const failedAdapters = queue.adapterStatus.filter((status) => !status.ok);
      for (const adapter of failedAdapters) {
        sourceFailures.push({
          sourceKey: adapter.sourceType,
          safeMessage: "One source could not be loaded completely.",
        });
      }
    } catch {
      sourceFailures.push({
        sourceKey: "work_queue",
        safeMessage: "Work queue sources could not be loaded.",
      });
    }

    try {
      const google = await loadGoogleCalendarTodayCards({
        authUserId: input.authUserId,
      });
      allCards.push(...google.cards);
      if (google.failed) {
        sourceFailures.push({
          sourceKey: "google_calendar",
          safeMessage: "Calendar sync status could not be loaded.",
        });
      }
    } catch {
      sourceFailures.push({
        sourceKey: "google_calendar",
        safeMessage: "Calendar sync status could not be loaded.",
      });
    }
  }

  const grouped = groupCardsBySection(allCards);
  const { sections, totalCards } = applySectionBounds(grouped);

  const sectionsWithFailures = sections.map((section) => ({
    ...section,
    partialFailure: sourceFailures.length > 0 && section.cards.length === 0,
    emptyMessage: sectionDefinition(section.key).emptyMessage,
  }));

  const workQueueEnabled = await isFeatureEnabled(WORK_QUEUE_FEATURE_FLAG_KEY);
  let workQueuePanel = null;
  if (workQueueEnabled && input.userRole === "advisor") {
    try {
      const queue = await buildAdviserWorkQueue({
        authUserId: input.authUserId,
        userRole: input.userRole,
        nowIso: generatedAt,
        timezone,
      });
      workQueuePanel = buildTodayWorkQueuePanel(queue);
    } catch {
      sourceFailures.push({
        sourceKey: "work_queue_panel",
        safeMessage: "Work queue panel could not be loaded.",
      });
    }
  }

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(now),
  );

  const actionableCount = allCards.filter((card) => card.actionRequired).length;
  const summary =
    actionableCount > 0
      ? `${actionableCount} item${actionableCount === 1 ? "" : "s"} need your attention today.`
      : "Your operating dashboard is clear for now.";

  const staleDataWarning =
    sourceFailures.length > 0
      ? "Some sources could not be refreshed. Open the source workspace for authoritative status."
      : null;

  return {
    ok: true,
    data: {
      dateLabel: formatDateLabel(operatingDate, timezone),
      operatingDate,
      greeting: greetingForHour(hour),
      summary,
      sections: sectionsWithFailures,
      workQueuePanel,
      sourceFailures,
      generatedAt,
      staleDataWarning,
      totalCards,
    },
  };
}

export async function loadAdviserTodaySection(
  input: LoadAdviserTodayProjectionInput & { sectionKey: TodaySectionKey },
): Promise<CrmTodayResult<TodaySectionDto>> {
  const projection = await loadAdviserTodayProjection(input);
  if (!projection.ok) return projection;

  const section = projection.data.sections.find((s) => s.key === input.sectionKey);
  if (!section) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, data: section };
}
