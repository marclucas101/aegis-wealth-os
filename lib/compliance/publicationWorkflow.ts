import "server-only";

import { emitPublishedOutputLifecycleNotification } from "@/lib/communications/lifecycleNotificationService";
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
  sanitizeClientPlanSummary,
  sanitizeFinancialReadinessPayload,
  type ClientSafeFinancialReadinessSnapshot,
} from "./clientSafeDtos";
import {
  PLANNING_OUTPUT_ERROR_CODES,
  PlanningOutputError,
} from "./planningOutputErrors";
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
  safePayloadOverride?: Record<string, unknown>;
};

export async function prepareClientSafeOutput(
  input: PrepareOutputInput,
): Promise<PublishedOutputRow> {
  let safePayload: Record<string, unknown>;

  if (input.safePayloadOverride) {
    if (
      input.outputType === "client_plan_summary" ||
      input.outputType === "goal_plan_summary" ||
      input.outputType === "roadmap_summary"
    ) {
      const validated = sanitizeClientPlanSummary(input.safePayloadOverride);
      safePayload = validated as unknown as Record<string, unknown>;
    } else {
      throw new Error(`Unsupported output type for prepare: ${input.outputType}`);
    }
  } else if (
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
    throw new PlanningOutputError(
      PLANNING_OUTPUT_ERROR_CODES.NOT_PUBLISHABLE,
      "This output can no longer be published.",
      409,
    );
  }
  if (existing.withdrawn_at) {
    throw new PlanningOutputError(
      PLANNING_OUTPUT_ERROR_CODES.NOT_PUBLISHABLE,
      "This output can no longer be published.",
      409,
    );
  }
}

function buildPublishedSafePayload(
  outputType: PublishedOutputType,
  existingPayload: Record<string, unknown>,
  now: string,
): Record<string, unknown> {
  if (
    outputType === "financial_readiness_snapshot" ||
    outputType === "financial_overview"
  ) {
    return sanitizeFinancialReadinessPayload({
      ...existingPayload,
      adviserReviewStatus: "published",
      lastReviewedDate: now,
    } as Record<string, unknown>) as unknown as Record<string, unknown>;
  }

  if (
    outputType === "client_plan_summary" ||
    outputType === "goal_plan_summary" ||
    outputType === "roadmap_summary"
  ) {
    return sanitizeClientPlanSummary({
      ...existingPayload,
      publicationStatus: "current",
    } as Record<string, unknown>) as unknown as Record<string, unknown>;
  }

  return existingPayload;
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
  } else if (
    existing.output_type === "client_plan_summary" ||
    existing.output_type === "goal_plan_summary" ||
    existing.output_type === "roadmap_summary"
  ) {
    sanitizeClientPlanSummary(existing.safe_payload);
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
    throw new PlanningOutputError(
      PLANNING_OUTPUT_ERROR_CODES.NOT_FOUND,
      "Planning output not found.",
      404,
    );
  }

  if (
    existing.publication_status === "published" &&
    isCurrentPublishedOutput(existing)
  ) {
    return existing;
  }

  if (existing.publication_status !== "adviser_reviewed") {
    throw new PlanningOutputError(
      PLANNING_OUTPUT_ERROR_CODES.NOT_PUBLISHABLE,
      "This output must be reviewed before it can be published.",
      409,
    );
  }

  assertOutputMutable(existing);

  if (options?.requireAssignment) {
    const assignedAdviser = await dbLoadClientAdvisorAssignment(clientId);
    if (assignedAdviser !== publisherUserId) {
      throw new PlanningOutputError(
        PLANNING_OUTPUT_ERROR_CODES.ACCESS_DENIED,
        "You no longer have access to prepare outputs for this client.",
        403,
      );
    }
  }

  if (
    existing.output_type === "financial_readiness_snapshot" ||
    existing.output_type === "financial_overview"
  ) {
    sanitizeFinancialReadinessPayload(existing.safe_payload);
  } else if (
    existing.output_type === "client_plan_summary" ||
    existing.output_type === "goal_plan_summary" ||
    existing.output_type === "roadmap_summary"
  ) {
    sanitizeClientPlanSummary(existing.safe_payload);
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

    await emitPublishedOutputLifecycleNotification({
      event: "superseded",
      outputId: current.id,
      clientId,
      outputAudience: current.output_audience,
      publicationStatus: "superseded",
      actorUserId: publisherUserId,
      transitionAt: now,
      successorOutputId: outputId,
    });
  }

  const mergedPayload = buildPublishedSafePayload(
    existing.output_type,
    existing.safe_payload,
    now,
  );

  const data = await dbUpdatePublishedOutput(
    outputId,
    {
      publication_status: "published",
      output_audience: "client_published",
      safe_payload: mergedPayload,
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

  await emitPublishedOutputLifecycleNotification({
    event: "withdrawn",
    outputId,
    clientId,
    outputAudience: existing.output_audience,
    publicationStatus: "withdrawn",
    actorUserId,
    transitionAt: now,
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
