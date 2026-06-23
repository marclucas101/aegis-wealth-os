import "server-only";

import { jsPDF } from "jspdf";

import {
  BINDER_PDF_LAYOUT,
  type BinderPdfCard,
  type BinderPdfChapter,
  type BinderPdfRenderModel,
  type BinderPdfTable,
} from "./binderPdfTypes";

const COLORS = {
  navy: [16, 40, 58] as [number, number, number],
  emerald: [16, 122, 94] as [number, number, number],
  gold: [209, 168, 102] as [number, number, number],
  muted: [90, 104, 116] as [number, number, number],
  border: [210, 218, 226] as [number, number, number],
};

export type BinderPdfLayoutMeta = {
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  pageCount: number;
};

type Cursor = {
  y: number;
};

function contentBottom(): number {
  return BINDER_PDF_LAYOUT.heightMm - BINDER_PDF_LAYOUT.marginMm - BINDER_PDF_LAYOUT.footerHeightMm;
}

function ensureSpace(pdf: jsPDF, cursor: Cursor, neededMm: number): void {
  if (cursor.y + neededMm <= contentBottom()) return;
  pdf.addPage();
  cursor.y = BINDER_PDF_LAYOUT.marginMm;
  drawPageFooter(pdf);
}

function drawPageFooter(pdf: jsPDF): void {
  const page = pdf.getNumberOfPages();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(
    `AEGIS Confidential — Page ${page}`,
    BINDER_PDF_LAYOUT.marginMm,
    BINDER_PDF_LAYOUT.heightMm - 8,
  );
}

function drawHeading(pdf: jsPDF, cursor: Cursor, text: string): void {
  ensureSpace(pdf, cursor, 14);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...COLORS.navy);
  pdf.text(text, BINDER_PDF_LAYOUT.marginMm, cursor.y);
  pdf.setDrawColor(...COLORS.gold);
  pdf.setLineWidth(0.4);
  pdf.line(
    BINDER_PDF_LAYOUT.marginMm,
    cursor.y + 2,
    BINDER_PDF_LAYOUT.marginMm + 24,
    cursor.y + 2,
  );
  cursor.y += 10;
}

function drawParagraphs(
  pdf: jsPDF,
  cursor: Cursor,
  paragraphs: string[],
): void {
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.navy);
  const maxWidth = BINDER_PDF_LAYOUT.contentWidthMm;

  for (const paragraph of paragraphs) {
    const lines = pdf.splitTextToSize(paragraph, maxWidth) as string[];
    const blockHeight = lines.length * 4.8 + 2;
    ensureSpace(pdf, cursor, blockHeight);
    pdf.text(lines, BINDER_PDF_LAYOUT.marginMm, cursor.y);
    cursor.y += blockHeight;
  }
}

function measureCardHeight(pdf: jsPDF, card: BinderPdfCard): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  const titleLines = pdf.splitTextToSize(card.title, BINDER_PDF_LAYOUT.contentWidthMm - 8) as string[];
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  const bodyLines = pdf.splitTextToSize(card.body, BINDER_PDF_LAYOUT.contentWidthMm - 8) as string[];
  return titleLines.length * 4.5 + bodyLines.length * 4.2 + 10;
}

function drawCard(pdf: jsPDF, cursor: Cursor, card: BinderPdfCard): void {
  const height = measureCardHeight(pdf, card);
  if (card.keepTogether !== false) {
    ensureSpace(pdf, cursor, height);
  }

  const x = BINDER_PDF_LAYOUT.marginMm;
  const width = BINDER_PDF_LAYOUT.contentWidthMm;
  pdf.setDrawColor(...COLORS.border);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(x, cursor.y - 4, width, height, 2, 2, "FD");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...COLORS.emerald);
  const titleLines = pdf.splitTextToSize(card.title, width - 8) as string[];
  pdf.text(titleLines, x + 4, cursor.y + 2);

  let textY = cursor.y + 2 + titleLines.length * 4.5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...COLORS.navy);
  const bodyLines = pdf.splitTextToSize(card.body, width - 8) as string[];
  pdf.text(bodyLines, x + 4, textY);
  textY += bodyLines.length * 4.2;

  cursor.y = Math.max(cursor.y, textY + 6);
}

function drawTable(pdf: jsPDF, cursor: Cursor, table: BinderPdfTable): void {
  const colCount = table.headings.length;
  const colWidth = BINDER_PDF_LAYOUT.contentWidthMm / colCount;
  const rowHeight = 6;

  const drawHeader = () => {
    pdf.setFillColor(...COLORS.navy);
    pdf.rect(BINDER_PDF_LAYOUT.marginMm, cursor.y - 4, BINDER_PDF_LAYOUT.contentWidthMm, rowHeight, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    table.headings.forEach((heading, index) => {
      pdf.text(
        heading,
        BINDER_PDF_LAYOUT.marginMm + index * colWidth + 2,
        cursor.y,
      );
    });
    cursor.y += rowHeight;
  };

  if (table.repeatHeadings !== false) {
    ensureSpace(pdf, cursor, rowHeight * 2);
    drawHeader();
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.navy);

  for (const row of table.rows) {
    ensureSpace(pdf, cursor, rowHeight + 1);
    if (table.repeatHeadings !== false && cursor.y <= BINDER_PDF_LAYOUT.marginMm + 1) {
      drawHeader();
    }
    row.cells.forEach((cell, index) => {
      const lines = pdf.splitTextToSize(cell, colWidth - 4) as string[];
      pdf.text(lines[0] ?? "", BINDER_PDF_LAYOUT.marginMm + index * colWidth + 2, cursor.y);
    });
    pdf.setDrawColor(...COLORS.border);
    pdf.line(
      BINDER_PDF_LAYOUT.marginMm,
      cursor.y + 2,
      BINDER_PDF_LAYOUT.marginMm + BINDER_PDF_LAYOUT.contentWidthMm,
      cursor.y + 2,
    );
    cursor.y += rowHeight;
  }
  cursor.y += 4;
}

function drawCoverPage(pdf: jsPDF, model: BinderPdfRenderModel): void {
  const cursor: Cursor = { y: 48 };
  pdf.setDrawColor(...COLORS.gold);
  pdf.setLineWidth(0.8);
  pdf.line(BINDER_PDF_LAYOUT.marginMm, 36, BINDER_PDF_LAYOUT.marginMm + 20, 36);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("AEGIS Wealth Operating System", BINDER_PDF_LAYOUT.marginMm, 32);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(...COLORS.navy);
  pdf.text("Client Meeting Pack", BINDER_PDF_LAYOUT.marginMm, cursor.y);
  cursor.y += 12;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(...COLORS.emerald);
  pdf.text(model.cover.subtitle, BINDER_PDF_LAYOUT.marginMm, cursor.y);
  cursor.y += 18;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...COLORS.navy);
  pdf.text("Prepared for", BINDER_PDF_LAYOUT.marginMm, cursor.y);
  cursor.y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.text(model.cover.clientDisplayName, BINDER_PDF_LAYOUT.marginMm, cursor.y);
  cursor.y += 14;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Adviser", BINDER_PDF_LAYOUT.marginMm, cursor.y);
  cursor.y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(12);
  pdf.text(model.cover.adviserDisplayName, BINDER_PDF_LAYOUT.marginMm, cursor.y);
  cursor.y += 14;

  if (model.cover.meetingDateLabel) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("Meeting date", BINDER_PDF_LAYOUT.marginMm, cursor.y);
    cursor.y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.text(model.cover.meetingDateLabel, BINDER_PDF_LAYOUT.marginMm, cursor.y);
    cursor.y += 14;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text("Generated", BINDER_PDF_LAYOUT.marginMm, cursor.y);
  cursor.y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.text(model.cover.generatedDateLabel, BINDER_PDF_LAYOUT.marginMm, cursor.y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(
    model.confidentialityFooter,
    BINDER_PDF_LAYOUT.marginMm,
    BINDER_PDF_LAYOUT.heightMm - 16,
  );
  drawPageFooter(pdf);
}

function drawChapter(pdf: jsPDF, cursor: Cursor, chapter: BinderPdfChapter): void {
  if (chapter.keepTogether) {
    const roughHeight =
      12 +
      chapter.paragraphs.length * 6 +
      (chapter.cards?.reduce((sum, card) => sum + measureCardHeight(pdf, card) + 4, 0) ?? 0) +
      (chapter.table ? Math.min(chapter.table.rows.length, 6) * 6 + 10 : 0);
    ensureSpace(pdf, cursor, Math.min(roughHeight, contentBottom() - BINDER_PDF_LAYOUT.marginMm));
  }

  drawHeading(pdf, cursor, chapter.title);
  drawParagraphs(pdf, cursor, chapter.paragraphs);
  chapter.cards?.forEach((card) => drawCard(pdf, cursor, card));
  if (chapter.table) {
    drawTable(pdf, cursor, chapter.table);
  }
  cursor.y += 6;
}

export function renderBinderPdf(model: BinderPdfRenderModel): Buffer {
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "portrait",
    compress: true,
  });

  drawCoverPage(pdf, model);

  pdf.addPage();
  const cursor: Cursor = { y: BINDER_PDF_LAYOUT.marginMm };
  drawPageFooter(pdf);

  drawHeading(pdf, cursor, "Executive overview");
  drawParagraphs(pdf, cursor, [
    `This meeting pack for ${model.cover.clientDisplayName} consolidates approved client-safe planning outputs.`,
    "Sections reflect published adviser-reviewed material only.",
  ]);
  cursor.y += 4;

  for (const chapter of model.chapters) {
    drawChapter(pdf, cursor, chapter);
  }

  const bytes = Buffer.from(pdf.output("arraybuffer"));
  return bytes;
}

export function getBinderPdfLayoutMeta(buffer: Buffer): BinderPdfLayoutMeta {
  const text = buffer.toString("latin1");
  const pageMatches = text.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches?.length ?? 1;
  return {
    pageWidthMm: BINDER_PDF_LAYOUT.widthMm,
    pageHeightMm: BINDER_PDF_LAYOUT.heightMm,
    marginMm: BINDER_PDF_LAYOUT.marginMm,
    pageCount,
  };
}

/** Rough extraction of printable ASCII from PDF streams for redaction QA. */
export function extractPdfSearchableText(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const chunks = latin.match(/\(([^\\)]+)\)/g) ?? [];
  return chunks.map((chunk) => chunk.slice(1, -1)).join("\n");
}

export function assertPdfWithinA4Bounds(meta: BinderPdfLayoutMeta): void {
  if (meta.pageWidthMm !== 210 || meta.pageHeightMm !== 297) {
    throw new Error("PDF is not A4 portrait");
  }
  if (meta.marginMm < 15 || meta.marginMm > 18) {
    throw new Error("PDF margins outside expected range");
  }
}
