import "server-only";

/** Governed content categories for client-facing Insights feed. */
export type GovernedContentCategory =
  | "financial_education"
  | "market_update"
  | "planning_reminder"
  | "company_update"
  | "event"
  | "regulatory_update"
  | "adviser_message"
  | "document_notification"
  | "appointment_update"
  | "review_reminder";

export const GOVERNED_CONTENT_CATEGORIES: readonly GovernedContentCategory[] = [
  "financial_education",
  "market_update",
  "planning_reminder",
  "company_update",
  "event",
  "regulatory_update",
  "adviser_message",
  "document_notification",
  "appointment_update",
  "review_reminder",
] as const;

/** Content classification — determines approval requirements. */
export type GovernedContentType =
  | "general_education"
  | "general_market_update"
  | "adviser_message"
  | "promotional_product"
  | "operational_notification"
  | "internal_adviser";

export const GOVERNED_CONTENT_TYPES: readonly GovernedContentType[] = [
  "general_education",
  "general_market_update",
  "adviser_message",
  "promotional_product",
  "operational_notification",
  "internal_adviser",
] as const;

/** Audience targeting scopes. */
export type AudienceScope =
  | "all_active_clients"
  | "assigned_active_clients"
  | "all_prospects"
  | "assigned_prospects"
  | "selected_clients"
  | "internal_advisers"
  | "public_education";

export const AUDIENCE_SCOPES: readonly AudienceScope[] = [
  "all_active_clients",
  "assigned_active_clients",
  "all_prospects",
  "assigned_prospects",
  "selected_clients",
  "internal_advisers",
  "public_education",
] as const;

/** Approval lifecycle statuses. */
export type ContentApprovalStatus =
  | "draft"
  | "submitted_for_review"
  | "changes_requested"
  | "approved"
  | "scheduled"
  | "published"
  | "expired"
  | "rejected"
  | "withdrawn"
  | "archived";

export const CONTENT_APPROVAL_STATUSES: readonly ContentApprovalStatus[] = [
  "draft",
  "submitted_for_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "expired",
  "rejected",
  "withdrawn",
  "archived",
] as const;

export type ClientNotificationType =
  | "new_publication"
  | "new_insight"
  | "document_uploaded"
  | "document_replaced"
  | "document_removed"
  | "document_action_required"
  | "appointment_upcoming"
  | "appointment_changed"
  | "appointment_cancelled"
  | "roadmap_task_assigned"
  | "review_requested"
  | "adviser_message"
  | "publication_approval_result";

export type DeliveryStatus =
  | "pending"
  | "sent"
  | "failed"
  | "retrying"
  | "suppressed_by_preference"
  | "skipped_no_email"
  | "cancelled_withdrawn";

export type BinderExportStatus = "generated" | "published_to_client" | "withdrawn";

export type PromotionMigrationClassification =
  | "safe_educational"
  | "market_update_review"
  | "event"
  | "product_promotional"
  | "expired"
  | "unsuitable";

export type GovernedContentRow = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: GovernedContentCategory;
  content_type: GovernedContentType;
  audience_scope: AudienceScope;
  target_relationship_stages: string[];
  target_client_ids: string[];
  target_adviser_user_id: string | null;
  external_url: string | null;
  external_source_name: string | null;
  source_publication_date: string | null;
  author_user_id: string;
  adviser_user_id: string | null;
  approval_status: ContentApprovalStatus;
  approved_by_user_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  expires_at: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  version: number;
  supersedes_content_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GovernedContentInput = {
  title: string;
  summary: string;
  body: string;
  category: GovernedContentCategory;
  contentType: GovernedContentType;
  audienceScope: AudienceScope;
  targetRelationshipStages?: string[];
  targetClientIds?: string[];
  externalUrl?: string | null;
  externalSourceName?: string | null;
  sourcePublicationDate?: string | null;
  expiresAt?: string | null;
};

export type ClientSafeInsightItem = {
  id: string;
  title: string;
  category: GovernedContentCategory;
  summary: string;
  body: string;
  source: string | null;
  publicationDate: string | null;
  expiryDate: string | null;
  externalUrl: string | null;
  externalSourceName: string | null;
  adviserAttribution: string | null;
  isGeneralInformation: boolean;
};

export type CommunicationPreferencesRow = {
  client_id: string;
  in_app_operational: boolean;
  email_operational: boolean;
  educational_insights: boolean;
  market_updates: boolean;
  event_announcements: boolean;
  adviser_messages: boolean;
  promotional_content: boolean;
  updated_at: string;
};

export type ClientNotificationRow = {
  id: string;
  client_id: string;
  notification_type: ClientNotificationType;
  title: string;
  summary: string;
  reference_type: string | null;
  reference_id: string | null;
  read_at: string | null;
  created_at: string;
  lifecycle_event?: string | null;
  source_entity_type?: string | null;
  source_lifecycle_version?: string | null;
  idempotency_key?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CommunicationDeliveryRow = {
  id: string;
  communication_id: string | null;
  notification_id: string | null;
  client_id: string;
  channel: "email" | "in_app";
  delivery_status: DeliveryStatus;
  provider_reference: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  sent_at: string | null;
  failed_at: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export type BinderExportRow = {
  id: string;
  client_id: string;
  adviser_user_id: string;
  meeting_date: string | null;
  sections_included: string[];
  source_publication_ids: string[];
  document_ids: string[];
  status: BinderExportStatus;
  published_to_client: boolean;
  published_at: string | null;
  storage_path: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
