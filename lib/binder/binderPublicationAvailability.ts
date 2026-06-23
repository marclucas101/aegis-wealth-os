import type { PublishedOutputType } from "@/lib/compliance/types";
import type { PublishedOutputRow } from "@/lib/supabase/compliancePublication";

/**
 * Pure publication availability helpers shared by binder readiness and generation.
 * Mirrors lib/compliance/publicationWorkflow + publicationSelection without server-only imports.
 */

export function isCurrentClientPublishedOutput(row: PublishedOutputRow): boolean {
  if (row.publication_status !== "published") return false;
  if (row.withdrawn_at || row.superseded_at) return false;
  if (row.expires_at && new Date(row.expires_at) <= new Date()) return false;
  if (row.output_audience !== "client_published") return false;
  return true;
}

export function selectCurrentClientPublishedOutput(
  rows: PublishedOutputRow[],
): PublishedOutputRow | null {
  const current = rows.filter(isCurrentClientPublishedOutput);
  if (current.length === 0) return null;

  current.sort((a, b) => {
    const aTime = a.published_at ?? a.created_at ?? "";
    const bTime = b.published_at ?? b.created_at ?? "";
    return bTime.localeCompare(aTime);
  });

  return current[0] ?? null;
}

export type PublicationAvailabilityReason =
  | "NO_PUBLISHED_SOURCE"
  | "SOURCE_NOT_CURRENT"
  | "SOURCE_NOT_CLIENT_VISIBLE";

export function classifyClientPublicationAvailability(
  allPublications: PublishedOutputRow[],
  allowedTypes: PublishedOutputType[],
): {
  available: PublishedOutputRow | null;
  reasonCode: PublicationAvailabilityReason | null;
} {
  const candidates = allPublications.filter((row) => allowedTypes.includes(row.output_type));

  if (candidates.length === 0) {
    return { available: null, reasonCode: "NO_PUBLISHED_SOURCE" };
  }

  const current = selectCurrentClientPublishedOutput(candidates);
  if (current) {
    return { available: current, reasonCode: null };
  }

  const hasClientPublishedAudience = candidates.some(
    (row) => row.output_audience === "client_published",
  );
  if (!hasClientPublishedAudience) {
    return { available: null, reasonCode: "SOURCE_NOT_CLIENT_VISIBLE" };
  }

  return { available: null, reasonCode: "SOURCE_NOT_CURRENT" };
}
