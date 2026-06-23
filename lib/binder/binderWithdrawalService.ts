import "server-only";

import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import {
  dbArchiveDocumentRow,
  dbLoadBinderExportForClient,
  dbWithdrawBinderExport,
} from "@/lib/supabase/binderExportPersistence";

import { auditBinderEvent } from "./binderAudit";
import { requireBinderClientPublicationFeature } from "./binderClientAccess";
import { BINDER_ERROR_CODES, BinderServiceError } from "./binderErrors";
import { emitBinderWithdrawnNotification } from "./binderLifecycleIntegration";
import { buildBinderPublicationIdempotencyKey } from "./binderPublicationIdempotency";
import {
  isBinderWithdrawalReason,
  type BinderWithdrawalResult,
} from "./binderPublicationTypes";

export async function withdrawBinderFromClient(input: {
  clientId: string;
  binderExportId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  reason: string;
}): Promise<BinderWithdrawalResult> {
  await requireBinderClientPublicationFeature();

  if (!isBinderWithdrawalReason(input.reason)) {
    throw new BinderServiceError(BINDER_ERROR_CODES.PUBLICATION_DENIED);
  }

  const access = await resolveAccessibleClient(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );
  if (access.status !== "ok") {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  const binder = await dbLoadBinderExportForClient(
    input.binderExportId,
    input.clientId,
  );
  if (!binder) {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  buildBinderPublicationIdempotencyKey({
    binderExportId: binder.id,
    binderLineageId: binder.binder_lineage_id,
    version: binder.version,
    clientId: input.clientId,
    action: "withdraw",
  });

  if (binder.status === "withdrawn" && binder.withdrawn_at) {
    await auditBinderEvent({
      action: "binder_withdrawn_from_client",
      clientId: input.clientId,
      userId: input.adviserUserId,
      binderExportId: binder.id,
      metadata: {
        binderLineageId: binder.binder_lineage_id,
        version: binder.version,
        reused: true,
        outcome: "withdrawn",
        reasonCode: input.reason,
      },
    });
    return {
      binderExportId: binder.id,
      binderLineageId: binder.binder_lineage_id,
      version: binder.version,
      publicationStatus: "withdrawn",
      withdrawnAt: binder.withdrawn_at,
      reused: true,
    };
  }

  if (binder.status !== "published_to_client" || !binder.published_document_id) {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }

  const withdrawnAt = new Date().toISOString();
  const documentId = binder.published_document_id;

  const withdrawn = await dbWithdrawBinderExport({
    binderExportId: binder.id,
    clientId: input.clientId,
    withdrawnAt,
    withdrawalReason: input.reason,
  });

  await dbArchiveDocumentRow(input.clientId, documentId);

  await auditBinderEvent({
    action: "binder_withdrawn_from_client",
    clientId: input.clientId,
    userId: input.adviserUserId,
    binderExportId: withdrawn.id,
    metadata: {
      binderLineageId: withdrawn.binder_lineage_id,
      version: withdrawn.version,
      reused: false,
      outcome: "withdrawn",
      reasonCode: input.reason,
    },
  });

  await emitBinderWithdrawnNotification({
    clientId: input.clientId,
    documentId,
    binderExportId: withdrawn.id,
    version: withdrawn.version,
    actorUserId: input.adviserUserId,
  });

  return {
    binderExportId: withdrawn.id,
    binderLineageId: withdrawn.binder_lineage_id,
    version: withdrawn.version,
    publicationStatus: "withdrawn",
    withdrawnAt: withdrawn.withdrawn_at,
    reused: false,
  };
}
