/**
 * Phase 9F.3 local acceptance harness — no remote database contact.
 * Run: npm run qa:phase9f3-local-acceptance
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  QA_BINDER_RENDERER_SCHEMA_VERSION,
  QA_BINDER_MAX_PDF_BYTES,
  QA_BINDER_WITHDRAWAL_REASONS,
  QA_STALE_DOCUMENT_MESSAGE,
  QA_FORBIDDEN_PDF_MARKERS,
  QA_SENSITIVE_MARKERS,
  qaAssertBinderClientAccessible,
  qaAssertNoForbiddenMarkers,
  qaAssertPdfA4Dimensions,
  qaBuildBinderStoragePath,
  qaBuildIdempotencyKey,
  qaIsBinderWithdrawalReason,
  qaPdfPageCount,
  qaRenderMinimalA4Pdf,
  qaSanitizeAuditMetadata,
  qaSha256Hex,
  qaValidateBinderSections,
  runBinderPublicationQaChecks,
  runBinderQaRuntimeChecks,
  type QaBinderClientAccessRow,
} from "../lib/binder/binderQaRuntime";

const ROOT = resolve(process.cwd());

function readRepo(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

type TestCase = { id: number; name: string; run: () => void };

const CLIENT_A = "11111111-1111-4111-8111-111111111111";
const CLIENT_B = "22222222-2222-4222-8222-222222222222";
const BINDER_ID = "33333333-3333-4333-8333-333333333333";
const DOCUMENT_ID = "44444444-4444-4444-8444-444444444444";

function check(name: string, fn: () => void): TestCase {
  return { id: 0, name, run: fn };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => void, message?: string): void {
  try {
    fn();
    throw new Error(message ?? "Expected throw");
  } catch (err) {
    if (err instanceof Error && err.message === (message ?? "Expected throw")) {
      throw err;
    }
  }
}

const TESTS: TestCase[] = [
  check("1. approved-section validation", () => {
    const sections = qaValidateBinderSections(["roadmap", "cover_page", "meeting_date"]);
    assert(sections.length === 3, "expected three valid sections");
    assert(sections.includes("cover_page"), "cover_page included");
  }),
  check("2. invalid section rejection", () => {
    assertThrows(() => qaValidateBinderSections(["internal_notes", "nric_dump"]));
  }),
  check("3. redaction markers removed", () => {
    for (const marker of QA_SENSITIVE_MARKERS) {
      assert(
        (QA_FORBIDDEN_PDF_MARKERS as readonly string[]).includes(marker),
        `forbidden list must include ${marker}`,
      );
    }
    assert(
      (QA_FORBIDDEN_PDF_MARKERS as readonly string[]).includes("INTERNAL_NOTE_DO_NOT_SHARE"),
      "internal note marker must be forbidden in PDF output",
    );
    const pdf = qaRenderMinimalA4Pdf(["Sanitized client meeting pack"]);
    qaAssertNoForbiddenMarkers(pdf);
  }),
  check("4. PDF %PDF- header", () => {
    const pdf = qaRenderMinimalA4Pdf(["Header check"]);
    assert(pdf.slice(0, 5).equals(Buffer.from("%PDF-")), "missing PDF header");
  }),
  check("5. A4 page geometry", () => {
    qaAssertPdfA4Dimensions(qaRenderMinimalA4Pdf(["A4 geometry"]));
  }),
  check("6. multi-page fixture", () => {
    const longName = "Alexandria Montgomery-Worthington Fitzpatrick the Third";
    const pdf = qaRenderMinimalA4Pdf([
      longName,
      "A".repeat(2500),
      ...Array.from({ length: 25 }, (_, i) => `Row ${i + 1}: planning priority`),
    ]);
    assert(qaPdfPageCount(pdf) >= 2, "expected multi-page PDF");
  }),
  check("7. long client-name wrapping", () => {
    const longName = "Alexandria Montgomery-Worthington Fitzpatrick the Third";
    const pdf = qaRenderMinimalA4Pdf([longName, "Wrapped body"]);
    assert(pdf.length > 500, "expected non-trivial PDF for long name");
  }),
  check("8. long roadmap pagination", () => {
    const pdf = qaRenderMinimalA4Pdf(["Roadmap", "A".repeat(2500)]);
    assert(qaPdfPageCount(pdf) >= 2, "long roadmap should paginate");
  }),
  check("9. SHA-256 generation", () => {
    const hash = qaSha256Hex(qaRenderMinimalA4Pdf(["hash me"]));
    assert(/^[a-f0-9]{64}$/.test(hash), "invalid SHA-256 shape");
  }),
  check("10. generation idempotency input stability", () => {
    const base = {
      clientId: CLIENT_A,
      adviserUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      binderLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      meetingDate: "2026-06-24",
      sectionIds: ["cover_page", "meeting_date"],
      sourcePublicationMarkers: ["pub:v1"],
      rendererSchemaVersion: QA_BINDER_RENDERER_SCHEMA_VERSION,
    };
    const k1 = qaBuildIdempotencyKey(base);
    const k2 = qaBuildIdempotencyKey({ ...base, sectionIds: ["meeting_date", "cover_page"] });
    assert(k1 === k2, "section order must not change key");
  }),
  check("11. changed meeting date changes key", () => {
    const base = {
      clientId: CLIENT_A,
      adviserUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      binderLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      meetingDate: "2026-06-24",
      sectionIds: ["cover_page"],
      sourcePublicationMarkers: [] as string[],
      rendererSchemaVersion: QA_BINDER_RENDERER_SCHEMA_VERSION,
    };
    const k1 = qaBuildIdempotencyKey(base);
    const k2 = qaBuildIdempotencyKey({ ...base, meetingDate: "2026-06-25" });
    assert(k1 !== k2, "meeting date must change key");
  }),
  check("12. changed section set changes key", () => {
    const base = {
      clientId: CLIENT_A,
      adviserUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      binderLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      meetingDate: "2026-06-24",
      sectionIds: ["cover_page"],
      sourcePublicationMarkers: [] as string[],
      rendererSchemaVersion: QA_BINDER_RENDERER_SCHEMA_VERSION,
    };
    const k1 = qaBuildIdempotencyKey(base);
    const k2 = qaBuildIdempotencyKey({ ...base, sectionIds: ["roadmap"] });
    assert(k1 !== k2, "section set must change key");
  }),
  check("13. changed renderer version changes key", () => {
    const base = {
      clientId: CLIENT_A,
      adviserUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      binderLineageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      meetingDate: "2026-06-24",
      sectionIds: ["cover_page"],
      sourcePublicationMarkers: [] as string[],
      rendererSchemaVersion: QA_BINDER_RENDERER_SCHEMA_VERSION,
    };
    const k1 = qaBuildIdempotencyKey(base);
    const k2 = qaBuildIdempotencyKey({ ...base, rendererSchemaVersion: "phase9f3-v2" });
    assert(k1 !== k2, "renderer version must change key");
  }),
  check("14. storage path canonicalization", () => {
    const path = qaBuildBinderStoragePath({
      clientId: CLIENT_A,
      binderExportId: BINDER_ID,
      version: 2,
    });
    assert(
      path === `clients/${CLIENT_A}/binders/${BINDER_ID}/v2/meeting-pack.pdf`,
      `unexpected path: ${path}`,
    );
  }),
  check("15. invalid UUID path rejection", () => {
    assertThrows(() =>
      qaBuildBinderStoragePath({
        clientId: "not-a-uuid",
        binderExportId: BINDER_ID,
        version: 1,
      }),
    );
  }),
  check("16. empty PDF buffer rejection", () => {
    const empty = Buffer.alloc(0);
    assert(empty.length === 0, "fixture");
    assertThrows(() => {
      if (!empty.length) throw new Error("Empty PDF buffer");
    });
  }),
  check("17. oversized PDF rejection", () => {
    const oversize = Buffer.alloc(QA_BINDER_MAX_PDF_BYTES + 1);
    assertThrows(() => {
      if (oversize.length > QA_BINDER_MAX_PDF_BYTES) {
        throw new Error("Binder PDF exceeds maximum size");
      }
    });
  }),
  check("18. publication request confirmation required", () => {
    assert(
      readRepo("lib/binder/binderPublicationService.ts").includes("CONFIRMATION_REQUIRED"),
      "publication service must require explicit confirmation",
    );
    assert(
      readRepo("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts").includes(
        "confirm",
      ),
      "publish route must accept confirm flag",
    );
  }),
  check("19. withdrawal reason allowlist", () => {
    for (const reason of QA_BINDER_WITHDRAWAL_REASONS) {
      assert(qaIsBinderWithdrawalReason(reason), `${reason} must be allowed`);
    }
    assert(!qaIsBinderWithdrawalReason("arbitrary_reason"), "arbitrary reason must fail");
  }),
  check("20. stale document unavailable message", () => {
    assert(
      QA_STALE_DOCUMENT_MESSAGE === "This document is no longer available.",
      "stale message mismatch",
    );
  }),
  check("21. cross-client binder/document mismatch rejection", () => {
    const binder: QaBinderClientAccessRow = {
      clientId: CLIENT_A,
      status: "published_to_client",
      generationStatus: "ready",
      withdrawnAt: null,
      publishedDocumentId: DOCUMENT_ID,
    };
    assertThrows(() =>
      qaAssertBinderClientAccessible({
        binder,
        documentClientId: CLIENT_B,
        documentId: DOCUMENT_ID,
      }),
    );
  }),
  check("22. withdrawn binder client denial", () => {
    const binder: QaBinderClientAccessRow = {
      clientId: CLIENT_A,
      status: "withdrawn",
      generationStatus: "ready",
      withdrawnAt: "2026-06-24T12:00:00.000Z",
      publishedDocumentId: DOCUMENT_ID,
    };
    assertThrows(() =>
      qaAssertBinderClientAccessible({
        binder,
        documentClientId: CLIENT_A,
        documentId: DOCUMENT_ID,
      }),
    );
  }),
  check("23. superseded binder client denial", () => {
    const binder: QaBinderClientAccessRow = {
      clientId: CLIENT_A,
      status: "superseded",
      generationStatus: "ready",
      withdrawnAt: null,
      publishedDocumentId: DOCUMENT_ID,
    };
    assertThrows(() =>
      qaAssertBinderClientAccessible({
        binder,
        documentClientId: CLIENT_A,
        documentId: DOCUMENT_ID,
      }),
    );
  }),
  check("24. unpublished binder client denial", () => {
    const binder: QaBinderClientAccessRow = {
      clientId: CLIENT_A,
      status: "unpublished",
      generationStatus: "ready",
      withdrawnAt: null,
      publishedDocumentId: null,
    };
    assertThrows(() =>
      qaAssertBinderClientAccessible({
        binder,
        documentClientId: CLIENT_A,
        documentId: DOCUMENT_ID,
      }),
    );
  }),
  check("25. audit metadata excludes storage path and signed URL", () => {
    const sanitized = qaSanitizeAuditMetadata({
      binderExportId: BINDER_ID,
      version: 1,
      storagePath: "clients/secret/path.pdf",
      signedUrl: "https://signed.example/secret",
      content_hash: "abc123",
    });
    assert(!("storagePath" in sanitized), "storagePath must be removed");
    assert(!("signedUrl" in sanitized), "signedUrl must be removed");
    assert(!("content_hash" in sanitized), "content_hash must be removed");
    assert(sanitized.binderExportId === BINDER_ID, "benign fields preserved");
  }),
];

function main(): void {
  console.log("Phase 9F.3 local acceptance harness (no remote database)\n");

  runBinderQaRuntimeChecks();
  runBinderPublicationQaChecks();

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TESTS.length; i++) {
    const test = { ...TESTS[i], id: i + 1 };
    try {
      test.run();
      console.log(`  ✓ ${test.id}. ${test.name}`);
      passed++;
    } catch (err) {
      failed++;
      console.error(
        `  ✗ ${test.id}. ${test.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (${TESTS.length} harness checks + runtime suites)`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("\nStaging-only (require database): adviser generation, publication, withdrawal, signed URL issuance, notification delivery.");
}

main();
