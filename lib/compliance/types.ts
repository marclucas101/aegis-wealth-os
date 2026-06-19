import "server-only";

/** Canonical relationship workflow stages (Phase 9A). */
export type RelationshipStage =
  | "prospect"
  | "fact_find_complete"
  | "adviser_review"
  | "meeting_scheduled"
  | "recommendation_prepared"
  | "active_client"
  | "inactive_client";

export const RELATIONSHIP_STAGES: readonly RelationshipStage[] = [
  "prospect",
  "fact_find_complete",
  "adviser_review",
  "meeting_scheduled",
  "recommendation_prepared",
  "active_client",
  "inactive_client",
] as const;

/** Output audience classification. */
export type OutputAudience =
  | "adviser_internal"
  | "meeting_presentation"
  | "client_published"
  | "public_education";

export const OUTPUT_AUDIENCES: readonly OutputAudience[] = [
  "adviser_internal",
  "meeting_presentation",
  "client_published",
  "public_education",
] as const;

/** Publication lifecycle states. */
export type PublicationStatus =
  | "draft"
  | "adviser_reviewed"
  | "published"
  | "superseded"
  | "expired"
  | "withdrawn";

export const PUBLICATION_STATUSES: readonly PublicationStatus[] = [
  "draft",
  "adviser_reviewed",
  "published",
  "superseded",
  "expired",
  "withdrawn",
] as const;

export type PublishedOutputType =
  | "financial_readiness_snapshot"
  | "financial_overview"
  | "client_plan_summary"
  | "roadmap_summary"
  | "annual_review_summary"
  | "goal_plan_summary"
  | "wealth_blueprint_summary"
  | "stress_test_summary"
  | "shield_diagnostic_summary"
  | "meeting_summary"
  | "meeting_presentation"
  | "insights_update";

/** Active-client portal routes (Phase 9D). */
export const ACTIVE_CLIENT_PORTAL_PATHS = [
  "/dashboard",
  "/my-plan",
  "/roadmap",
  "/budget-optimiser",
  "/goals-reviews",
  "/document-vault",
  "/my-adviser",
  "/insights",
  "/profile",
] as const;

export type ClientRoadmapDisplayStatus =
  | "not_started"
  | "in_progress"
  | "waiting_on_you"
  | "with_your_adviser"
  | "completed";

/** Server-resolved feature keys (must match platform_feature_controls). */
export type PlatformFeatureKey =
  | "raw_client_financial_views"
  | "prospect_readiness_snapshot"
  | "client_published_financial_overview"
  | "client_stress_test_visibility"
  | "adviser_publication_workflow"
  | "insights_and_updates"
  | "adviser_meeting_studio"
  | "meeting_presentation_mode"
  | "meeting_exact_amount_presentations"
  | "meeting_client_acknowledgements"
  | "meeting_summary_publication";

export const PLATFORM_FEATURE_KEYS: readonly PlatformFeatureKey[] = [
  "raw_client_financial_views",
  "prospect_readiness_snapshot",
  "client_published_financial_overview",
  "client_stress_test_visibility",
  "adviser_publication_workflow",
  "insights_and_updates",
  "adviser_meeting_studio",
  "meeting_presentation_mode",
  "meeting_exact_amount_presentations",
  "meeting_client_acknowledgements",
  "meeting_summary_publication",
] as const;

/** Entitlement-gated client portal features. */
export type ClientFeatureKey =
  | "financial_readiness_snapshot"
  | "complete_information"
  | "meeting_preparation"
  | "my_adviser"
  | "appointments"
  | "limited_documents"
  | "financial_overview"
  | "my_plan"
  | "roadmap"
  | "budget"
  | "goals_and_reviews"
  | "documents"
  | "insights_and_updates"
  | "shield_diagnostic"
  | "stress_testing"
  | "wealth_blueprint"
  | "promotions";

export type ClientSafeFallbackReason =
  | "analysis_submitted"
  | "adviser_review_in_progress"
  | "additional_information_required"
  | "review_appointment_recommended"
  | "no_current_published_summary"
  | "feature_disabled";

export type ClientSafeAccessMode = "client_safe" | "published" | "fallback";
