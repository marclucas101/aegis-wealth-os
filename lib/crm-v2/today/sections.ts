import { buildAppointmentListHref } from "@/lib/crm-v2/appointments/routes";
import { buildCommunicationsWorkspaceHref } from "@/lib/crm-v2/communications/routes";
import { buildRelationshipListHref } from "@/lib/crm-v2/relationships/routes";
import {
  CRM_V2_SERVICE_PATH,
  CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
  CRM_V2_TODAY_PATH,
} from "@/lib/crm-v2/navigation";

import type { TodaySectionDto, TodaySectionKey } from "./types";

export type TodaySectionDefinition = {
  key: TodaySectionKey;
  label: string;
  emptyMessage: string;
  workspaceHref: string;
};

export const TODAY_SECTION_DEFINITIONS: TodaySectionDefinition[] = [
  {
    key: "schedule",
    label: "Schedule",
    emptyMessage: "No confirmed appointments for today.",
    workspaceHref: buildAppointmentListHref("agenda"),
  },
  {
    key: "prepare",
    label: "Prepare",
    emptyMessage: "No appointments need preparation right now.",
    workspaceHref: buildAppointmentListHref("preparation"),
  },
  {
    key: "client_requests",
    label: "Client Requests",
    emptyMessage: "No client requests awaiting your action.",
    workspaceHref: `${CRM_V2_SERVICE_PATH}?view=requests`,
  },
  {
    key: "follow_ups",
    label: "Follow-ups",
    emptyMessage: "No follow-ups due today.",
    workspaceHref: buildAppointmentListHref("follow_up"),
  },
  {
    key: "service_due",
    label: "Service Due",
    emptyMessage: "No service commitments due or overdue.",
    workspaceHref: CRM_V2_SERVICE_PATH,
  },
  {
    key: "reviews",
    label: "Reviews",
    emptyMessage: "No reviews due or overdue.",
    workspaceHref: buildRelationshipListHref(),
  },
  {
    key: "protection",
    label: "Protection",
    emptyMessage: "No protection items need your review.",
    workspaceHref: buildRelationshipListHref(),
  },
  {
    key: "communications",
    label: "Communications",
    emptyMessage: "No communications need your attention.",
    workspaceHref: buildCommunicationsWorkspaceHref("needs_review"),
  },
  {
    key: "relationship_moments",
    label: "Relationship Moments",
    emptyMessage: "No relationship moments need acknowledgement.",
    workspaceHref: buildRelationshipListHref(),
  },
  {
    key: "sync_operations",
    label: "Sync and Operations",
    emptyMessage: "Calendar sync is healthy.",
    workspaceHref: CRM_V2_SETTINGS_GOOGLE_CALENDAR_PATH,
  },
  {
    key: "recently_completed",
    label: "Recently Completed",
    emptyMessage: "No recently completed items to show.",
    workspaceHref: CRM_V2_TODAY_PATH,
  },
];

export function createEmptySections(): TodaySectionDto[] {
  return TODAY_SECTION_DEFINITIONS.map((def) => ({
    key: def.key,
    label: def.label,
    cards: [],
    partialFailure: false,
    emptyMessage: def.emptyMessage,
    workspaceHref: def.workspaceHref,
  }));
}

export function sectionDefinition(key: TodaySectionKey): TodaySectionDefinition {
  const found = TODAY_SECTION_DEFINITIONS.find((def) => def.key === key);
  if (!found) {
    throw new Error(`Unknown Today section: ${key}`);
  }
  return found;
}
