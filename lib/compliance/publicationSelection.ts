import "server-only";

import type { PublishedOutputRow } from "@/lib/supabase/compliancePublication";

import { isCurrentPublishedOutput } from "./publicationWorkflow";
import type { PublishedOutputType } from "./types";

/**
 * Selects at most one current published output.
 * When multiple current rows exist (legacy/malformed data), returns the most
 * recently published — never an arbitrary first match.
 */
export function selectSingleCurrentPublishedOutput(
  rows: PublishedOutputRow[],
): PublishedOutputRow | null {
  const current = rows.filter(isCurrentPublishedOutput);
  if (current.length === 0) {
    return null;
  }

  current.sort((a, b) => {
    const aTime = a.published_at ?? a.created_at ?? "";
    const bTime = b.published_at ?? b.created_at ?? "";
    return bTime.localeCompare(aTime);
  });

  return current[0] ?? null;
}

export function filterPublicationsForOutputTypes(
  rows: PublishedOutputRow[],
  allowedTypes: PublishedOutputType[],
): PublishedOutputRow[] {
  const byType = new Map<PublishedOutputType, PublishedOutputRow>();

  for (const type of allowedTypes) {
    const typeRows = rows.filter((r) => r.output_type === type);
    const selected = selectSingleCurrentPublishedOutput(typeRows);
    if (selected) {
      byType.set(type, selected);
    }
  }

  return Array.from(byType.values()).sort((a, b) => {
    const aTime = a.published_at ?? a.created_at ?? "";
    const bTime = b.published_at ?? b.created_at ?? "";
    return bTime.localeCompare(aTime);
  });
}
