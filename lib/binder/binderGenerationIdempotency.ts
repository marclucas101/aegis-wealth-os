import "server-only";

import { createHash } from "node:crypto";

import type { BinderSourcePublicationRef } from "./binderPdfTypes";

export type BinderIdempotencyInput = {
  clientId: string;
  adviserUserId: string;
  binderLineageId: string | null;
  meetingDate: string | null;
  sectionIds: string[];
  sourcePublications: BinderSourcePublicationRef[];
  rendererSchemaVersion: string;
};

function normalizeMeetingDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function publicationMarker(pub: BinderSourcePublicationRef): string {
  const version = pub.sourceInputVersion ?? pub.algorithmVersion ?? pub.updatedAt;
  return `${pub.id}:${version}`;
}

/**
 * Canonical generation tuple → SHA-256 hex (64 chars).
 * Contains no names, emails, titles, financial values or routes.
 */
export function buildBinderGenerationIdempotencyKey(
  input: BinderIdempotencyInput,
): string {
  const canonical = {
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    binder_lineage_id: input.binderLineageId,
    meeting_date: normalizeMeetingDate(input.meetingDate),
    sections: [...input.sectionIds]
      .map((sectionId) => sectionId.trim())
      .filter(Boolean)
      .sort(),
    source_publications: [...input.sourcePublications]
      .map(publicationMarker)
      .sort(),
    renderer_schema_version: input.rendererSchemaVersion,
  };

  const serialized = JSON.stringify(canonical);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
