import type { ClientStatus, RelationshipStage } from "@/lib/supabase/userProfile";

import type { CrmV2RelationshipTab } from "./routes";

export const CRM_UNKNOWN_LABEL = "Not available" as const;
export const CRM_NOT_SCHEDULED_LABEL = "Not scheduled" as const;
export const CRM_NOT_ESTABLISHED_LABEL = "Not established" as const;

export type CrmRelationshipListItem = {
  relationshipId: string;
  clientId: string;
  displayName: string;
  servicingState: ClientStatus;
  servicingStateLabel: string;
  relationshipStage: RelationshipStage | null;
  relationshipStageLabel: string;
  lastEngagementAt: string | null;
  lastEngagementLabel: string;
  nextAppointmentAt: string | null;
  nextAppointmentLabel: string;
  reviewStatusLabel: string;
  openActionsCount: number | null;
  openActionsLabel: string;
  dataReadinessLabel: string;
  profileCompletenessLabel: string;
  detailHref: string;
};

export type CrmRelationshipListPage = {
  relationships: CrmRelationshipListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  partialDataWarning: boolean;
};

export type CrmRelationshipHeader = {
  displayName: string;
  servicingStateLabel: string;
  relationshipStageLabel: string;
  adviserAssignmentLabel: string;
  lastEngagementLabel: string;
  lastEngagementAt: string | null;
  nextAppointmentLabel: string;
  nextAppointmentAt: string | null;
  reviewStatusLabel: string;
  openActionsLabel: string;
  openActionsCount: number | null;
  dataFreshnessLabel: string;
  listHref: string;
};

export type CrmRelationshipLink = {
  label: string;
  href: string;
  description?: string;
};

export type CrmTimelineVisibility = "adviser" | "client_visible" | "system";

export type CrmTimelineEntry = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  title: string;
  summary: string;
  sourceLink: string | null;
  visibility: CrmTimelineVisibility;
};

export type CrmServiceItem = {
  itemId: string;
  source: string;
  ownerLabel: string;
  statusLabel: string;
  dueDate: string | null;
  dueDateLabel: string;
  summary: string;
  workflowHref: string | null;
};

export type CrmDocumentSummaryItem = {
  itemId: string;
  categoryLabel: string;
  statusLabel: string;
  updatedAt: string | null;
  updatedLabel: string;
  workflowHref: string | null;
};

export type CrmRelationshipProfileField = {
  label: string;
  value: string;
};

export type CrmOverviewPanel = {
  panelId: string;
  title: string;
  value: string;
  detailHref: string | null;
};

export type CrmFinancialPlanLink = {
  label: string;
  href: string;
  statusLabel: string;
};

export type CrmRelationship360Diagnostics = {
  requestId: string;
  loadedAt: string;
  sourceWarnings: string[];
  timingMs: number;
};

export type CrmRelationship360 = {
  identity: {
    relationshipId: string;
    clientId: string;
    relationshipKind: "single_person";
  };
  header: CrmRelationshipHeader;
  activeTab: CrmV2RelationshipTab;
  overview: {
    panels: CrmOverviewPanel[];
    protectionNotice: string;
  };
  financialPlan: {
    links: CrmFinancialPlanLink[];
  };
  engagement: {
    timeline: CrmTimelineEntry[];
    bounded: boolean;
  };
  service: {
    items: CrmServiceItem[];
    phaseNotice: string;
    bounded: boolean;
  };
  documents: {
    items: CrmDocumentSummaryItem[];
    vaultHref: string;
    bounded: boolean;
  };
  profile: {
    fields: CrmRelationshipProfileField[];
    futurePhaseNotices: string[];
  };
  diagnostics: CrmRelationship360Diagnostics;
};
