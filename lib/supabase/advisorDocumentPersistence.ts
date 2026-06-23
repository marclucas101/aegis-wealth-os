import "server-only";

import { isActiveClientStage } from "@/lib/compliance/relationshipStage";
import { emitLifecycleNotificationSafe } from "@/lib/communications/lifecycleNotificationService";

import {
  ADVISOR_PROTECTION_REPORT_SOURCE,
  buildProtectionReportStoragePath,
  deleteClientDocument,
  PROTECTION_PORTFOLIO_SUMMARY_TAG,
  uploadClientDocument,
  type DocumentCategory,
  type VaultDocumentRecord,
} from "./documentPersistence";
import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdvisorDocumentMutationResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: true; document: VaultDocumentRecord };

export type AdvisorDocumentDeleteResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | {
      ok: true;
      documentId: string;
      auditMeta: {
        category: string;
        fileType: string | null;
        fileSize: number | null;
      };
    };

type DocumentAuditRow = {
  id: string;
  category: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  tags: string[] | null;
};

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

async function resolveAccessibleClient(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
): Promise<
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "ok"; client: AppClientRow }
> {
  if (!isValidUuid(clientId)) {
    return { status: "not_found" };
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client: ${error.message}`);
  }

  if (!data) {
    return { status: "not_found" };
  }

  const client = data as AppClientRow;

  if (userRole === "advisor" && client.advisor_user_id !== authUserId) {
    return { status: "forbidden" };
  }

  return { status: "ok", client };
}

async function loadClientDocumentForAudit(
  clientId: string,
  documentId: string,
): Promise<DocumentAuditRow | null> {
  if (!isValidUuid(documentId)) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select("id, category, mime_type, file_size_bytes, tags")
    .eq("id", documentId)
    .eq("client_id", clientId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load document: ${error.message}`);
  }

  return (data as DocumentAuditRow | null) ?? null;
}

async function archivePreviousProtectionReports(
  client: AppClientRow,
  authUserId: string,
): Promise<string[]> {
  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("documents")
    .select("id")
    .eq("client_id", client.id)
    .eq("is_archived", false)
    .contains("tags", [PROTECTION_PORTFOLIO_SUMMARY_TAG]);

  const archivedIds: string[] = [];
  const transitionAt = new Date().toISOString();

  for (const row of (data ?? []) as { id: string }[]) {
    try {
      await deleteClientDocument(client, row.id);
      archivedIds.push(row.id);

      if (isActiveClientStage(client.relationship_stage)) {
        await emitLifecycleNotificationSafe({
          event: "replaced",
          sourceEntityType: "document",
          sourceEntityId: row.id,
          sourceLifecycleVersion: transitionAt,
          recipientClientId: client.id,
          referenceId: row.id,
          actorUserId: authUserId,
          isClientVisible: true,
        });
      }
    } catch {
      // Archive failure must not block new upload.
    }
  }

  return archivedIds;
}

function resolveAuditCategory(row: DocumentAuditRow): string {
  const tagged = row.tags?.[0];
  if (tagged) {
    return tagged;
  }

  return row.category.replace(/_/g, " ");
}

/**
 * Uploads a document on behalf of an advisor-assigned client.
 * Verifies advisor assignment (unless admin) before writing to storage.
 */
export async function uploadAdvisorClientDocument(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  file: File,
  category: DocumentCategory,
  options?: { requiresClientAction?: boolean },
): Promise<AdvisorDocumentMutationResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const document = await uploadClientDocument(
    access.client,
    authUserId,
    file,
    category,
  );

  if (
    options?.requiresClientAction &&
    isActiveClientStage(access.client.relationship_stage)
  ) {
    await emitLifecycleNotificationSafe({
      event: "action_required",
      sourceEntityType: "document",
      sourceEntityId: document.id,
      sourceLifecycleVersion: document.created_at,
      recipientClientId: access.client.id,
      referenceId: document.id,
      actorUserId: authUserId,
      isClientVisible: true,
    });
  }

  return { ok: true, document };
}

export type ProtectionReportVaultMetadata = {
  householdName: string;
  primaryContact: string;
  statementPeriod: string;
  adviserName: string;
  adviserCompany: string;
  policyCount: number;
  totalCoverage: number;
  monthlyPremium: number;
};

/**
 * Uploads a generated protection portfolio summary PDF to the client vault.
 */
export async function uploadAdvisorProtectionReport(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  file: File,
  metadata: ProtectionReportVaultMetadata,
): Promise<AdvisorDocumentMutationResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const title = `Protection Portfolio Summary — ${metadata.householdName} — ${metadata.statementPeriod}`;
  const fileName = `${metadata.householdName.replace(/[^\w.\-()+ ]/g, "_").slice(0, 80)}-protection-summary.pdf`;
  const storagePath = buildProtectionReportStoragePath(
    access.client.id,
    metadata.householdName,
    metadata.statementPeriod,
  );

  await archivePreviousProtectionReports(access.client, authUserId);

  const document = await uploadClientDocument(
    access.client,
    authUserId,
    file,
    "insurance",
    {
      title,
      fileName,
      storagePath,
      description: JSON.stringify({
        document_type: PROTECTION_PORTFOLIO_SUMMARY_TAG,
        source_feature: ADVISOR_PROTECTION_REPORT_SOURCE,
        ...metadata,
      }),
      tags: [
        "insurance",
        PROTECTION_PORTFOLIO_SUMMARY_TAG,
        ADVISOR_PROTECTION_REPORT_SOURCE,
      ],
    },
  );

  return { ok: true, document };
}

/**
 * Archives a client document on behalf of an advisor/admin.
 * Mirrors client vault delete behavior (storage remove + soft archive).
 */
export async function deleteAdvisorClientDocument(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  documentId: string,
): Promise<AdvisorDocumentDeleteResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const existing = await loadClientDocumentForAudit(clientId, documentId);

  if (!existing) {
    return { ok: false, reason: "not_found" };
  }

  try {
    await deleteClientDocument(access.client, documentId);
  } catch (err) {
    if (err instanceof Error && err.message === "Document not found") {
      return { ok: false, reason: "not_found" };
    }

    throw err;
  }

  const withdrawnAt = new Date().toISOString();
  if (isActiveClientStage(access.client.relationship_stage)) {
    await emitLifecycleNotificationSafe({
      event: "withdrawn",
      sourceEntityType: "document",
      sourceEntityId: documentId,
      sourceLifecycleVersion: withdrawnAt,
      recipientClientId: access.client.id,
      referenceId: documentId,
      actorUserId: authUserId,
      isClientVisible: true,
    });
  }

  return {
    ok: true,
    documentId,
    auditMeta: {
      category: resolveAuditCategory(existing),
      fileType: existing.mime_type,
      fileSize: existing.file_size_bytes,
    },
  };
}
