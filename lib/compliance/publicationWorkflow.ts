import "server-only";

import { writeAuditLog } from "@/lib/supabase/auditLog";
import {
  dbInsertPublishedOutput,
  dbListPublishedOutputsForClient,
  dbLoadClientAdvisorAssignment,
  dbLoadClientRelationshipStage,
  dbLoadPublishedOutputById,
  dbLoadPublishedOutputsForClient,
  dbSupersedePublishedOutput,
  dbUpdateClientRelationshipStage,
  dbUpdatePublishedOutput,
  type PublishedOutputRow,
} from "@/lib/supabase/compliancePublication";

import {
  buildFinancialReadinessSnapshotFromInternal,
  sanitizeFinancialReadinessPayload,
  type ClientSafeFinancialReadinessSnapshot,
} from "./clientSafeDtos";
import type {
  OutputAudience,
  PublicationStatus,
  PublishedOutputType,
  RelationshipStage,
} from "./types";

export type { PublishedOutputRow };

const CURRENT_PUBLISHED_STATUSES: PublicationStatus[] = ["published"];

const TERMINAL_STATUSES: PublicationStatus[] = [
  "withdrawn",
  "expired",
  "superseded",
];

export function isCurrentPublishedOutput(row: PublishedOutputRow): boolean {
  if (!CURRENT_PUBLISHED_STATUSES.includes(row.publication_status)) {
    return false;
  }
  if (row.withdrawn_at || row.superseded_at) {
    return false;
  }
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    return false;
  }
  if (row.output_audience !== "client_published") {
    return false;
  }
  return true;
}

export async function loadPublishedOutputById(
  outputId: string,
): Promise<PublishedOutputRow | null> {
  return dbLoadPublishedOutputById(outputId);
}

export async function loadCurrentPublishedOutput(
  clientId: string,
  outputType: PublishedOutputType,
  audience: OutputAudience = "client_published",
): Promise<PublishedOutputRow | null> {
  const rows = await dbLoadPublishedOutputsForClient(clientId, outputType, audience);
  const { selectSingleCurrentPublishedOutput } = await import("./publicationSelection");
  return selectSingleCurrentPublishedOutput(rows);
}

export async function listPublishedOutputsForClient(
  clientId: string,
): Promise<PublishedOutputRow[]> {
  return dbListPublishedOutputsForClient(clientId);
}

export type PrepareOutputInput = {
  clientId: string;
  outputType: PublishedOutputType;
  audience?: OutputAudience;
  actorUserId: string;
  internalContext: {
    rating: string | null;
    strongestPillar: string | null;
    weakestPillar: string | null;
    informationCompletenessPercent: number;
    dataAsAt: string;
    missingCategories?: string[];
    hasAssignedAdviser?: boolean;
  };
  sourceInputVersion?: string;
  algorithmVersion?: string;
};

export async function prepareClientSafeOutput(
  input: PrepareOutputInput,
): Promise<PublishedOutputRow> {
  let safePayload: Record<string, unknown>;

  if (
    input.outputType === "financial_readiness_snapshot" ||
    input.outputType === "financial_overview"
  ) {
    const snapshot = buildFinancialReadinessSnapshotFromInternal({
      rating: input.internalContext.rating as never,
      strongestPillar: input.internalContext.strongestPillar,
      weakestPillar: input.internalContext.weakestPillar,
      informationCompletenessPercent:
        input.internalContext.informationCompletenessPercent,
      dataAsAt: input.internalContext.dataAsAt,
      missingCategories: input.internalContext.missingCategories,
      hasAssignedAdviser: input.internalContext.hasAssignedAdviser,
    });
    safePayload = snapshot as unknown as Record<string, unknown>;
    sanitizeFinancialReadinessPayload(safePayload);
  } else {
    throw new Error(`Unsupported output type for prepare: ${input.outputType}`);
  }

  const row = await dbInsertPublishedOutput({
    client_id: input.clientId,
    output_type: input.outputType,
    output_audience: input.audience ?? "client_published",
    publication_status: "draft",
    safe_payload: safePayload,
    source_input_version: input.sourceInputVersion ?? null,
    algorithm_version: input.algorithmVersion ?? "phase9a-v1",
    created_by_user_id: input.actorUserId,
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.actorUserId,
    action: "publication_prepared",
    entityType: "published_output",
    entityId: row.id,
    metadata: {
      outputType: input.outputType,
      audience: row.output_audience,
    },
  });

  return row;
}

function assertOutputMutable(existing: PublishedOutputRow): void {
  if (TERMINAL_STATUSES.includes(existing.publication_status)) {
    throw new Error(
      `Cannot modify output in terminal status: ${existing.publication_status}`,
    );
  }
  if (existing.withdrawn_at) {
    throw new Error("Cannot modify withdrawn output");
  }
}

export async function reviewPublishedOutput(
  outputId: string,
  reviewerUserId: string,
  clientId: string,
): Promise<PublishedOutputRow> {
  const existing = await loadPublishedOutputById(outputId);
  if (!existing || existing.client_id !== clientId) {
    throw new Error("Published output not found");
  }
  if (existing.publication_status !== "draft") {
    throw new Error("Only draft outputs can be reviewed");
  }
  assertOutputMutable(existing);

  if (
    existing.output_type === "financial_readiness_snapshot" ||
    existing.output_type === "financial_overview"
  ) {
    sanitizeFinancialReadinessPayload(existing.safe_payload);
  }

  const now = new Date().toISOString();
  const data = await dbUpdatePublishedOutput(
    outputId,
    {
      publication_status: "adviser_reviewed",
      reviewed_by_user_id: reviewerUserId,
      reviewed_at: now,
    },
    clientId,
  );

  await writeAuditLog({
    clientId,
    userId: reviewerUserId,
    action: "publication_reviewed",
    entityType: "published_output",
    entityId: outputId,
  });

  return data;
}

export async function publishOutput(
  outputId: string,
  publisherUserId: string,
  clientId: string,
  expiresAt?: string | null,
  options?: { requireAssignment?: boolean },
): Promise<PublishedOutputRow> {
  const existing = await loadPublishedOutputById(outputId);
  if (!existing || existing.client_id !== clientId) {
    throw new Error("Published output not found");
  }

  if (
    existing.publication_status === "published" &&
    isCurrentPublishedOutput(existing)
  ) {
    return existing;
  }

  if (existing.publication_status !== "adviser_reviewed") {
    throw new Error("Output must be adviser_reviewed before publishing");
  }

  assertOutputMutable(existing);

  if (options?.requireAssignment) {
    const assignedAdviser = await dbLoadClientAdvisorAssignment(clientId);
    if (assignedAdviser !== publisherUserId) {
      throw new Error("Adviser assignment required to publish for this client");
    }
  }

  if (
    existing.output_type === "financial_readiness_snapshot" ||
    existing.output_type === "financial_overview"
  ) {
    sanitizeFinancialReadinessPayload(existing.safe_payload);
  }

  const current = await loadCurrentPublishedOutput(
    clientId,
    existing.output_type,
    existing.output_audience,
  );

  const now = new Date().toISOString();

  if (current && current.id !== outputId) {
    await dbSupersedePublishedOutput(current.id, outputId, now);

    await writeAuditLog({
      clientId,
      userId: publisherUserId,
      action: "publication_superseded",
      entityType: "published_output",
      entityId: current.id,
      metadata: { supersededById: outputId },
    });
  }

  const mergedPayload = sanitizeFinancialReadinessPayload({
    ...existing.safe_payload,
    adviserReviewStatus: "published",
    lastReviewedDate: now,
  } as Record<string, unknown>);

  const data = await dbUpdatePublishedOutput(
    outputId,
    {
      publication_status: "published",
      safe_payload: mergedPayload as unknown as Record<string, unknown>,
      published_by_user_id: publisherUserId,
      published_at: now,
      expires_at: expiresAt ?? null,
      reviewed_by_user_id: existing.reviewed_by_user_id ?? publisherUserId,
      reviewed_at: existing.reviewed_at ?? now,
    },
    clientId,
  );

  await writeAuditLog({
    clientId,
    userId: publisherUserId,
    action: "publication_published",
    entityType: "published_output",
    entityId: outputId,
    metadata: {
      outputType: existing.output_type,
      algorithmVersion: existing.algorithm_version,
      sourceInputVersion: existing.source_input_version,
    },
  });

  return data;
}

export async function withdrawOutput(
  outputId: string,
  actorUserId: string,
  clientId: string,
  reason: string,
): Promise<PublishedOutputRow> {
  const existing = await loadPublishedOutputById(outputId);
  if (!existing || existing.client_id !== clientId) {
    throw new Error("Published output not found");
  }

  if (existing.publication_status === "withdrawn") {
    return existing;
  }

  const now = new Date().toISOString();
  const data = await dbUpdatePublishedOutput(
    outputId,
    {
      publication_status: "withdrawn",
      withdrawn_at: now,
      withdrawal_reason: reason,
    },
    clientId,
  );

  await writeAuditLog({
    clientId,
    userId: actorUserId,
    action: "publication_withdrawn",
    entityType: "published_output",
    entityId: outputId,
    metadata: { reason },
  });

  return data;
}

export async function expireOutput(
  outputId: string,
  actorUserId: string,
  clientId: string,
): Promise<PublishedOutputRow> {
  const existing = await loadPublishedOutputById(outputId);
  if (!existing || existing.client_id !== clientId) {
    throw new Error("Published output not found");
  }

  if (existing.publication_status === "expired") {
    return existing;
  }

  const now = new Date().toISOString();
  const data = await dbUpdatePublishedOutput(
    outputId,
    {
      publication_status: "expired",
      expires_at: now,
    },
    clientId,
  );

  await writeAuditLog({
    clientId,
    userId: actorUserId,
    action: "publication_expired",
    entityType: "published_output",
    entityId: outputId,
  });

  return data;
}

export async function updateRelationshipStage(
  clientId: string,
  nextStage: RelationshipStage,
  actorUserId: string,
  actorRole: "admin" | "advisor",
): Promise<{ oldStage: RelationshipStage; newStage: RelationshipStage }> {
  const oldStage = await dbLoadClientRelationshipStage(clientId);
  if (!oldStage) {
    throw new Error("Client not found");
  }

  await dbUpdateClientRelationshipStage(clientId, nextStage);

  await writeAuditLog({
    clientId,
    userId: actorUserId,
    action: "relationship_stage_changed",
    entityType: "client",
    entityId: clientId,
    metadata: { oldStage, newStage: nextStage, actorRole },
  });

  return { oldStage, newStage: nextStage };
}

export function parsePublishedSafePayload(
  row: PublishedOutputRow,
): ClientSafeFinancialReadinessSnapshot {
  return sanitizeFinancialReadinessPayload(row.safe_payload);
}
