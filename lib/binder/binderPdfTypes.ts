import "server-only";

import type { BinderSection } from "@/lib/communications/binderExport";

export const BINDER_RENDERER_SCHEMA_VERSION = "phase9f3-v1" as const;

export const BINDER_PDF_LAYOUT = {
  widthMm: 210,
  heightMm: 297,
  marginMm: 16,
  contentWidthMm: 210 - 16 * 2,
  footerHeightMm: 12,
} as const;

export const BINDER_MAX_SECTION_COUNT = 10;
export const BINDER_MAX_LIST_RESULTS = 50;
export const BINDER_MAX_TEXT_LENGTH = 4000;
export const BINDER_MAX_TABLE_ROWS = 40;
export const BINDER_MAX_DOCUMENT_INDEX_ROWS = 30;

export type BinderGenerationStatus =
  | "legacy_manifest"
  | "pending"
  | "generating"
  | "ready"
  | "failed";

export type BinderPdfCard = {
  title: string;
  body: string;
  keepTogether?: boolean;
};

export type BinderPdfTableRow = {
  cells: string[];
};

export type BinderPdfTable = {
  headings: string[];
  rows: BinderPdfTableRow[];
  repeatHeadings?: boolean;
};

export type BinderPdfChapter = {
  id: BinderSection | "report_notes";
  title: string;
  paragraphs: string[];
  cards?: BinderPdfCard[];
  table?: BinderPdfTable;
  keepTogether?: boolean;
};

export type BinderPdfCover = {
  clientDisplayName: string;
  adviserDisplayName: string;
  meetingDateLabel: string | null;
  generatedDateLabel: string;
  subtitle: string;
};

export type BinderPdfRenderModel = {
  schemaVersion: typeof BINDER_RENDERER_SCHEMA_VERSION;
  cover: BinderPdfCover;
  chapters: BinderPdfChapter[];
  confidentialityFooter: string;
};

export type BinderSourcePublicationRef = {
  id: string;
  outputType: string;
  updatedAt: string;
  sourceInputVersion: string | null;
  algorithmVersion: string | null;
};

export type BinderResolvedSection = {
  sectionId: BinderSection;
  chapter: BinderPdfChapter;
};

export type BinderGenerationInput = {
  clientId: string;
  adviserUserId: string;
  userRole: "advisor" | "admin";
  meetingDate: string | null;
  sections: BinderSection[];
  binderLineageId?: string | null;
};

export type BinderPublicMetadata = {
  id: string;
  binderLineageId: string;
  version: number;
  generationStatus: BinderGenerationStatus;
  lifecycleStatus: string;
  sectionsIncluded: string[];
  meetingDate: string | null;
  createdAt: string;
  generationCompletedAt: string | null;
  reused: boolean;
};
