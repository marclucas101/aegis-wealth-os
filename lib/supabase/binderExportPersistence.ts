import "server-only";

import { createAdminSupabaseClient } from "./admin";
import type {
  BinderExportRow,
  BinderExportStatus,
} from "../communications/types";
import type { BinderGenerationStatus } from "../binder/binderPdfTypes";

export type BinderExportDbRow = BinderExportRow & {
  binder_lineage_id: string;
  generation_status: BinderGenerationStatus;
  generation_idempotency_key: string | null;
  storage_bucket: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  content_hash: string | null;
  generation_error_code: string | null;
  generation_completed_at: string | null;
  published_document_id: string | null;
  supersedes_binder_id: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
};

function mapRow(data: Record<string, unknown>): BinderExportDbRow {
  return data as BinderExportDbRow;
}

export async function dbFindBinderByIdempotencyKey(
  key: string,
): Promise<BinderExportDbRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("*")
    .eq("generation_idempotency_key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load binder by idempotency key: ${error.message}`);
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function dbGetLatestBinderLineageForClient(
  clientId: string,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("binder_lineage_id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load binder lineage: ${error.message}`);
  }

  return (data as { binder_lineage_id: string } | null)?.binder_lineage_id ?? null;
}

export async function dbGetMaxBinderVersionForLineage(
  lineageId: string,
): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("version")
    .eq("binder_lineage_id", lineageId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load binder version: ${error.message}`);
  }

  return (data as { version: number } | null)?.version ?? 0;
}

export async function dbInsertBinderGeneration(input: {
  clientId: string;
  adviserUserId: string;
  meetingDate: string | null;
  sectionsIncluded: string[];
  sourcePublicationIds: string[];
  documentIds: string[];
  binderLineageId: string;
  version: number;
  generationIdempotencyKey: string;
}): Promise<BinderExportDbRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .insert({
      client_id: input.clientId,
      adviser_user_id: input.adviserUserId,
      meeting_date: input.meetingDate,
      sections_included: input.sectionsIncluded,
      source_publication_ids: input.sourcePublicationIds,
      document_ids: input.documentIds,
      binder_lineage_id: input.binderLineageId,
      version: input.version,
      generation_idempotency_key: input.generationIdempotencyKey,
      generation_status: "pending",
      status: "generated",
      published_to_client: false,
      storage_bucket: "binder-exports",
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create binder generation: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function dbTransitionBinderGeneration(
  id: string,
  patch: Partial<{
    generation_status: BinderGenerationStatus;
    generation_error_code: string | null;
    storage_path: string | null;
    storage_bucket: string | null;
    file_size_bytes: number | null;
    mime_type: string | null;
    content_hash: string | null;
    generation_completed_at: string | null;
  }>,
  expectedClientId?: string,
): Promise<BinderExportDbRow> {
  const admin = createAdminSupabaseClient();
  let query = admin.from("binder_exports").update(patch as never).eq("id", id);
  if (expectedClientId) {
    query = query.eq("client_id", expectedClientId);
  }
  const { data, error } = await query.select("*").single();

  if (error) {
    throw new Error(`Failed to update binder generation: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function dbLoadBinderExportForClient(
  binderExportId: string,
  clientId: string,
): Promise<BinderExportDbRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("*")
    .eq("id", binderExportId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load binder export: ${error.message}`);
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function dbListBinderExportsForClient(input: {
  clientId: string;
  generationStatus?: BinderGenerationStatus;
  limit?: number;
}): Promise<BinderExportDbRow[]> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("binder_exports")
    .select("*")
    .eq("client_id", input.clientId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50);

  if (input.generationStatus) {
    query = query.eq("generation_status", input.generationStatus);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list binder exports: ${error.message}`);
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function dbFindCurrentPublishedBinderInLineage(input: {
  clientId: string;
  binderLineageId: string;
  excludeBinderId?: string;
}): Promise<BinderExportDbRow | null> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("binder_exports")
    .select("*")
    .eq("client_id", input.clientId)
    .eq("binder_lineage_id", input.binderLineageId)
    .eq("status", "published_to_client")
    .is("withdrawn_at", null);

  if (input.excludeBinderId) {
    query = query.neq("id", input.excludeBinderId);
  }

  const { data, error } = await query
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load current published binder: ${error.message}`);
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function dbPublishBinderExport(input: {
  binderExportId: string;
  clientId: string;
  publishedDocumentId: string;
  publishedAt: string;
  supersedesBinderId: string | null;
}): Promise<BinderExportDbRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .update({
      status: "published_to_client",
      published_to_client: true,
      published_at: input.publishedAt,
      published_document_id: input.publishedDocumentId,
      supersedes_binder_id: input.supersedesBinderId,
    } as never)
    .eq("id", input.binderExportId)
    .eq("client_id", input.clientId)
    .eq("generation_status", "ready")
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to publish binder export: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function dbWithdrawBinderExport(input: {
  binderExportId: string;
  clientId: string;
  withdrawnAt: string;
  withdrawalReason: string;
}): Promise<BinderExportDbRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .update({
      status: "withdrawn",
      published_to_client: false,
      withdrawn_at: input.withdrawnAt,
      withdrawal_reason: input.withdrawalReason,
    } as never)
    .eq("id", input.binderExportId)
    .eq("client_id", input.clientId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to withdraw binder export: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function dbSupersedePublishedBinder(input: {
  binderExportId: string;
  clientId: string;
  withdrawnAt: string;
  supersededByBinderId: string;
}): Promise<BinderExportDbRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .update({
      status: "withdrawn",
      published_to_client: false,
      withdrawn_at: input.withdrawnAt,
      withdrawal_reason: "superseded_by_new_version",
    } as never)
    .eq("id", input.binderExportId)
    .eq("client_id", input.clientId)
    .eq("status", "published_to_client")
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to supersede binder export: ${error.message}`);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function dbArchiveDocumentRow(
  clientId: string,
  documentId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("documents")
    .update({ is_archived: true } as never)
    .eq("id", documentId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to archive document: ${error.message}`);
  }
}

export async function dbUnarchiveDocumentRow(
  clientId: string,
  documentId: string,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("documents")
    .update({ is_archived: false } as never)
    .eq("id", documentId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to unarchive document: ${error.message}`);
  }
}

/** @deprecated Legacy manifest creation — use binderGenerationService */
export async function dbCreateBinderExport(input: {
  clientId: string;
  adviserUserId: string;
  meetingDate?: string | null;
  sectionsIncluded: string[];
  sourcePublicationIds: string[];
  documentIds: string[];
  storagePath?: string | null;
}): Promise<BinderExportRow> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("binder_exports")
    .insert({
      client_id: input.clientId,
      adviser_user_id: input.adviserUserId,
      meeting_date: input.meetingDate ?? null,
      sections_included: input.sectionsIncluded,
      source_publication_ids: input.sourcePublicationIds,
      document_ids: input.documentIds,
      storage_path: input.storagePath ?? null,
      status: "generated",
      published_to_client: false,
      version: 1,
    } as never)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create binder export: ${error.message}`);
  }

  return data as BinderExportRow;
}

export async function dbLoadBinderExport(id: string): Promise<BinderExportRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load binder export: ${error.message}`);
  }

  return data as BinderExportRow | null;
}

export async function dbUpdateBinderExport(
  id: string,
  patch: Partial<{
    status: BinderExportStatus;
    published_to_client: boolean;
    published_at: string | null;
    storage_path: string | null;
  }>,
): Promise<BinderExportRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update binder export: ${error.message}`);
  }

  return data as BinderExportRow;
}

export async function dbListBinderExportsForAdviser(
  adviserUserId: string,
): Promise<BinderExportRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("binder_exports")
    .select("*")
    .eq("adviser_user_id", adviserUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list binder exports: ${error.message}`);
  }

  return (data ?? []) as BinderExportRow[];
}

export async function dbClaimBinderVersion(input: {
  clientId: string;
  lineageId: string;
  maxAttempts?: number;
}): Promise<number> {
  const attempts = input.maxAttempts ?? 5;
  for (let i = 0; i < attempts; i++) {
    const currentMax = await dbGetMaxBinderVersionForLineage(input.lineageId);
    return currentMax + 1;
  }
  throw new Error("Failed to allocate binder version");
}
