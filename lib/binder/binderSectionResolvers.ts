import "server-only";

import { sanitizeFinancialReadinessPayload } from "@/lib/compliance/clientSafeDtos";
import { canClientViewDocument } from "@/lib/compliance/documentVisibility";
import { loadAdviserUserAndProfile } from "@/lib/supabase/adviserProfilePersistence";
import type { AppClientRow } from "@/lib/supabase/userProfile";
import type { BinderSection } from "@/lib/binder/binderSectionPolicy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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
import {
  assessRequestedSections,
  type SectionAvailability,
} from "./binderSectionCatalog";
import { loadBinderSectionContext } from "./binderReadinessService";
import {
  assertSectionsResolvableForGeneration as assertSectionsResolvablePure,
  BINDER_SOURCE_UNAVAILABLE_CODE,
} from "./binderSectionPolicy";

function assertSectionsResolvableForGeneration(
  sections: SectionAvailability[],
  meetingDate: string | null,
): SectionAvailability[] {
  try {
    return assertSectionsResolvablePure(sections, meetingDate) as SectionAvailability[];
  } catch (err) {
    if (err instanceof Error && err.message === BINDER_SOURCE_UNAVAILABLE_CODE) {
      throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
    }
    throw err;
  }
}

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

function resolveSectionChapter(
  entry: SectionAvailability,
  input: {
    client: AppClientRow;
    adviserName: string;
    organisation: string | null;
    meetingDateLabel: string | null;
    generatedDateLabel: string;
  },
): BinderResolvedSection {
  const { sectionId, selectedPublication } = entry;

  switch (sectionId) {
    case "cover_page":
      return {
        sectionId,
        chapter: buildRedactedChapter({
          id: sectionId,
          title: "Cover",
          paragraphs: [
            `Prepared for ${input.client.display_name}.`,
            input.meetingDateLabel
              ? `Meeting date: ${input.meetingDateLabel}.`
              : "Meeting date to be confirmed.",
          ],
          keepTogether: true,
        }),
      };
    case "client_adviser_info": {
      const cards = [
        buildRedactedCard("Client", input.client.display_name),
        buildRedactedCard(
          "Adviser",
          input.organisation ? `${input.adviserName} — ${input.organisation}` : input.adviserName,
        ),
      ];
      return {
        sectionId,
        chapter: buildRedactedChapter({
          id: sectionId,
          title: "Client and adviser information",
          paragraphs: ["Key contacts for this meeting pack."],
          cards,
          keepTogether: true,
        }),
      };
    }
    case "meeting_date":
      return {
        sectionId,
        chapter: buildRedactedChapter({
          id: sectionId,
          title: "Meeting date",
          paragraphs: [`Scheduled meeting date: ${input.meetingDateLabel}.`],
          keepTogether: true,
        }),
      };
    case "next_review_date": {
      const reviewLabel = formatDisplayDate(input.client.next_review_due);
      return {
        sectionId,
        chapter: buildRedactedChapter({
          id: sectionId,
          title: "Next review",
          paragraphs: [`Next recommended review date: ${reviewLabel}.`],
          keepTogether: true,
        }),
      };
    }
    case "financial_overview":
    case "my_plan":
    case "agreed_priorities":
    case "roadmap":
    case "meeting_summary": {
      if (!selectedPublication) {
        throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
      }
      const payload = redactPublishedPayload(selectedPublication);

      if (
        sectionId === "financial_overview" &&
        (selectedPublication.output_type === "financial_readiness_snapshot" ||
          selectedPublication.output_type === "financial_overview")
      ) {
        const snapshot = sanitizeFinancialReadinessPayload(payload);
        const cards = [
          buildRedactedCard("Readiness overview", snapshot.educationalExplanation),
          buildRedactedCard(
            "Information completeness",
            `${snapshot.informationCompletenessPercent}% of expected planning information is available.`,
          ),
        ];
        return {
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
        };
      }

      const titleMap: Record<string, string> = {
        my_plan: "Current planning position",
        agreed_priorities: "Agreed priorities",
        roadmap: "Wealth roadmap",
        meeting_summary: "Meeting summary",
      };
      return {
        sectionId,
        chapter: buildRedactedChapter({
          id: sectionId,
          title: titleMap[sectionId] ?? sectionId,
          paragraphs: payloadToParagraphs(payload),
        }),
      };
    }
    default:
      throw new BinderServiceError(BINDER_ERROR_CODES.SOURCE_UNAVAILABLE);
  }
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
  const context = await loadBinderSectionContext(input);
  const assessed = assessRequestedSections(input.sections, context);
  const included = assertSectionsResolvableForGeneration(assessed, input.meetingDate);

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
    clientDisplayName: context.client.display_name,
    adviserDisplayName: adviserName,
    meetingDateLabel,
    generatedDateLabel,
    subtitle: "Client meeting pack — planning review summary",
  };

  const resolved: BinderResolvedSection[] = [];
  const sourceRefs: BinderSourcePublicationRef[] = [];

  for (const entry of included) {
    if (entry.sectionId === "document_index") {
      resolved.push(await loadDocumentIndex(context.client));
      continue;
    }

    const section = resolveSectionChapter(entry, {
      client: context.client,
      adviserName,
      organisation,
      meetingDateLabel,
      generatedDateLabel,
    });
    resolved.push(section);

    if (entry.selectedPublication) {
      sourceRefs.push(publicationRef(entry.selectedPublication));
    }
  }

  const chapters = resolved.map((item) => item.chapter);
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
