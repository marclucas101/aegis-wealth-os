import "server-only";

import type { BinderSection } from "@/lib/communications/binderExport";
import { sanitizeFinancialReadinessPayload } from "@/lib/compliance/clientSafeDtos";
import { isCurrentPublishedOutput } from "@/lib/compliance/publicationWorkflow";
import { selectSingleCurrentPublishedOutput } from "@/lib/compliance/publicationSelection";
import type { PublishedOutputType } from "@/lib/compliance/types";
import { canClientViewDocument } from "@/lib/compliance/documentVisibility";
import { resolveAccessibleClient } from "@/lib/supabase/advisorClientAccess";
import { dbListPublishedOutputsForClient } from "@/lib/supabase/compliancePublication";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { loadAdviserUserAndProfile } from "@/lib/supabase/adviserProfilePersistence";
import type { AppClientRow } from "@/lib/supabase/userProfile";

import { BINDER_ERROR_CODES, BinderServiceError } from "./binderErrors";
import {
  buildRedactedCard,
  buildRedactedChapter,
  buildRedactedRenderModel,
  buildRedactedTable,
  redactPublishedPayload,
} from "./binderPdfRedaction";
import {
  BINDER_MAX_DOCUMENT_INDEX_ROWS,
  BINDER_RENDERER_SCHEMA_VERSION,
  type BinderPdfCover,
  type BinderPdfRenderModel,
  type BinderResolvedSection,
  type BinderSourcePublicationRef,
} from "./binderPdfTypes";

const SECTION_OUTPUT_TYPES: Partial<Record<BinderSection, PublishedOutputType[]>> = {
  financial_overview: ["financial_overview", "financial_readiness_snapshot"],
  my_plan: ["client_plan_summary", "goal_plan_summary", "wealth_blueprint_summary"],
  agreed_priorities: ["goal_plan_summary", "client_plan_summary"],
  roadmap: ["roadmap_summary"],
  meeting_summary: ["meeting_summary", "annual_review_summary"],
};

function formatDisplayDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function payloadToParagraphs(payload: Record<string, unknown>): string[] {
  const paragraphs: string[] = [];
  const summary =
    typeof payload.summary === "string"
      ? payload.summary
      : typeof payload.headline === "string"
        ? payload.headline
        : typeof payload.description === "string"
          ? payload.description
          : null;
  if (summary) paragraphs.push(summary);

  const highlights = payload.highlights ?? payload.priorities ?? payload.items;
  if (Array.isArray(highlights)) {
    for (const item of highlights) {
      if (typeof item === "string") paragraphs.push(`• ${item}`);
      if (typeof item === "object" && item && "title" in item) {
        const title = (item as { title?: unknown }).title;
        if (typeof title === "string") paragraphs.push(`• ${title}`);
      }
    }
  }
  return paragraphs;
}

function publicationRef(row: {
  id: string;
  output_type: string;
  updated_at: string;
  source_input_version: string | null;
  algorithm_version: string | null;
}): BinderSourcePublicationRef {
  return {
    id: row.id,
    outputType: row.output_type,
    updatedAt: row.updated_at,
    sourceInputVersion: row.source_input_version,
    algorithmVersion: row.algorithm_version,
  };
}

async function loadDocumentIndex(client: AppClientRow): Promise<BinderResolvedSection> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select("id, title, category, tags, is_archived, uploaded_by_user_id")
    .eq("client_id", client.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(BINDER_MAX_DOCUMENT_INDEX_ROWS);

  if (error) {
    throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
  }

  const rows: string[][] = [];
  for (const row of data ?? []) {
    const doc = row as {
      title: string;
      category: string;
      tags: string[] | null;
      is_archived: boolean;
      uploaded_by_user_id: string | null;
    };
    if (
      !canClientViewDocument({
        client,
        clientUserId: client.user_id ?? "",
        document: doc,
      })
    ) {
      continue;
    }
    rows.push([doc.title, doc.category.replace(/_/g, " ")]);
  }

  return {
    sectionId: "document_index",
    chapter: buildRedactedChapter({
      id: "document_index",
      title: "Document index",
      paragraphs: rows.length
        ? ["Published and client-visible documents included in this meeting pack."]
        : ["No client-visible documents are currently indexed."],
      table: rows.length
        ? buildRedactedTable(["Document", "Category"], rows)
        : undefined,
    }),
  };
}

export type ResolveBinderSectionsResult = {
  sections: BinderResolvedSection[];
  sourcePublications: BinderSourcePublicationRef[];
  renderModel: BinderPdfRenderModel;
};

export async function resolveBinderSections(input: {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingDate: string | null;
  sections: BinderSection[];
}): Promise<ResolveBinderSectionsResult> {
  const access = await resolveAccessibleClient(
    input.adviserUserId,
    input.userRole,
    input.clientId,
  );
  if (access.status !== "ok") {
    throw new BinderServiceError(BINDER_ERROR_CODES.ACCESS_DENIED);
  }

  const client = access.client;
  const publications = await dbListPublishedOutputsForClient(input.clientId);
  const currentPublications = publications.filter(isCurrentPublishedOutput);

  const { user: adviserUser, profile: adviserProfile } =
    await loadAdviserUserAndProfile(input.adviserUserId);

  const adviserName =
    adviserUser?.full_name?.trim() ||
    adviserProfile?.professional_title?.trim() ||
    "Assigned adviser";
  const organisation = adviserUser?.organisation?.trim() ?? null;

  const generatedDateLabel = formatDisplayDate(new Date().toISOString()) ?? "";
  const meetingDateLabel = formatDisplayDate(input.meetingDate);

  const cover: BinderPdfCover = {
    clientDisplayName: client.display_name,
    adviserDisplayName: adviserName,
    meetingDateLabel,
    generatedDateLabel,
    subtitle: "Client meeting pack — planning review summary",
  };

  const resolved: BinderResolvedSection[] = [];
  const sourceRefs: BinderSourcePublicationRef[] = [];

  for (const sectionId of input.sections) {
    switch (sectionId) {
      case "cover_page": {
        resolved.push({
          sectionId,
          chapter: buildRedactedChapter({
            id: sectionId,
            title: "Cover",
            paragraphs: [
              `Prepared for ${client.display_name}.`,
              meetingDateLabel
                ? `Meeting date: ${meetingDateLabel}.`
                : "Meeting date to be confirmed.",
            ],
            keepTogether: true,
          }),
        });
        break;
      }
      case "client_adviser_info": {
        const cards = [
          buildRedactedCard("Client", client.display_name),
          buildRedactedCard(
            "Adviser",
            organisation ? `${adviserName} — ${organisation}` : adviserName,
          ),
        ];
        resolved.push({
          sectionId,
          chapter: buildRedactedChapter({
            id: sectionId,
            title: "Client and adviser information",
            paragraphs: ["Key contacts for this meeting pack."],
            cards,
            keepTogether: true,
          }),
        });
        break;
      }
      case "meeting_date": {
        if (!meetingDateLabel) {
          throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
        }
        resolved.push({
          sectionId,
          chapter: buildRedactedChapter({
            id: sectionId,
            title: "Meeting date",
            paragraphs: [`Scheduled meeting date: ${meetingDateLabel}.`],
            keepTogether: true,
          }),
        });
        break;
      }
      case "next_review_date": {
        const reviewLabel = formatDisplayDate(client.next_review_due);
        if (!reviewLabel) {
          throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
        }
        resolved.push({
          sectionId,
          chapter: buildRedactedChapter({
            id: sectionId,
            title: "Next review",
            paragraphs: [`Next recommended review date: ${reviewLabel}.`],
            keepTogether: true,
          }),
        });
        break;
      }
      case "document_index": {
        resolved.push(await loadDocumentIndex(client));
        break;
      }
      case "financial_overview":
      case "my_plan":
      case "agreed_priorities":
      case "roadmap":
      case "meeting_summary": {
        const types = SECTION_OUTPUT_TYPES[sectionId] ?? [];
        const candidates = currentPublications.filter((p) =>
          types.includes(p.output_type),
        );
        const selected = selectSingleCurrentPublishedOutput(candidates);
        if (!selected) {
          throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
        }
        const payload = redactPublishedPayload(selected);
        sourceRefs.push(publicationRef(selected));

        if (
          sectionId === "financial_overview" &&
          (selected.output_type === "financial_readiness_snapshot" ||
            selected.output_type === "financial_overview")
        ) {
          const snapshot = sanitizeFinancialReadinessPayload(payload);
          const cards = [
            buildRedactedCard(
              "Readiness overview",
              snapshot.educationalExplanation,
            ),
            buildRedactedCard(
              "Information completeness",
              `${snapshot.informationCompletenessPercent}% of expected planning information is available.`,
            ),
          ];
          resolved.push({
            sectionId,
            chapter: buildRedactedChapter({
              id: sectionId,
              title: "Financial overview",
              paragraphs: [
                `Planning readiness band: ${snapshot.readinessBand.replace(/_/g, " ")}.`,
                `Data as at ${snapshot.dataAsAt}.`,
              ],
              cards,
            }),
          });
        } else {
          const titleMap: Record<string, string> = {
            my_plan: "Current planning position",
            agreed_priorities: "Agreed priorities",
            roadmap: "Roadmap",
            meeting_summary: "Meeting summary",
          };
          resolved.push({
            sectionId,
            chapter: buildRedactedChapter({
              id: sectionId,
              title: titleMap[sectionId] ?? sectionId,
              paragraphs: payloadToParagraphs(payload),
            }),
          });
        }
        break;
      }
      default:
        throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
    }
  }

  const chapters = resolved.map((entry) => entry.chapter);
  chapters.push(
    buildRedactedChapter({
      id: "report_notes",
      title: "Report notes",
      paragraphs: [
        "This meeting pack summarises client-safe published outputs only.",
        "It does not constitute personal advice, a product recommendation, or an offer.",
        "Figures and summaries are for planning discussion with a qualified adviser.",
      ],
    }),
  );

  const renderModel = buildRedactedRenderModel({
    schemaVersion: BINDER_RENDERER_SCHEMA_VERSION,
    cover,
    chapters,
    confidentialityFooter:
      "Confidential — for adviser-client planning review. Not for redistribution.",
  });

  const uniqueSources = new Map<string, BinderSourcePublicationRef>();
  for (const ref of sourceRefs) {
    uniqueSources.set(ref.id, ref);
  }

  return {
    sections: resolved,
    sourcePublications: Array.from(uniqueSources.values()),
    renderModel,
  };
}
