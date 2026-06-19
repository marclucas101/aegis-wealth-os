import "server-only";

import type { ClientSafeInsightItem, GovernedContentRow } from "./types";

const CATEGORY_LABELS: Record<string, string> = {
  financial_education: "Financial education",
  market_update: "Market update",
  planning_reminder: "Planning reminder",
  company_update: "Company update",
  event: "Event",
  regulatory_update: "Regulatory update",
  adviser_message: "Adviser message",
  document_notification: "Document notification",
  appointment_update: "Appointment update",
  review_reminder: "Review reminder",
};

export function toClientSafeInsight(row: GovernedContentRow): ClientSafeInsightItem {
  const isGeneral =
    row.content_type === "general_education" ||
    row.content_type === "general_market_update";

  return {
    id: row.id,
    title: row.title,
    category: row.category,
    summary: row.summary,
    body: row.body,
    source: row.external_source_name ?? (isGeneral ? "Aurelis" : null),
    publicationDate: row.published_at ?? row.source_publication_date,
    expiryDate: row.expires_at,
    externalUrl: row.external_url,
    externalSourceName: row.external_source_name,
    adviserAttribution:
      row.content_type === "adviser_message" ? "Your adviser" : null,
    isGeneralInformation: isGeneral,
  };
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}
