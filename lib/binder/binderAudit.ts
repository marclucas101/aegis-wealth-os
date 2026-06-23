import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";

import type { BinderErrorCode } from "./binderErrors";

export type BinderAuditAction =
  | "binder_generation_started"
  | "binder_generated"
  | "binder_generation_reused"
  | "binder_generation_failed"
  | "binder_storage_orphan_risk"
  | "binder_downloaded"
  | "binder_published_to_client"
  | "binder_publication_reused"
  | "binder_superseded"
  | "binder_withdrawn_from_client"
  | "binder_client_downloaded"
  | "binder_lifecycle_notification_failed"
  | "binder_publication_consistency_risk";

export type BinderAuditMetadata = {
  binderExportId?: string;
  binderLineageId?: string;
  version?: number;
  sectionCount?: number;
  reused?: boolean;
  outcome?: string;
  errorCode?: BinderErrorCode;
  reasonCode?: string;
};

export async function auditBinderEvent(input: {
  action: BinderAuditAction;
  clientId: string;
  userId: string;
  binderExportId?: string;
  metadata?: BinderAuditMetadata;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await writeAuditLog({
    clientId: input.clientId,
    userId: input.userId,
    action: input.action,
    entityType: "binder_export",
    entityId: input.binderExportId ?? null,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
