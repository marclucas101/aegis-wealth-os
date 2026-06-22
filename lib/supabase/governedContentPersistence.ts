import "server-only";

import { createAdminSupabaseClient } from "./admin";
import type {
  ContentApprovalStatus,
  GovernedContentCategory,
  GovernedContentInput,
  GovernedContentRow,
  GovernedContentType,
  AudienceScope,
} from "../communications/types";

type CreateInput = GovernedContentInput & {
  authorUserId: string;
  adviserUserId: string | null;
  approvalStatus: ContentApprovalStatus;
};

function mapRow(data: Record<string, unknown>): GovernedContentRow {
  return data as unknown as GovernedContentRow;
}

export async function dbCreateGovernedContent(
  input: CreateInput,
): Promise<GovernedContentRow> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("governed_content")
    .insert({
      title: input.title.trim(),
      summary: input.summary.trim(),
      body: input.body.trim(),
      category: input.category,
      content_type: input.contentType,
      audience_scope: input.audienceScope,
      target_relationship_stages: input.targetRelationshipStages ?? [],
      target_client_ids: input.targetClientIds ?? [],
      author_user_id: input.authorUserId,
      adviser_user_id: input.adviserUserId,
      external_url: input.externalUrl ?? null,
      external_source_name: input.externalSourceName ?? null,
      source_publication_date: input.sourcePublicationDate ?? null,
      expires_at: input.expiresAt ?? null,
      approval_status: input.approvalStatus,
      version: 1,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create governed content: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function dbCreateGovernedContentVersion(input: {
  supersedesContentId: string;
  data: GovernedContentInput;
  authorUserId: string;
  adviserUserId: string | null;
}): Promise<GovernedContentRow> {
  const parent = await dbLoadGovernedContentById(input.supersedesContentId);
  if (!parent) {
    throw new Error("Parent content not found");
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .insert({
      title: input.data.title.trim(),
      summary: input.data.summary.trim(),
      body: input.data.body.trim(),
      category: input.data.category,
      content_type: input.data.contentType,
      audience_scope: input.data.audienceScope,
      target_relationship_stages: input.data.targetRelationshipStages ?? parent.target_relationship_stages,
      target_client_ids: input.data.targetClientIds ?? parent.target_client_ids,
      author_user_id: input.authorUserId,
      adviser_user_id: input.adviserUserId,
      external_url: input.data.externalUrl ?? null,
      external_source_name: input.data.externalSourceName ?? null,
      source_publication_date: input.data.sourcePublicationDate ?? null,
      expires_at: input.data.expiresAt ?? null,
      approval_status: "draft",
      version: parent.version + 1,
      supersedes_content_id: input.supersedesContentId,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create content version: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function dbLoadGovernedContentById(
  id: string,
): Promise<GovernedContentRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load governed content: ${error.message}`);
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function dbListGovernedContentForAuthor(
  authorUserId: string,
): Promise<GovernedContentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .select("*")
    .eq("author_user_id", authorUserId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list governed content: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function dbListGovernedContentForAdviser(
  adviserUserId: string,
): Promise<GovernedContentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .select("*")
    .eq("adviser_user_id", adviserUserId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list adviser content: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function dbListSubmittedContent(): Promise<GovernedContentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .select("*")
    .in("approval_status", ["submitted_for_review", "changes_requested", "approved", "scheduled"])
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list submitted content: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function dbListAllGovernedContent(): Promise<GovernedContentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list all governed content: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function dbListPublishedContent(): Promise<GovernedContentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .select("*")
    .eq("approval_status", "published")
    .is("withdrawn_at", null)
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list published content: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function dbUpdateGovernedContent(
  id: string,
  patch: Partial<{
    title: string;
    summary: string;
    body: string;
    category: GovernedContentCategory;
    content_type: GovernedContentType;
    audience_scope: AudienceScope;
    target_relationship_stages: string[];
    target_client_ids: string[];
    external_url: string | null;
    external_source_name: string | null;
    source_publication_date: string | null;
    expires_at: string | null;
    approval_status: ContentApprovalStatus;
    approved_by_user_id: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    scheduled_at: string | null;
    published_at: string | null;
    withdrawn_at: string | null;
    withdrawal_reason: string | null;
  }>,
): Promise<GovernedContentRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update governed content: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

/** Concurrency-safe publish — updates only when status is still publishable. */
export async function dbPublishGovernedContent(
  id: string,
  input: {
    expectedStatuses: ContentApprovalStatus[];
    publishedAt: string;
    scheduledAt?: string | null;
  },
): Promise<GovernedContentRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .update({
      approval_status: "published",
      published_at: input.publishedAt,
      scheduled_at: input.scheduledAt ?? null,
    } as never)
    .eq("id", id)
    .in("approval_status", input.expectedStatuses)
    .is("withdrawn_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to publish governed content: ${error.message}`);
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

/** List scheduled content due for automated publication. */
export async function dbListDueScheduledContent(limit: number): Promise<GovernedContentRow[]> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("governed_content")
    .select("*")
    .eq("approval_status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now)
    .is("withdrawn_at", null)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to list due scheduled content: ${error.message}`);
  }

  return ((data ?? []) as Record<string, unknown>[]).map((row) => mapRow(row));
}

/** True when a newer version of this content is already published. */
export async function dbHasPublishedSupersedingVersion(contentId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("governed_content")
    .select("id")
    .eq("supersedes_content_id", contentId)
    .eq("approval_status", "published")
    .is("withdrawn_at", null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check superseding version: ${error.message}`);
  }

  return Boolean(data);
}

/** Exclude published rows superseded by a newer published version. */
export function filterSupersededPublishedRows(rows: GovernedContentRow[]): GovernedContentRow[] {
  const supersededIds = new Set(
    rows
      .map((row) => row.supersedes_content_id)
      .filter((id): id is string => Boolean(id)),
  );
  return rows.filter((row) => !supersededIds.has(row.id));
}
