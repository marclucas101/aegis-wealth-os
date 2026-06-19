import "server-only";

import { isFeatureEnabled } from "@/lib/compliance/featureFlags";
import { isCurrentPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import { writeAuditLog } from "@/lib/supabase/auditLog";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { dbCreateBinderExport } from "@/lib/supabase/binderExportPersistence";
import { dbListPublishedOutputsForClient } from "@/lib/supabase/compliancePublication";
import type { BinderExportRow } from "./types";

export const BINDER_SECTIONS = [
  "cover_page",
  "client_adviser_info",
  "meeting_date",
  "financial_overview",
  "my_plan",
  "agreed_priorities",
  "roadmap",
  "meeting_summary",
  "document_index",
  "next_review_date",
] as const;

export type BinderSection = (typeof BINDER_SECTIONS)[number];

export async function generateBinderExport(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingDate?: string | null;
  sections: BinderSection[];
}): Promise<BinderExportRow> {
  const enabled = await isFeatureEnabled("binder_export");
  if (!enabled) {
    throw new Error("Binder export is disabled");
  }

  const access = await resolveAccessibleClient(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );

  if (access.status !== "ok") {
    throw new Error(
      access.status === "forbidden"
        ? "Client is not assigned to you"
        : "Client not found",
    );
  }

  const publications = await dbListPublishedOutputsForClient(input.clientId);
  const approvedIds = publications
    .filter((p) => isCurrentPublishedOutput(p))
    .map((p) => p.id);

  const validSections = input.sections.filter((s) =>
    BINDER_SECTIONS.includes(s),
  );

  if (validSections.length === 0) {
    throw new Error("At least one section must be selected");
  }

  const binder = await dbCreateBinderExport({
    clientId: input.clientId,
    adviserUserId: input.adviserUserId,
    meetingDate: input.meetingDate ?? null,
    sectionsIncluded: validSections,
    sourcePublicationIds: approvedIds,
    documentIds: [],
    storagePath: `binders/${input.clientId}/${Date.now()}.pdf`,
  });

  await writeAuditLog({
    clientId: input.clientId,
    userId: input.adviserUserId,
    action: "binder_generated",
    entityType: "binder_export",
    entityId: binder.id,
    metadata: {
      sections: validSections,
      publicationCount: approvedIds.length,
    },
  });

  return binder;
}
