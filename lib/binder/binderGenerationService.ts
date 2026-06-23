import "server-only";

import { randomUUID } from "node:crypto";

import {
  normalizeBinderSectionIds,
  type BinderSectionId,
} from "@/lib/binder/binderSectionRegistry";
import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import {
  dbFindBinderByIdempotencyKey,
  dbGetLatestBinderLineageForClient,
  dbGetMaxBinderVersionForLineage,
  dbInsertBinderGeneration,
  dbListBinderExportsForClient,
  dbLoadBinderExportForClient,
  dbTransitionBinderGeneration,
  type BinderExportDbRow,
} from "@/lib/supabase/binderExportPersistence";
import {
  BINDER_EXPORT_BUCKET,
  BINDER_MAX_PDF_BYTES,
  createBinderSignedUrl,
  uploadBinderPdf,
} from "@/lib/supabase/binderStoragePersistence";

import { auditBinderEvent } from "./binderAudit";
import { BINDER_ERROR_CODES, BinderServiceError } from "./binderErrors";
import {
  buildBinderGenerationIdempotencyKey,
  sha256Buffer,
} from "./binderGenerationIdempotency";
import {
  assertNoSensitiveMarkersInText,
  collectRenderableText,
} from "./binderPdfRedaction";
import {
  assertPdfWithinA4Bounds,
  extractPdfSearchableText,
  getBinderPdfLayoutMeta,
  renderBinderPdf,
} from "./binderPdfRenderer";
import {
  BINDER_MAX_LIST_RESULTS,
  BINDER_MAX_SECTION_COUNT,
  BINDER_RENDERER_SCHEMA_VERSION,
  type BinderGenerationInput,
  type BinderPublicMetadata,
} from "./binderPdfTypes";
import { resolveBinderSections } from "./binderSectionResolvers";

type BinderSection = BinderSectionId;

function validateSections(sections: BinderSection[]): BinderSection[] {
  const { canonical, rejected } = normalizeBinderSectionIds(sections);
  if (rejected.length > 0 || canonical.length === 0) {
    throw new BinderServiceError(BINDER_ERROR_CODES.INVALID_SECTIONS);
  }
  if (canonical.length > BINDER_MAX_SECTION_COUNT) {
    throw new BinderServiceError(BINDER_ERROR_CODES.INVALID_SECTIONS);
  }
  return canonical;
}

function toPublicMetadata(
  row: BinderExportDbRow,
  reused: boolean,
): BinderPublicMetadata {
  return {
    id: row.id,
    binderLineageId: row.binder_lineage_id,
    version: row.version,
    generationStatus: row.generation_status,
    lifecycleStatus: row.status,
    sectionsIncluded: row.sections_included,
    meetingDate: row.meeting_date,
    createdAt: row.created_at,
    generationCompletedAt: row.generation_completed_at,
    reused,
  };
}

async function allocateLineageAndVersion(
  clientId: string,
  explicitLineageId?: string | null,
): Promise<{ lineageId: string; version: number }> {
  const lineageId =
    explicitLineageId ??
    (await dbGetLatestBinderLineageForClient(clientId)) ??
    randomUUID();
  const maxVersion = await dbGetMaxBinderVersionForLineage(lineageId);
  return { lineageId, version: maxVersion + 1 };
}

async function markFailed(
  binderId: string,
  clientId: string,
  adviserUserId: string,
  code: string,
): Promise<void> {
  await dbTransitionBinderGeneration(
    binderId,
    {
      generation_status: "failed",
      generation_error_code: code,
    },
    clientId,
  );
  await auditBinderEvent({
    action: "binder_generation_failed",
    clientId,
    userId: adviserUserId,
    binderExportId: binderId,
    metadata: { errorCode: code as never, outcome: "failed" },
  });
}

export async function generateBinderMeetingPack(
  input: BinderGenerationInput,
): Promise<BinderPublicMetadata> {
  const enabled = await isFeatureEnabled("binder_export");
  if (!enabled) {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  const access = await resolveAccessibleClient(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );
  if (access.status !== "ok") {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  const sections = validateSections(input.sections);
  const resolved = await resolveBinderSections({
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    userRole: input.userRole,
    meetingDate: input.meetingDate,
    sections,
  });

  assertNoSensitiveMarkersInText(collectRenderableText(resolved.renderModel));

  const lineageSeed =
    input.binderLineageId ??
    (await dbGetLatestBinderLineageForClient(input.clientId));

  const idempotencyKey = buildBinderGenerationIdempotencyKey({
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    binderLineageId: lineageSeed,
    meetingDate: input.meetingDate,
    sectionIds: sections,
    sourcePublications: resolved.sourcePublications,
    rendererSchemaVersion: BINDER_RENDERER_SCHEMA_VERSION,
  });

  const existing = await dbFindBinderByIdempotencyKey(idempotencyKey);
  if (existing?.generation_status === "ready") {
    await auditBinderEvent({
      action: "binder_generation_reused",
      clientId: input.clientId,
      userId: input.adviserUserId,
      binderExportId: existing.id,
      metadata: {
        binderLineageId: existing.binder_lineage_id,
        version: existing.version,
        sectionCount: existing.sections_included.length,
        reused: true,
        outcome: "ready",
      },
    });
    return toPublicMetadata(existing, true);
  }

  if (
    existing &&
    (existing.generation_status === "pending" ||
      existing.generation_status === "generating")
  ) {
    throw new BinderServiceError(BINDER_ERROR_CODES.GENERATION_CONFLICT);
  }

  let binderRow = existing;

  if (!binderRow) {
    const { lineageId, version } = await allocateLineageAndVersion(
      input.clientId,
      lineageSeed,
    );

    try {
      binderRow = await dbInsertBinderGeneration({
        clientId: input.clientId,
        adviserUserId: input.adviserUserId,
        meetingDate: input.meetingDate,
        sectionsIncluded: sections,
        sourcePublicationIds: resolved.sourcePublications.map((p) => p.id),
        documentIds: [],
        binderLineageId: lineageId,
        version,
        generationIdempotencyKey: idempotencyKey,
      });
    } catch {
      const raced = await dbFindBinderByIdempotencyKey(idempotencyKey);
      if (raced?.generation_status === "ready") {
        return toPublicMetadata(raced, true);
      }
      if (raced) {
        binderRow = raced;
      } else {
        throw new BinderServiceError(BINDER_ERROR_CODES.GENERATION_CONFLICT);
      }
    }
  } else if (binderRow.generation_status === "failed") {
    binderRow = await dbTransitionBinderGeneration(
      binderRow.id,
      {
        generation_status: "pending",
        generation_error_code: null,
      },
      input.clientId,
    );
  }

  await auditBinderEvent({
    action: "binder_generation_started",
    clientId: input.clientId,
    userId: input.adviserUserId,
    binderExportId: binderRow.id,
    metadata: {
      binderLineageId: binderRow.binder_lineage_id,
      version: binderRow.version,
      sectionCount: sections.length,
      reused: false,
    },
  });

  binderRow = await dbTransitionBinderGeneration(
    binderRow.id,
    { generation_status: "generating" },
    input.clientId,
  );

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = renderBinderPdf(resolved.renderModel);
    const meta = getBinderPdfLayoutMeta(pdfBuffer);
    assertPdfWithinA4Bounds(meta);
    assertNoSensitiveMarkersInText(extractPdfSearchableText(pdfBuffer));
  } catch {
    await markFailed(
      binderRow.id,
      input.clientId,
      input.adviserUserId,
      BINDER_ERROR_CODES.RENDER_FAILED,
    );
    throw new BinderServiceError(BINDER_ERROR_CODES.RENDER_FAILED);
  }

  if (pdfBuffer.length > BINDER_MAX_PDF_BYTES) {
    await markFailed(
      binderRow.id,
      input.clientId,
      input.adviserUserId,
      BINDER_ERROR_CODES.TOO_LARGE,
    );
    throw new BinderServiceError(BINDER_ERROR_CODES.TOO_LARGE);
  }

  const contentHash = sha256Buffer(pdfBuffer);
  let storagePath: string;
  try {
    const uploaded = await uploadBinderPdf({
      clientId: input.clientId,
      binderExportId: binderRow.id,
      version: binderRow.version,
      pdfBuffer,
    });
    storagePath = uploaded.path;
  } catch {
    await markFailed(
      binderRow.id,
      input.clientId,
      input.adviserUserId,
      BINDER_ERROR_CODES.STORAGE_FAILED,
    );
    throw new BinderServiceError(BINDER_ERROR_CODES.STORAGE_FAILED);
  }

  try {
    const finalized = await dbTransitionBinderGeneration(
      binderRow.id,
      {
        generation_status: "ready",
        storage_path: storagePath,
        storage_bucket: BINDER_EXPORT_BUCKET,
        file_size_bytes: pdfBuffer.length,
        mime_type: "application/pdf",
        content_hash: contentHash,
        generation_completed_at: new Date().toISOString(),
        generation_error_code: null,
      },
      input.clientId,
    );

    await auditBinderEvent({
      action: "binder_generated",
      clientId: input.clientId,
      userId: input.adviserUserId,
      binderExportId: finalized.id,
      metadata: {
        binderLineageId: finalized.binder_lineage_id,
        version: finalized.version,
        sectionCount: sections.length,
        reused: false,
        outcome: "ready",
      },
    });

    return toPublicMetadata(finalized, false);
  } catch {
    await auditBinderEvent({
      action: "binder_storage_orphan_risk",
      clientId: input.clientId,
      userId: input.adviserUserId,
      binderExportId: binderRow.id,
      metadata: {
        binderLineageId: binderRow.binder_lineage_id,
        version: binderRow.version,
        outcome: "orphan_risk",
        errorCode: BINDER_ERROR_CODES.STORAGE_FAILED,
      },
    });
    await markFailed(
      binderRow.id,
      input.clientId,
      input.adviserUserId,
      BINDER_ERROR_CODES.STORAGE_FAILED,
    );
    throw new BinderServiceError(BINDER_ERROR_CODES.STORAGE_FAILED);
  }
}

export async function listBinderExportsForAdviserClient(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  generationStatus?: BinderExportDbRow["generation_status"];
}): Promise<BinderPublicMetadata[]> {
  const enabled = await isFeatureEnabled("binder_export");
  if (!enabled) {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  const access = await resolveAccessibleClient(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );
  if (access.status !== "ok") {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  const rows = await dbListBinderExportsForClient({
    clientId: input.clientId,
    generationStatus: input.generationStatus,
    limit: BINDER_MAX_LIST_RESULTS,
  });

  return rows.map((row) => toPublicMetadata(row, false));
}

export async function createAdviserBinderSignedDownload(input: {
  clientId: string;
  binderExportId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
}): Promise<{ signedUrl: string; expiresIn: number }> {
  const enabled = await isFeatureEnabled("binder_export");
  if (!enabled) {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
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

  if (binder.generation_status !== "ready" || !binder.storage_path) {
    throw new BinderServiceError(BINDER_ERROR_CODES.NOT_READY);
  }

  const signed = await createBinderSignedUrl({
    storagePath: binder.storage_path,
    storageBucket: binder.storage_bucket ?? BINDER_EXPORT_BUCKET,
  });

  return signed;
}

export async function auditBinderDownload(input: {
  clientId: string;
  adviserUserId: string;
  binderExportId: string;
  binder: BinderExportDbRow;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await auditBinderEvent({
    action: "binder_downloaded",
    clientId: input.clientId,
    userId: input.adviserUserId,
    binderExportId: input.binderExportId,
    metadata: {
      binderLineageId: input.binder.binder_lineage_id,
      version: input.binder.version,
      sectionCount: input.binder.sections_included.length,
      outcome: "downloaded",
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
