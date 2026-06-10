import "server-only";

import {
  createDocumentSignedUrl,
  isValidDocumentCategory,
  type DocumentCategory,
} from "./documentPersistence";
import { createAdminSupabaseClient } from "./admin";
import type { AppClientRow } from "./userProfile";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

type DocumentAuditMeta = {
  category: string;
  fileType: string | null;
  fileSize: number | null;
};

type DocumentRow = {
  id: string;
  client_id: string;
  category: DbDocumentCategory;
  mime_type: string | null;
  file_size_bytes: number | null;
  tags: string[] | null;
  is_archived: boolean;
};

export type AdvisorDocumentSignedUrlResult =
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | {
      ok: true;
      signedUrl: string;
      expiresIn: number;
      auditMeta: DocumentAuditMeta;
    };

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function resolveUiCategory(row: DocumentRow): DocumentCategory | string {
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

  return reverseMap[row.category] ?? row.category;
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

async function loadClientDocument(
  clientId: string,
  documentId: string,
): Promise<DocumentRow | null> {
  if (!isValidUuid(documentId)) {
    return null;
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select("id, client_id, category, mime_type, file_size_bytes, tags, is_archived")
    .eq("id", documentId)
    .eq("client_id", clientId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load document: ${error.message}`);
  }

  return (data as DocumentRow | null) ?? null;
}

/**
 * Creates a short-lived signed URL for an advisor-assigned client's document.
 * Verifies advisor assignment (unless admin) and document ownership.
 */
export async function createAdvisorDocumentSignedUrl(
  authUserId: string,
  userRole: "advisor" | "admin",
  clientId: string,
  documentId: string,
): Promise<AdvisorDocumentSignedUrlResult> {
  const access = await resolveAccessibleClient(authUserId, userRole, clientId);

  if (access.status === "not_found") {
    return { ok: false, reason: "not_found" };
  }

  if (access.status === "forbidden") {
    return { ok: false, reason: "forbidden" };
  }

  const document = await loadClientDocument(clientId, documentId);

  if (!document) {
    return { ok: false, reason: "not_found" };
  }

  const signed = await createDocumentSignedUrl(access.client, documentId);

  return {
    ok: true,
    signedUrl: signed.signedUrl,
    expiresIn: signed.expiresIn,
    auditMeta: {
      category: String(resolveUiCategory(document)),
      fileType: document.mime_type,
      fileSize: document.file_size_bytes,
    },
  };
}
