import type { WorkItemSourceType } from "@/lib/work-queue/sourceRegistry";

/** Approved Today section keys — projection-only grouping. */
export const TODAY_SECTION_KEYS = [
  "schedule",
  "prepare",
  "client_requests",
  "follow_ups",
  "service_due",
  "reviews",
  "protection",
  "communications",
  "relationship_moments",
  "sync_operations",
  "recently_completed",
] as const;

export type TodaySectionKey = (typeof TODAY_SECTION_KEYS)[number];

export const TODAY_CARD_SEVERITIES = ["info", "attention", "urgent"] as const;
export type TodayCardSeverity = (typeof TODAY_CARD_SEVERITIES)[number];

export const TODAY_CARD_TYPES = [
  "appointment",
  "appointment_prep",
  "appointment_request",
  "appointment_follow_up",
  "service_commitment",
  "client_service_request",
  "document_request",
  "protection_extraction",
  "protection_review",
  "protection_policy",
  "relationship_moment",
  "review_rhythm",
  "client_preference",
  "advocacy_follow_up",
  "communication_draft",
  "communication_reply",
  "communication_follow_up",
  "google_calendar_sync",
  "work_queue_summary",
  "recent_completion",
  "generic_action",
] as const;

export type TodayCardType = (typeof TODAY_CARD_TYPES)[number];

/** Strict safe DTO — no raw source records or prohibited fields. */
export type TodayCardDto = {
  id: string;
  sourceType: WorkItemSourceType | "google_calendar_connection" | "google_calendar_sync";
  sourceId: string;
  relationshipId: string | null;
  clientDisplayName: string | null;
  cardType: TodayCardType;
  title: string;
  summary: string | null;
  dueAt: string | null;
  section: TodaySectionKey;
  actionLabel: string;
  routeHref: string;
  sourceStatus: string | null;
  severity: TodayCardSeverity;
  freshnessAt: string;
  actionRequired: boolean;
  blocked: boolean;
  sourceVersion: number | null;
};

export type TodaySectionDto = {
  key: TodaySectionKey;
  label: string;
  cards: TodayCardDto[];
  partialFailure: boolean;
  emptyMessage: string;
  workspaceHref: string;
};

export type TodaySourceFailureDto = {
  sourceKey: string;
  safeMessage: string;
};

export type TodayWorkQueuePanelDto = {
  generatedAt: string;
  itemCount: number;
  overdueCount: number;
  topItems: Array<{
    id: string;
    title: string;
    clientDisplayName: string;
    routeHref: string;
    timing: string;
  }>;
  readOnly: true;
};

export type AdviserTodayProjectionDto = {
  dateLabel: string;
  operatingDate: string;
  greeting: string;
  summary: string;
  sections: TodaySectionDto[];
  workQueuePanel: TodayWorkQueuePanelDto | null;
  sourceFailures: TodaySourceFailureDto[];
  generatedAt: string;
  staleDataWarning: string | null;
  totalCards: number;
};

export type CrmTodayResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "forbidden" | "not_found" };
