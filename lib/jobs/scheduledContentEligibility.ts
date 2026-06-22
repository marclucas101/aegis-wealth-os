import "server-only";

import { publishContent } from "@/lib/communications/contentWorkflow";
import { deliverPublicationNotifications } from "@/lib/communications/publicationDelivery";
import type { GovernedContentRow } from "@/lib/communications/types";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  dbHasPublishedSupersedingVersion,
  dbLoadGovernedContentById,
} from "@/lib/supabase/governedContentPersistence";

import {
  adviserPermittedAudienceScopes,
  validateTargetClientIds,
} from "@/lib/communications/audienceTargeting";

export type ScheduledContentEligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: string };

/** Revalidate all publication prerequisites at execution time. */
export async function assessScheduledContentEligibility(
  row: GovernedContentRow,
): Promise<ScheduledContentEligibilityResult> {
  if (row.approval_status !== "scheduled") {
    return { eligible: false, reason: "Status is not scheduled" };
  }

  if (!row.scheduled_at) {
    return { eligible: false, reason: "Missing scheduled time" };
  }

  if (new Date(row.scheduled_at) > new Date()) {
    return { eligible: false, reason: "Scheduled time not yet reached" };
  }

  if (!row.approved_by_user_id || !row.approved_at) {
    return { eligible: false, reason: "Approval record missing or revoked" };
  }

  if (row.author_user_id === row.approved_by_user_id) {
    return { eligible: false, reason: "Author cannot approve own content" };
  }

  if (row.withdrawn_at) {
    return { eligible: false, reason: "Content withdrawn" };
  }

  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return { eligible: false, reason: "Content expired" };
  }

  if (row.published_at) {
    return { eligible: false, reason: "Already published" };
  }

  if (await dbHasPublishedSupersedingVersion(row.id)) {
    return { eligible: false, reason: "Superseded by newer published version" };
  }

  const automationEnabled = await isFeatureEnabled("scheduled_content_automation");
  if (!automationEnabled) {
    return { eligible: false, reason: "Scheduled automation disabled" };
  }

  const insightsEnabled = await isFeatureEnabled("insights_and_updates");
  if (!insightsEnabled) {
    return { eligible: false, reason: "Insights and updates disabled" };
  }

  if (row.content_type === "promotional_product") {
    const productEnabled = await isFeatureEnabled("product_related_content");
    if (!productEnabled) {
      return { eligible: false, reason: "Product-related content disabled" };
    }
  }

  if (row.category === "market_update" || row.content_type === "general_market_update") {
    const marketEnabled = await isFeatureEnabled("market_updates");
    if (!marketEnabled) {
      return { eligible: false, reason: "Market updates disabled" };
    }
    if (!row.external_source_name?.trim()) {
      return { eligible: false, reason: "Market update missing source" };
    }
    if (!row.expires_at) {
      return { eligible: false, reason: "Market update missing expiry" };
    }
  }

  if (row.audience_scope === "internal_advisers") {
    return { eligible: false, reason: "Internal adviser audience not automatable" };
  }

  const permittedScopes = adviserPermittedAudienceScopes("admin");
  if (!permittedScopes.includes(row.audience_scope)) {
    return { eligible: false, reason: "Audience scope not permitted" };
  }

  if (row.audience_scope === "selected_clients") {
    if (row.target_client_ids.length === 0) {
      return { eligible: false, reason: "No selected clients assigned" };
    }
    const validation = await validateTargetClientIds("system", "admin", row.target_client_ids);
    if (!validation.ok) {
      return { eligible: false, reason: validation.error };
    }
  }

  if (
    (row.audience_scope === "assigned_active_clients" ||
      row.audience_scope === "assigned_prospects") &&
    !row.adviser_user_id
  ) {
    return { eligible: false, reason: "Assigned audience missing adviser" };
  }

  return { eligible: true };
}

/** Publish one due scheduled item via the authoritative workflow. */
export async function publishScheduledContentItem(
  contentId: string,
): Promise<{ outcome: "succeeded" | "skipped" | "failed"; reason?: string }> {
  const row = await dbLoadGovernedContentById(contentId);
  if (!row) {
    return { outcome: "failed", reason: "Content not found" };
  }

  const eligibility = await assessScheduledContentEligibility(row);
  if (!eligibility.eligible) {
    return { outcome: "skipped", reason: eligibility.reason };
  }

  try {
    const actorUserId = row.approved_by_user_id!;
    const updated = await publishContent({
      contentId,
      actorUserId,
      scheduledAt: row.scheduled_at,
    });

    if (updated.approval_status !== "published") {
      return { outcome: "skipped", reason: "Publication did not complete" };
    }

    await deliverPublicationNotifications({
      content: updated,
      actorUserId,
    });

    return { outcome: "succeeded" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publication failed";
    return { outcome: "failed", reason: message.slice(0, 200) };
  }
}

/** Count currently due scheduled rows (for empty-run detection). */
export async function countDueScheduledContent(): Promise<number> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { count, error } = await admin
    .from("governed_content")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now)
    .is("withdrawn_at", null);

  if (error) {
    throw new Error(`Failed to count due scheduled content: ${error.message}`);
  }

  return count ?? 0;
}
