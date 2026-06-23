/**
 * Pure binder helpers for QA scripts (no server-only import).
 */

import { createHash } from "node:crypto";

import { jsPDF } from "jspdf";

export const QA_BINDER_RENDERER_SCHEMA_VERSION = "phase9f3-v1";
export const QA_BINDER_MAX_PDF_BYTES = 26_214_400;

export const QA_SENSITIVE_MARKERS = [
  "SENSITIVE_NRIC_S1234567A",
  "SENSITIVE_ACCOUNT_9988776655",
  "SENSITIVE_POLICY_POL-XY-009988",
] as const;

export const QA_FORBIDDEN_PDF_MARKERS = [
  ...QA_SENSITIVE_MARKERS,
  "INTERNAL_NOTE_DO_NOT_SHARE",
  "clients/11111111-1111-4111-8111-111111111111/binders/",
  "binder-exports",
  "11111111-1111-4111-8111-111111111111",
  "<script>",
  "javascript:",
  "https://evil.example.com",
] as const;

export function qaBuildIdempotencyKey(input: {
  clientId: string;
  adviserUserId: string;
  binderLineageId: string | null;
  meetingDate: string | null;
  sectionIds: string[];
  sourcePublicationMarkers: string[];
  rendererSchemaVersion: string;
}): string {
  const canonical = {
    client_id: input.clientId,
    adviser_user_id: input.adviserUserId,
    binder_lineage_id: input.binderLineageId,
    meeting_date: input.meetingDate,
    sections: [...input.sectionIds].sort(),
    source_publications: [...input.sourcePublicationMarkers].sort(),
    renderer_schema_version: input.rendererSchemaVersion,
  };
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

export function qaSha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function qaRenderMinimalA4Pdf(lines: string[]): Buffer {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  let y = 20;
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, 178) as string[];
    pdf.text(wrapped, 16, y);
    y += wrapped.length * 6;
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
  }
  return Buffer.from(pdf.output("arraybuffer"));
}

export function qaPdfPageCount(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  return text.match(/\/Type\s*\/Page\b/g)?.length ?? 1;
}

export function qaAssertPdfA4Dimensions(buffer: Buffer): void {
  const text = buffer.toString("latin1");
  const mediaBox = text.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
  if (!mediaBox) {
    throw new Error("Missing MediaBox in PDF");
  }
  const widthPt = Number(mediaBox[1]);
  const heightPt = Number(mediaBox[2]);
  const widthMm = Math.round((widthPt / 72) * 25.4);
  const heightMm = Math.round((heightPt / 72) * 25.4);
  if (widthMm < 209 || widthMm > 211 || heightMm < 296 || heightMm > 298) {
    throw new Error(`Expected A4 dimensions, got ${widthMm}x${heightMm} mm`);
  }
}

export function qaAssertNoForbiddenMarkers(buffer: Buffer, extraForbidden: string[] = []): void {
  const searchable = buffer.toString("latin1");
  for (const marker of [...QA_FORBIDDEN_PDF_MARKERS, ...extraForbidden]) {
    if (searchable.includes(marker)) {
      throw new Error(`Forbidden marker in PDF: ${marker}`);
    }
  }
}

export function runBinderQaRuntimeChecks(): void {
  const longName = "Alexandria Montgomery-Worthington Fitzpatrick the Third";
  const pdf = qaRenderMinimalA4Pdf([
    longName,
    "A".repeat(2500),
    ...Array.from({ length: 25 }, (_, i) => `Row ${i + 1}: planning priority`),
  ]);

  if (!pdf.slice(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("Invalid PDF header");
  }
  if (pdf.length === 0) {
    throw new Error("Empty PDF buffer");
  }
  if (qaPdfPageCount(pdf) < 2) {
    throw new Error("Expected multi-page PDF");
  }
  if (qaPdfPageCount(pdf) > 50) {
    throw new Error("Page count exceeds bound");
  }

  qaAssertPdfA4Dimensions(pdf);
  qaAssertNoForbiddenMarkers(pdf);

  const hash1 = qaSha256Hex(pdf);
  if (!/^[a-f0-9]{64}$/.test(hash1)) {
    throw new Error("Invalid SHA-256 shape");
  }

  const pdfAlt = qaRenderMinimalA4Pdf([longName, "Different body content"]);
  const hash2 = qaSha256Hex(pdfAlt);
  if (hash1 === hash2) {
    throw new Error("Content change should alter hash");
  }

  if (pdf.length > QA_BINDER_MAX_PDF_BYTES) {
    throw new Error("PDF exceeds size limit");
  }

  const base = {
    clientId: "11111111-1111-4111-8111-111111111111",
    adviserUserId: "22222222-2222-4222-8222-222222222222",
    binderLineageId: "33333333-3333-4333-8333-333333333333",
    meetingDate: "2026-06-24",
    sectionIds: ["cover_page", "meeting_date"],
    sourcePublicationMarkers: ["44444444-4444-4444-8444-444444444444:v1"],
    rendererSchemaVersion: QA_BINDER_RENDERER_SCHEMA_VERSION,
  };

  const key1 = qaBuildIdempotencyKey(base);
  const key2 = qaBuildIdempotencyKey({
    ...base,
    sectionIds: ["meeting_date", "cover_page"],
  });
  if (key1 !== key2 || key1.length !== 64) {
    throw new Error("Idempotency key not stable");
  }

  const key3 = qaBuildIdempotencyKey({ ...base, meetingDate: "2026-06-25" });
  if (key3 === key1) {
    throw new Error("Meeting date should change key");
  }

  if (key1.includes("11111111") || key1.includes("binders/")) {
    throw new Error("Idempotency key must not embed PII or storage paths");
  }
}

export function runBinderPublicationQaChecks(): void {
  const schemaVersion = "phase9f3-pub-v1";
  const buildKey = (input: {
    binderExportId: string;
    binderLineageId: string;
    version: number;
    clientId: string;
    action: "publish" | "withdraw";
  }) =>
    createHash("sha256")
      .update(
        JSON.stringify({
          binder_export_id: input.binderExportId,
          binder_lineage_id: input.binderLineageId,
          version: input.version,
          client_id: input.clientId,
          action: input.action,
          publication_schema_version: schemaVersion,
        }),
        "utf8",
      )
      .digest("hex");

  const publishKey = buildKey({
    binderExportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    binderLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    version: 2,
    clientId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    action: "publish",
  });

  const publishRetry = buildKey({
    binderExportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    binderLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    version: 2,
    clientId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    action: "publish",
  });

  if (publishKey !== publishRetry || publishKey.length !== 64) {
    throw new Error("Publication idempotency key not stable");
  }

  const otherClient = buildKey({
    binderExportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    binderLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    version: 2,
    clientId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    action: "publish",
  });

  if (otherClient === publishKey) {
    throw new Error("Publication key must differ per client");
  }

  if (publishKey.includes("aaaaaaaa") || publishKey.includes("binders")) {
    throw new Error("Publication key must not expose raw IDs or paths");
  }
}
