import type { AdviserWorkItem } from "@/lib/work-queue/types";
import type { WorkItemSourceType } from "@/lib/work-queue/sourceRegistry";

import { buildTodayCardRouteHref } from "../routes";
import type { TodayCardDto, TodayCardSeverity, TodayCardType, TodaySectionKey } from "../types";

function severityFromWorkItem(item: AdviserWorkItem): TodayCardSeverity {
  if (item.blocking || item.timing === "overdue") return "urgent";
  if (item.timing === "due_today" || item.state === "blocked") return "attention";
  return "info";
}

function cardTypeFromSource(sourceType: WorkItemSourceType): TodayCardType {
  switch (sourceType) {
    case "appointment":
      return "appointment";
    case "meeting_follow_up":
      return "appointment_follow_up";
    case "service_commitment":
      return "service_commitment";
    case "client_service_request":
      return "client_service_request";
    case "document_follow_up":
      return "document_request";
    case "protection_extraction":
      return "protection_extraction";
    case "protection_policy_servicing":
      return "protection_policy";
    case "relationship_moment":
      return "relationship_moment";
    case "crm_review_rhythm":
      return "review_rhythm";
    case "review_due":
      return "review_rhythm";
    case "client_preference_update":
      return "client_preference";
    case "advocacy_event":
      return "advocacy_follow_up";
    case "communication_record":
      return "communication_draft";
    default:
      return "generic_action";
  }
}

function sectionFromWorkItem(item: AdviserWorkItem): TodaySectionKey {
  if (item.state === "completed") return "recently_completed";

  switch (item.sourceType) {
    case "appointment":
      if (item.reasonCodes.includes("meeting_prep_missing")) return "prepare";
      if (item.timing === "due_today") return "schedule";
      return "schedule";
    case "meeting_follow_up":
      return "follow_ups";
    case "client_service_request":
    case "document_follow_up":
      return "client_requests";
    case "service_commitment":
      return "service_due";
    case "review_due":
    case "crm_review_rhythm":
      return "reviews";
    case "protection_extraction":
    case "protection_policy_servicing":
      return "protection";
    case "communication_record":
      if (item.reasonCodes.some((code) => code.includes("follow"))) return "follow_ups";
      return "communications";
    case "relationship_moment":
    case "client_preference_update":
      return "relationship_moments";
    case "advocacy_event":
      return "follow_ups";
    default:
      return "follow_ups";
  }
}

function actionLabelForCard(item: AdviserWorkItem): string {
  switch (item.sourceType) {
    case "appointment":
      return "Open appointment";
    case "meeting_follow_up":
      return "Review follow-up";
    case "service_commitment":
      return "Open service";
    case "client_service_request":
      return "Review request";
    case "document_follow_up":
      return "Review document";
    case "protection_extraction":
      return "Verify extraction";
    case "protection_policy_servicing":
      return "Review protection";
    case "relationship_moment":
      return "Acknowledge moment";
    case "crm_review_rhythm":
    case "review_due":
      return "Open review";
    case "client_preference_update":
      return "Review preference";
    case "advocacy_event":
      return "Open advocacy";
    case "communication_record":
      return "Open communication";
    default:
      return "Open workflow";
  }
}

/** Map virtual work-queue item to safe Today card — projection only. */
export function mapWorkItemToTodayCard(item: AdviserWorkItem): TodayCardDto {
  const relationshipId = item.clientId;
  const routeHref = buildTodayCardRouteHref({
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    relationshipId,
    metadataAppointmentId: item.metadata.appointmentId,
  });

  return {
    id: `today:${item.id}`,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    relationshipId,
    clientDisplayName: item.clientDisplayName,
    cardType: cardTypeFromSource(item.sourceType),
    title: item.title,
    summary: item.summary,
    dueAt: item.dueAt,
    section: sectionFromWorkItem(item),
    actionLabel: actionLabelForCard(item),
    routeHref,
    sourceStatus: item.sourceStatus,
    severity: severityFromWorkItem(item),
    freshnessAt: item.updatedAt ?? item.occurredAt ?? item.dueAt ?? new Date().toISOString(),
    actionRequired: item.state === "actionable" || item.state === "blocked",
    blocked: item.blocking,
    sourceVersion: null,
  };
}

export function mapWorkItemsToTodayCards(items: AdviserWorkItem[]): TodayCardDto[] {
  return items.map(mapWorkItemToTodayCard);
}
