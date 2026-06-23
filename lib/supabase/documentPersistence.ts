import "server-only";

import { canClientViewDocument } from "@/lib/compliance/documentVisibility";
import { assertBinderDocumentClientAccessible, isBinderDocumentTags, loadBinderByPublishedDocumentId } from "@/lib/binder/binderClientAccess";
import { emitLifecycleNotificationSafe } from "@/lib/communications/lifecycleNotificationService";
import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

export const DOCUMENT_BUCKET = "client-documents";
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_EXPIRY_SECONDS = 120;

export const DOCUMENT_CATEGORIES = [
  "insurance",
  "investment",
  "cpf",
  "estate",
  "tax",
  "property",
  "loan",
  "identity",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const PROTECTION_PORTFOLIO_SUMMARY_TAG = "protection_portfolio_summary";
export const ADVISOR_PROTECTION_REPORT_SOURCE = "advisor_protection_report";
export const ADVISOR_BINDER_EXPORT_SOURCE = "advisor_binder_export";
export const BINDER_PUBLISHED_TAG = "binder_published";
export const BINDER_CLIENT_VISIBLE_TAG = "client_visible";

export type VaultDocumentRecord = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: DocumentCategory;
  title: string;
  description: string | null;
  source_feature: string | null;
  uploaded_by: string | null;
  created_at: string;
};

type DbDocumentCategory =
  | "insurance_policy"
  | "will"
  | "trust"
  | "cpf"
  | "financial_statement"
  | "estate"
  | "investment_statement"
  | "business_ownership"
  | "other";

const ALLOWED_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "doc",
  "docx",
  "xls",
  "xlsx",
]);

const EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const CATEGORY_TO_DB: Record<DocumentCategory, DbDocumentCategory> = {
  insurance: "insurance_policy",
  investment: "investment_statement",
  cpf: "cpf",
  estate: "estate",
  tax: "financial_statement",
  property: "business_ownership",
  loan: "financial_statement",
  identity: "other",
  other: "other",
};

type DocumentRow = {
  id: string;
  client_id: string;
  uploaded_by_user_id: string | null;
  category: DbDocumentCategory;
  title: string;
  description: string | null;
  file_name: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  storage_bucket: string;
  storage_path: string;
  tags: string[] | null;
  is_archived: boolean;
  created_at: string;
};

export function isValidDocumentCategory(
  value: unknown,
): value is DocumentCategory {
  return (
    typeof value === "string" &&
    (DOCUMENT_CATEGORIES as readonly string[]).includes(value)
  );
}

function fileExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").toLowerCase();
}

export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() ?? "file";
  const sanitized = base
    .replace(/[^\w.\-()+ ]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);

  return sanitized || "file";
}

export function buildDocumentStoragePath(
  clientId: string,
  fileName: string,
): string {
  const timestamp = Date.now();
  const safeName = sanitizeFileName(fileName);
  return `clients/${clientId}/documents/${timestamp}-${safeName}`;
}

export function buildProtectionReportStoragePath(
  clientId: string,
  householdName: string,
  statementPeriod: string,
): string {
  const date = new Date().toISOString().slice(0, 10);
  const safeHousehold = (householdName || "household")
    .replace(/[^\w.\-()+ ]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const safePeriod = (statementPeriod || "statement")
    .replace(/[^\w.\- ]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 24);
  const fileName = `${date}-${safeHousehold}-${safePeriod}-protection-summary.pdf`;
  return `clients/${clientId}/protection-reports/${fileName}`;
}

export type UploadDocumentOptions = {
  title?: string;
  description?: string;
  tags?: string[];
  storagePath?: string;
  fileName?: string;
};

export function validateUploadFile(file: File): {
  ok: true;
  extension: string;
  mimeType: string;
} | { ok: false; error: string } {
  if (!(file instanceof File)) {
    return { ok: false, error: "A file is required" };
  }

  if (file.size <= 0) {
    return { ok: false, error: "File is empty" };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { ok: false, error: "File exceeds the 10MB size limit" };
  }

  const extension = fileExtension(file.name);
  if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: "File type is not supported" };
  }

  const expectedMime = EXTENSION_MIME[extension];
  const declaredMime = file.type.trim().toLowerCase();

  if (
    declaredMime &&
    declaredMime !== "application/octet-stream" &&
    declaredMime !== expectedMime &&
    !(extension === "jpg" && declaredMime === "image/jpeg") &&
    !(extension === "jpeg" && declaredMime === "image/jpeg")
  ) {
    return { ok: false, error: "File MIME type does not match extension" };
  }

  return { ok: true, extension, mimeType: expectedMime };
}

function resolveUiCategory(row: DocumentRow): DocumentCategory {
  const tagged = row.tags?.[0];
  if (tagged && isValidDocumentCategory(tagged)) {
    return tagged;
  }

  const reverseMap: Partial<Record<DbDocumentCategory, DocumentCategory>> = {
    insurance_policy: "insurance",
    investment_statement: "investment",
    cpf: "cpf",
    estate: "estate",
    financial_statement: "tax",
    business_ownership: "property",
    will: "estate",
    trust: "estate",
    other: "other",
  };

  return reverseMap[row.category] ?? "other";
}

function resolveSourceFeature(tags: string[] | null | undefined): string | null {
  if (!tags?.length) return null;
  if (tags.includes(ADVISOR_PROTECTION_REPORT_SOURCE)) {
    return ADVISOR_PROTECTION_REPORT_SOURCE;
  }
  if (tags.includes(BINDER_PUBLISHED_TAG)) {
    return ADVISOR_BINDER_EXPORT_SOURCE;
  }
  return null;
}

function mapRowToRecord(row: DocumentRow): VaultDocumentRecord {
  return {
    id: row.id,
    file_name: row.file_name,
    file_path: row.storage_path,
    file_type: row.mime_type,
    file_size: row.file_size_bytes,
    category: resolveUiCategory(row),
    title: row.title,
    description: row.description,
    source_feature: resolveSourceFeature(row.tags),
    uploaded_by: row.uploaded_by_user_id,
    created_at: row.created_at,
  };
}

async function fetchOwnedDocument(
  clientId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("documents")
    .select(
      "id, client_id, uploaded_by_user_id, category, title, description, file_name, mime_type, file_size_bytes, storage_bucket, storage_path, tags, is_archived, created_at",
    )
    .eq("id", documentId)
    .eq("client_id", clientId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load document: ${error.message}`);
  }

  return data as DocumentRow | null;
}

export async function listClientDocuments(
  client: AppClientRow,
  category?: DocumentCategory | null,
  options?: {
    prospectMode?: boolean;
    clientUserId?: string;
  },
): Promise<VaultDocumentRecord[]> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("documents")
    .select(
      "id, client_id, uploaded_by_user_id, category, title, description, file_name, mime_type, file_size_bytes, storage_bucket, storage_path, tags, is_archived, created_at",
    )
    .eq("client_id", client.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list documents: ${error.message}`);
  }

  const rows = (data ?? []) as DocumentRow[];

  const visibility = await Promise.all(
    rows.map(async (row) => ({
      row,
      visible: await isBinderDocumentListedForClient(client.id, row),
    })),
  );

  return visibility
    .filter(({ visible }) => visible)
    .map(({ row }) => row)
    .filter((row) => {
      if (options?.prospectMode && options.clientUserId) {
        return canClientViewDocument({
          client,
          clientUserId: options.clientUserId,
          document: row,
        });
      }
      return true;
    })
    .filter((row) => !category || resolveUiCategory(row) === category)
    .map(mapRowToRecord);
}

async function isBinderDocumentListedForClient(
  clientId: string,
  row: DocumentRow,
): Promise<boolean> {
  if (!isBinderDocumentTags(row.tags)) {
    return true;
  }

  const binder = await loadBinderByPublishedDocumentId(row.id, clientId);
  return (
    binder !== null &&
    binder.status === "published_to_client" &&
    !binder.withdrawn_at &&
    binder.generation_status === "ready"
  );
}

export async function uploadClientDocument(
  client: AppClientRow,
  uploadedByUserId: string,
  file: File,
  category: DocumentCategory,
  options?: UploadDocumentOptions,
): Promise<VaultDocumentRecord> {
  const validation = validateUploadFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const admin = createAdminSupabaseClient();
  const resolvedFileName = options?.fileName ?? file.name;
  const storagePath =
    options?.storagePath ??
    buildDocumentStoragePath(client.id, resolvedFileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  const dbCategory = CATEGORY_TO_DB[category];
  const title = options?.title?.trim() || sanitizeFileName(resolvedFileName);
  const tags = options?.tags?.length ? options.tags : [category];

  const { error: uploadError } = await admin.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, buffer, {
      contentType: validation.mimeType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`);
  }

  const { data: inserted, error: insertError } = await admin
    .from("documents")
    .insert({
      client_id: client.id,
      uploaded_by_user_id: uploadedByUserId,
      category: dbCategory,
      title,
      description: options?.description ?? null,
      file_name: resolvedFileName,
      mime_type: validation.mimeType,
      file_size_bytes: file.size,
      storage_bucket: DOCUMENT_BUCKET,
      storage_path: storagePath,
      tags,
    } as never)
    .select(
      "id, client_id, uploaded_by_user_id, category, title, description, file_name, mime_type, file_size_bytes, storage_bucket, storage_path, tags, is_archived, created_at",
    )
    .single();

  if (insertError) {
    await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);
    throw new Error(`Failed to save document metadata: ${insertError.message}`);
  }

  return mapRowToRecord(inserted as DocumentRow);
}

/** Metadata-only vault row for an immutable binder PDF in binder-exports. */
export async function insertPublishedBinderDocument(input: {
  clientId: string;
  uploadedByUserId: string;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
  version: number;
}): Promise<{ id: string }> {
  const admin = createAdminSupabaseClient();
  const title = "Client meeting pack";
  const fileName = "meeting-pack.pdf";
  const tags = [BINDER_PUBLISHED_TAG, BINDER_CLIENT_VISIBLE_TAG, "other"];

  const { data, error } = await admin
    .from("documents")
    .insert({
      client_id: input.clientId,
      uploaded_by_user_id: input.uploadedByUserId,
      category: "other",
      title,
      description: `Published meeting pack (version ${input.version})`,
      file_name: fileName,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      tags,
      is_archived: true,
    } as never)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create binder document row: ${error.message}`);
  }

  return { id: (data as { id: string }).id };
}

export async function deleteClientDocument(
  client: AppClientRow,
  documentId: string,
): Promise<{ id: string }> {
  const document = await fetchOwnedDocument(client.id, documentId);

  if (!document) {
    throw new Error("Document not found");
  }

  const admin = createAdminSupabaseClient();

  const isBinderDocument = isBinderDocumentTags(document.tags);

  if (!isBinderDocument) {
    const { error: storageError } = await admin.storage
      .from(document.storage_bucket)
      .remove([document.storage_path]);

    if (storageError) {
      throw new Error(`Failed to delete file: ${storageError.message}`);
    }
  }

  const { error: archiveError } = await admin
    .from("documents")
    .update({ is_archived: true } as never)
    .eq("id", document.id)
    .eq("client_id", client.id);

  if (archiveError) {
    throw new Error(`Failed to archive document: ${archiveError.message}`);
  }

  return { id: document.id };
}

async function issueSignedUrlForDocument(
  document: DocumentRow,
): Promise<{ signedUrl: string; expiresIn: number }> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin.storage
    .from(document.storage_bucket)
    .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create signed URL: ${error?.message ?? "Unknown error"}`,
    );
  }

  return {
    signedUrl: data.signedUrl,
    expiresIn: SIGNED_URL_EXPIRY_SECONDS,
  };
}

export async function createStaffDocumentSignedUrl(
  client: AppClientRow,
  documentId: string,
): Promise<{ signedUrl: string; expiresIn: number }> {
  const document = await fetchOwnedDocument(client.id, documentId);

  if (!document) {
    throw new Error("Document not found");
  }

  return issueSignedUrlForDocument(document);
}

export async function createDocumentSignedUrl(
  client: AppClientRow,
  documentId: string,
  clientUserId: string,
): Promise<{ signedUrl: string; expiresIn: number }> {
  const document = await fetchOwnedDocument(client.id, documentId);

  if (!document) {
    throw new Error("Document not found");
  }

  if (
    !canClientViewDocument({
      client,
      clientUserId,
      document,
    })
  ) {
    throw new Error("Document not found");
  }

  await assertBinderDocumentClientAccessible({
    documentId,
    clientId: client.id,
    tags: document.tags,
  });

  if (isBinderDocumentTags(document.tags)) {
    const { loadBinderByPublishedDocumentId } = await import(
      "@/lib/binder/binderClientAccess"
    );
    const binder = await loadBinderByPublishedDocumentId(documentId, client.id);
    if (binder) {
      const { auditBinderEvent } = await import("@/lib/binder/binderAudit");
      await auditBinderEvent({
        action: "binder_client_downloaded",
        clientId: client.id,
        userId: clientUserId,
        binderExportId: binder.id,
        metadata: {
          version: binder.version,
          outcome: "downloaded",
        },
      });
    }
  }

  const downloadDate = new Date().toISOString().slice(0, 10);
  await emitLifecycleNotificationSafe({
    event: "downloaded",
    sourceEntityType: "document",
    sourceEntityId: documentId,
    sourceLifecycleVersion: downloadDate,
    recipientClientId: client.id,
    referenceId: documentId,
    actorUserId: clientUserId,
    isClientVisible: true,
  });

  return issueSignedUrlForDocument(document);
}
