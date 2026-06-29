import "server-only";

import { CRM_V2_DOCUMENTS_MAX_SUMMARY } from "@/lib/crm-v2/constants";
import {
  buildLegacyDocumentVaultHref,
  buildLegacyPlanningOutputsHref,
} from "@/lib/crm-v2/relationships/routes";
import type { CrmDocumentSummaryItem } from "@/lib/crm-v2/relationships/types";
import {
  CRM_NOT_ESTABLISHED_LABEL,
  CRM_UNKNOWN_LABEL,
} from "@/lib/crm-v2/relationships/types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  insurance_policy: "Insurance",
  investment_statement: "Investment",
  cpf: "CPF",
  estate: "Estate planning",
  will: "Will",
  trust: "Trust",
  financial_statement: "Financial statement",
  other: "Other",
};

function formatUpdatedLabel(value: string | null): string {
  if (!value) return CRM_UNKNOWN_LABEL;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return CRM_UNKNOWN_LABEL;
  return parsed.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function loadCrmDocumentProjection(
  clientId: string,
): Promise<{ items: CrmDocumentSummaryItem[]; bounded: boolean; vaultHref: string }> {
  const admin = createAdminSupabaseClient();
  const vaultHref = buildLegacyDocumentVaultHref(clientId);

  const [documentsResult, bindersResult, outputsResult] = await Promise.all([
    admin
      .from("documents")
      .select("id, category, created_at, updated_at")
      .eq("client_id", clientId)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(CRM_V2_DOCUMENTS_MAX_SUMMARY + 1),
    admin
      .from("binder_exports")
      .select("id, status, published_to_client, updated_at, created_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(CRM_V2_DOCUMENTS_MAX_SUMMARY + 1),
    admin
      .from("published_outputs")
      .select("id, output_type, publication_status, published_at, updated_at")
      .eq("client_id", clientId)
      .in("publication_status", ["published", "adviser_reviewed"])
      .order("updated_at", { ascending: false })
      .limit(CRM_V2_DOCUMENTS_MAX_SUMMARY + 1),
  ]);

  const items: CrmDocumentSummaryItem[] = [];

  for (const row of (documentsResult.data ?? []) as Array<{
    id: string;
    category: string;
    created_at: string;
    updated_at: string;
  }>) {
    items.push({
      itemId: `document:${row.id}`,
      categoryLabel: DOCUMENT_CATEGORY_LABELS[row.category] ?? "Document",
      statusLabel: "In vault",
      updatedAt: row.updated_at ?? row.created_at,
      updatedLabel: formatUpdatedLabel(row.updated_at ?? row.created_at),
      workflowHref: vaultHref,
    });
  }

  for (const row of (bindersResult.data ?? []) as Array<{
    id: string;
    status: string;
    published_to_client: boolean;
    updated_at: string;
    created_at: string;
  }>) {
    items.push({
      itemId: `binder_export:${row.id}`,
      categoryLabel: "Meeting pack / binder",
      statusLabel: row.published_to_client ? "Published to client" : row.status.replace(/_/g, " "),
      updatedAt: row.updated_at ?? row.created_at,
      updatedLabel: formatUpdatedLabel(row.updated_at ?? row.created_at),
      workflowHref: vaultHref,
    });
  }

  for (const row of (outputsResult.data ?? []) as Array<{
    id: string;
    output_type: string;
    publication_status: string;
    published_at: string | null;
    updated_at: string;
  }>) {
    items.push({
      itemId: `published_output:${row.id}`,
      categoryLabel: "Published output",
      statusLabel: row.publication_status.replace(/_/g, " "),
      updatedAt: row.published_at ?? row.updated_at,
      updatedLabel: formatUpdatedLabel(row.published_at ?? row.updated_at),
      workflowHref: buildLegacyPlanningOutputsHref(clientId),
    });
  }

  if (items.length === 0) {
    items.push({
      itemId: "documents:empty",
      categoryLabel: "Document vault",
      statusLabel: CRM_NOT_ESTABLISHED_LABEL,
      updatedAt: null,
      updatedLabel: CRM_NOT_ESTABLISHED_LABEL,
      workflowHref: vaultHref,
    });
  }

  items.sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });

  const bounded = items.length > CRM_V2_DOCUMENTS_MAX_SUMMARY;
  return {
    items: items.slice(0, CRM_V2_DOCUMENTS_MAX_SUMMARY),
    bounded,
    vaultHref,
  };
}
