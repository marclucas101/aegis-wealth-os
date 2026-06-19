import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { writeAuditLog } from "@/lib/supabase/auditLog";

import { validateContentInput } from "./contentValidation";
import type {
  ContentApprovalStatus,
  GovernedContentInput,
  GovernedContentRow,
} from "./types";
import {
  dbCreateGovernedContent,
  dbCreateGovernedContentVersion,
  dbLoadGovernedContentById,
  dbUpdateGovernedContent,
} from "../supabase/governedContentPersistence";

const EDITABLE_STATUSES: ContentApprovalStatus[] = ["draft", "changes_requested"];

export function canAdviserEdit(row: GovernedContentRow, userId: string, role: string): boolean {
  if (role === "admin") {
    return EDITABLE_STATUSES.includes(row.approval_status);
  }
  return (
    row.author_user_id === userId &&
    EDITABLE_STATUSES.includes(row.approval_status)
  );
}

export async function createContentDraft(input: {
  data: GovernedContentInput;
  authorUserId: string;
  adviserUserId: string | null;
}): Promise<GovernedContentRow> {
  const validation = validateContentInput(input.data);
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }

  if (input.data.contentType === "promotional_product") {
    const enabled = await isFeatureEnabled("product_related_content");
    if (!enabled) {
      throw new Error("Product-related content is disabled by policy");
    }
  }

  if (input.data.category === "market_update") {
    const enabled = await isFeatureEnabled("market_updates");
    if (!enabled) {
      throw new Error("Market updates are disabled by policy");
    }
  }

  const row = await dbCreateGovernedContent({
    ...input.data,
    authorUserId: input.authorUserId,
    adviserUserId: input.adviserUserId,
    approvalStatus: "draft",
  });

  await writeAuditLog({
    userId: input.authorUserId,
    action: "content_draft_created",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { category: row.category, contentType: row.content_type },
  });

  return row;
}

export async function submitContentForReview(input: {
  contentId: string;
  actorUserId: string;
}): Promise<GovernedContentRow> {
  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (!EDITABLE_STATUSES.includes(row.approval_status)) {
    throw new Error("Content cannot be submitted in its current status");
  }

  const validation = validateContentInput({
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    contentType: row.content_type,
    audienceScope: row.audience_scope,
    targetRelationshipStages: row.target_relationship_stages,
    targetClientIds: row.target_client_ids,
    externalUrl: row.external_url,
    externalSourceName: row.external_source_name,
    sourcePublicationDate: row.source_publication_date,
    expiresAt: row.expires_at,
  });

  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }

  const updated = await dbUpdateGovernedContent(input.contentId, {
    approval_status: "submitted_for_review",
  });

  await writeAuditLog({
    userId: input.actorUserId,
    action: "content_submitted",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { version: row.version },
  });

  return updated;
}

export async function approveContent(input: {
  contentId: string;
  approverUserId: string;
  authorUserId: string;
}): Promise<GovernedContentRow> {
  if (input.approverUserId === input.authorUserId) {
    throw new Error("Authors cannot approve their own content");
  }

  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (row.approval_status !== "submitted_for_review") {
    throw new Error("Only submitted content can be approved");
  }

  const updated = await dbUpdateGovernedContent(input.contentId, {
    approval_status: "approved",
    approved_by_user_id: input.approverUserId,
    approved_at: new Date().toISOString(),
    rejection_reason: null,
  });

  await writeAuditLog({
    userId: input.approverUserId,
    action: "content_approved",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { version: row.version },
  });

  return updated;
}

export async function rejectContent(input: {
  contentId: string;
  approverUserId: string;
  reason: string;
}): Promise<GovernedContentRow> {
  if (!input.reason.trim()) {
    throw new Error("Rejection reason is required");
  }

  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (row.approval_status !== "submitted_for_review") {
    throw new Error("Only submitted content can be rejected");
  }

  const updated = await dbUpdateGovernedContent(input.contentId, {
    approval_status: "rejected",
    rejection_reason: input.reason.trim(),
  });

  await writeAuditLog({
    userId: input.approverUserId,
    action: "content_rejected",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { reason: input.reason.trim().slice(0, 200) },
  });

  return updated;
}

export async function requestContentChanges(input: {
  contentId: string;
  approverUserId: string;
  reason: string;
}): Promise<GovernedContentRow> {
  if (!input.reason.trim()) {
    throw new Error("Change request reason is required");
  }

  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (row.approval_status !== "submitted_for_review") {
    throw new Error("Only submitted content can have changes requested");
  }

  const updated = await dbUpdateGovernedContent(input.contentId, {
    approval_status: "changes_requested",
    rejection_reason: input.reason.trim(),
  });

  await writeAuditLog({
    userId: input.approverUserId,
    action: "content_changes_requested",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { reason: input.reason.trim().slice(0, 200) },
  });

  return updated;
}

export async function publishContent(input: {
  contentId: string;
  actorUserId: string;
  scheduledAt?: string | null;
}): Promise<GovernedContentRow> {
  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (row.approval_status === "published" && row.published_at) {
    return row;
  }

  if (!["approved", "scheduled"].includes(row.approval_status)) {
    throw new Error("Only approved content can be published");
  }

  const now = new Date().toISOString();
  const scheduledAt = input.scheduledAt ?? row.scheduled_at;

  if (scheduledAt && new Date(scheduledAt) > new Date()) {
    const updated = await dbUpdateGovernedContent(input.contentId, {
      approval_status: "scheduled",
      scheduled_at: scheduledAt,
    });

    await writeAuditLog({
      userId: input.actorUserId,
      action: "content_scheduled",
      entityType: "governed_content",
      entityId: row.id,
      metadata: { scheduledAt },
    });

    return updated;
  }

  const updated = await dbUpdateGovernedContent(input.contentId, {
    approval_status: "published",
    published_at: now,
    scheduled_at: scheduledAt,
  });

  await writeAuditLog({
    userId: input.actorUserId,
    action: "content_published",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { version: row.version },
  });

  return updated;
}

export async function withdrawContent(input: {
  contentId: string;
  actorUserId: string;
  reason: string;
}): Promise<GovernedContentRow> {
  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (row.withdrawn_at) {
    return row;
  }

  const updated = await dbUpdateGovernedContent(input.contentId, {
    approval_status: "withdrawn",
    withdrawn_at: new Date().toISOString(),
    withdrawal_reason: input.reason.trim() || null,
  });

  await writeAuditLog({
    userId: input.actorUserId,
    action: "content_withdrawn",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { reason: (input.reason || "").slice(0, 200) },
  });

  return updated;
}

export async function expireContent(input: {
  contentId: string;
  actorUserId: string;
}): Promise<GovernedContentRow> {
  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  const updated = await dbUpdateGovernedContent(input.contentId, {
    approval_status: "expired",
  });

  await writeAuditLog({
    userId: input.actorUserId,
    action: "content_expired",
    entityType: "governed_content",
    entityId: row.id,
    metadata: { version: row.version },
  });

  return updated;
}

export async function createContentEditVersion(input: {
  contentId: string;
  data: GovernedContentInput;
  actorUserId: string;
}): Promise<GovernedContentRow> {
  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (row.approval_status === "published") {
    const validation = validateContentInput(input.data);
    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }

    const newVersion = await dbCreateGovernedContentVersion({
      supersedesContentId: row.id,
      data: input.data,
      authorUserId: input.actorUserId,
      adviserUserId: row.adviser_user_id,
    });

    await writeAuditLog({
      userId: input.actorUserId,
      action: "content_draft_created",
      entityType: "governed_content",
      entityId: newVersion.id,
      metadata: { supersedes: row.id, version: newVersion.version },
    });

    return newVersion;
  }

  if (!EDITABLE_STATUSES.includes(row.approval_status)) {
    throw new Error("Published content cannot be silently edited");
  }

  const validation = validateContentInput(input.data);
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }

  return dbUpdateGovernedContent(input.contentId, {
    title: input.data.title,
    summary: input.data.summary,
    body: input.data.body,
    category: input.data.category,
    content_type: input.data.contentType,
    audience_scope: input.data.audienceScope,
    target_relationship_stages: input.data.targetRelationshipStages ?? [],
    target_client_ids: input.data.targetClientIds ?? [],
    external_url: input.data.externalUrl ?? null,
    external_source_name: input.data.externalSourceName ?? null,
    source_publication_date: input.data.sourcePublicationDate ?? null,
    expires_at: input.data.expiresAt ?? null,
  });
}

export async function duplicateExpiredAsDraft(input: {
  contentId: string;
  actorUserId: string;
}): Promise<GovernedContentRow> {
  const row = await dbLoadGovernedContentById(input.contentId);
  if (!row) {
    throw new Error("Content not found");
  }

  if (!["expired", "withdrawn", "archived"].includes(row.approval_status)) {
    throw new Error("Only expired or withdrawn content can be duplicated");
  }

  return dbCreateGovernedContent({
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    contentType: row.content_type,
    audienceScope: row.audience_scope,
    targetRelationshipStages: row.target_relationship_stages,
    targetClientIds: row.target_client_ids,
    externalUrl: row.external_url,
    externalSourceName: row.external_source_name,
    sourcePublicationDate: row.source_publication_date,
    expiresAt: null,
    authorUserId: input.actorUserId,
    adviserUserId: row.adviser_user_id,
    approvalStatus: "draft",
  });
}
