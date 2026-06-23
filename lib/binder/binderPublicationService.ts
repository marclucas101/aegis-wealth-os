import "server-only";

import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import {
  dbArchiveDocumentRow,
  dbFindCurrentPublishedBinderInLineage,
  dbLoadBinderExportForClient,
  dbPublishBinderExport,
  dbSupersedePublishedBinder,
  dbUnarchiveDocumentRow,
} from "@/lib/supabase/binderExportPersistence";
import { insertPublishedBinderDocument } from "@/lib/supabase/documentPersistence";
import {
  BINDER_EXPORT_BUCKET,
  buildBinderStoragePath,
} from "@/lib/supabase/binderStoragePersistence";

import { auditBinderEvent } from "./binderAudit";
import { requireBinderClientPublicationFeature } from "./binderClientAccess";
import { BINDER_ERROR_CODES, BinderServiceError } from "./binderErrors";
import {
  emitBinderAvailableNotification,
  emitBinderSupersededNotification,
} from "./binderLifecycleIntegration";
import { buildBinderPublicationIdempotencyKey } from "./binderPublicationIdempotency";
import type { BinderPublicationResult } from "./binderPublicationTypes";

function validateBinderPublishable(
  binder: NonNullable<Awaited<ReturnType<typeof dbLoadBinderExportForClient>>>,
  clientId: string,
): void {
  if (binder.generation_status !== "ready") {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }
  if (binder.status === "withdrawn" || binder.withdrawn_at) {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }
  if (!binder.storage_path || !binder.content_hash || !binder.file_size_bytes) {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }
  if (binder.mime_type !== "application/pdf") {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }
  if ((binder.storage_bucket ?? BINDER_EXPORT_BUCKET) !== BINDER_EXPORT_BUCKET) {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }

  const expectedPath = buildBinderStoragePath({
    clientId,
    binderExportId: binder.id,
    version: binder.version,
  });
  if (binder.storage_path !== expectedPath) {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }
}

export async function publishBinderToClient(input: {
  clientId: string;
  binderExportId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  confirmed: boolean;
}): Promise<BinderPublicationResult> {
  await requireBinderClientPublicationFeature();

  if (!input.confirmed) {
    throw new BinderServiceError(BINDER_ERROR_CODES.CONFIRMATION_REQUIRED);
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
    action: "publish",
  });

  if (
    binder.status === "published_to_client" &&
    binder.published_document_id &&
    binder.published_to_client
  ) {
    await auditBinderEvent({
      action: "binder_publication_reused",
      clientId: input.clientId,
      userId: input.adviserUserId,
      binderExportId: binder.id,
      metadata: {
        binderLineageId: binder.binder_lineage_id,
        version: binder.version,
        reused: true,
        outcome: "published",
      },
    });
    return {
      binderExportId: binder.id,
      binderLineageId: binder.binder_lineage_id,
      version: binder.version,
      publicationStatus: "published_to_client",
      publishedAt: binder.published_at,
      documentId: binder.published_document_id,
      reused: true,
      supersededBinderId: binder.supersedes_binder_id,
    };
  }

  validateBinderPublishable(binder, input.clientId);

  const prior = await dbFindCurrentPublishedBinderInLineage({
    clientId: input.clientId,
    binderLineageId: binder.binder_lineage_id,
    excludeBinderId: binder.id,
  });

  if (prior && binder.version <= prior.version) {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_PUBLISHABLE);
  }

  const publishedAt = new Date().toISOString();
  let documentId: string;
  let supersededBinderId: string | null = null;

  try {
    const doc = await insertPublishedBinderDocument({
      clientId: input.clientId,
      uploadedByUserId: input.adviserUserId,
      storageBucket: BINDER_EXPORT_BUCKET,
      storagePath: binder.storage_path!,
      mimeType: binder.mime_type!,
      fileSizeBytes: binder.file_size_bytes!,
      version: binder.version,
    });
    documentId = doc.id;
  } catch {
    throw new BinderServiceError(BINDER_ERROR_CODES.PUBLICATION_CONFLICT);
  }

  if (prior) {
    supersededBinderId = prior.id;
    try {
      await dbSupersedePublishedBinder({
        binderExportId: prior.id,
        clientId: input.clientId,
        withdrawnAt: publishedAt,
        supersededByBinderId: binder.id,
      });
      if (prior.published_document_id) {
        await dbArchiveDocumentRow(input.clientId, prior.published_document_id);
        await emitBinderSupersededNotification({
          clientId: input.clientId,
          priorDocumentId: prior.published_document_id,
          successorDocumentId: documentId,
          priorBinderId: prior.id,
          actorUserId: input.adviserUserId,
          version: binder.version,
        });
        await auditBinderEvent({
          action: "binder_superseded",
          clientId: input.clientId,
          userId: input.adviserUserId,
          binderExportId: prior.id,
          metadata: {
            binderLineageId: prior.binder_lineage_id,
            version: prior.version,
            outcome: "superseded",
          },
        });
      }
    } catch {
      await dbArchiveDocumentRow(input.clientId, documentId);
      throw new BinderServiceError(BINDER_ERROR_CODES.PUBLICATION_CONFLICT);
    }
  }

  try {
    const published = await dbPublishBinderExport({
      binderExportId: binder.id,
      clientId: input.clientId,
      publishedDocumentId: documentId,
      publishedAt,
      supersedesBinderId: supersededBinderId,
    });

    await dbUnarchiveDocumentRow(input.clientId, documentId);

    await auditBinderEvent({
      action: "binder_published_to_client",
      clientId: input.clientId,
      userId: input.adviserUserId,
      binderExportId: published.id,
      metadata: {
        binderLineageId: published.binder_lineage_id,
        version: published.version,
        reused: false,
        outcome: "published",
      },
    });

    await emitBinderAvailableNotification({
      clientId: input.clientId,
      documentId,
      binderExportId: published.id,
      version: published.version,
      actorUserId: input.adviserUserId,
    });

    return {
      binderExportId: published.id,
      binderLineageId: published.binder_lineage_id,
      version: published.version,
      publicationStatus: "published_to_client",
      publishedAt: published.published_at,
      documentId,
      reused: false,
      supersededBinderId,
    };
  } catch {
    await dbArchiveDocumentRow(input.clientId, documentId);
    await auditBinderEvent({
      action: "binder_publication_consistency_risk",
      clientId: input.clientId,
      userId: input.adviserUserId,
      binderExportId: binder.id,
      metadata: {
        binderLineageId: binder.binder_lineage_id,
        version: binder.version,
        outcome: "consistency_risk",
        errorCode: "BINDER_PUBLICATION_CONFLICT",
      },
    });
    throw new BinderServiceError(BINDER_ERROR_CODES.PUBLICATION_CONFLICT);
  }
}
