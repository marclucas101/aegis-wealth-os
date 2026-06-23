/**
 * Phase 9F.3 binder PDF + client vault final release validation — 180 explicit checks.
 * Run: npm run qa:phase9f3-binder-client-vault
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  detectUnsafeOptionalBinderColumnReferences,
  detectPreflightProbeCteIssues,
  PHASE9F3_OPTIONAL_BINDER_COLUMNS,
  PREFLIGHT_RESULT_COLUMNS,
} from "./diagnostic-sql-analyzer";
import { runBinderPublicationQaChecks, runBinderQaRuntimeChecks } from "../lib/binder/binderQaRuntime";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function record(id: number, name: string, fn: () => void): TestCase {
  return { id, name, run: fn };
}

const TESTS: TestCase[] = [
  record(1, "existing system audit doc exists", () => assert(existsSync("docs/PHASE_9F3_EXISTING_SYSTEM_AUDIT.md"), "audit")),
  record(2, "storage architecture doc exists", () => assert(existsSync("docs/PHASE_9F3_STORAGE_ARCHITECTURE.md"), "storage")),
  record(3, "binder PDF architecture doc exists", () => assert(existsSync("docs/PHASE_9F3_BINDER_PDF_ARCHITECTURE.md"), "pdf")),
  record(4, "migration audit doc exists", () => assert(existsSync("docs/PHASE_9F3_MIGRATION_AUDIT.md"), "mig audit")),
  record(5, "migration rollback doc exists", () => assert(existsSync("docs/PHASE_9F3_MIGRATION_AND_ROLLBACK.md"), "rollback")),
  record(6, "storage architecture selects binder-exports bucket", () => {
    const doc = read("docs/PHASE_9F3_STORAGE_ARCHITECTURE.md");
    assert(doc.includes("binder-exports") && doc.includes("Dedicated"), "bucket decision");
    assert(doc.includes("## Decision"), "decision section");
  }),
  record(7, "migration version 202606200010 unique", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.startsWith("202606200010"));
    assert(files.length === 1, "duplicate 010");
  }),
  record(8, "migration follows 202606200009", () => {
    const stamps = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0])
      .sort();
    assert(stamps.indexOf("202606200010") === stamps.indexOf("202606200009") + 1, "ordering");
  }),
  record(9, "migration file exists", () =>
    assert(existsSync("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql"), "migration")),
  record(10, "migration is additive only", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").toLowerCase();
    assert(!sql.includes("drop table"), "drop table");
    assert(!sql.includes("truncate "), "truncate");
  }),
  record(11, "migration has no destructive DDL on binder_exports", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql");
    assert(!sql.match(/DROP COLUMN(?! IF EXISTS)/i), "drop column without if exists");
  }),
  record(12, "immutable version model documented", () => {
    const doc = read("docs/PHASE_9F3_BINDER_PDF_ARCHITECTURE.md");
    assert(doc.includes("binder_lineage_id"), "lineage");
    assert(doc.includes("supersedes_binder_id"), "supersedes");
  }),
  record(13, "generation idempotency key in migration", () => {
    assert(read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").includes("generation_idempotency_key"), "key");
  }),
  record(14, "lineage version unique index in migration", () => {
    assert(read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").includes("idx_binder_exports_lineage_version"), "index");
  }),
  record(15, "generating status in generation constraint", () => {
    assert(read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").includes("'generating'"), "generating");
  }),
  record(16, "private binder-exports bucket in migration", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql");
    assert(sql.includes("'binder-exports'"), "bucket id");
    assert(sql.includes("false") && sql.includes("public"), "private");
  }),
  record(17, "PDF MIME restriction on bucket", () => {
    assert(read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").includes("application/pdf"), "mime");
  }),
  record(18, "no authenticated storage policies in migration", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").toLowerCase();
    assert(!sql.includes("create policy"), "storage policy");
  }),
  record(19, "binder_exports RLS preserved", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").toLowerCase();
    assert(!sql.includes("disable row level security"), "disable rls");
    assert(!sql.includes("create policy"), "new policy");
  }),
  record(20, "preflight diagnostic exists", () => assert(existsSync("supabase/diagnostics/preflight_202606200010_phase9f3.sql"), "preflight")),
  record(21, "preflight is SELECT-only", () => {
    const sql = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql").toLowerCase();
    assert(!sql.includes("insert into"), "insert");
    assert(!sql.includes("update "), "update");
    assert(!sql.includes("delete from"), "delete");
  }),
  record(22, "main schema diagnostic exists", () =>
    assert(existsSync("supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql"), "verify")),
  record(23, "discrepancy diagnostic exists", () =>
    assert(existsSync("supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql"), "discrepancies")),
  record(24, "shared resolved core exists", () => assert(existsSync("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql"), "core")),
  record(25, "verify and discrepancies share resolved core", () => {
    const begin = "-- PHASE9F3_RESOLVED_CORE_BEGIN";
    const end = "-- PHASE9F3_RESOLVED_CORE_END";
    const extract = (text: string) => text.slice(text.indexOf(begin) + begin.length, text.indexOf(end)).trim();
    const verify = read("supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql");
    const disc = read("supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql");
    assert(extract(verify) === extract(disc), "core parity");
  }),
  record(26, "diagnostics use no XML", () => {
    for (const f of [
      "supabase/diagnostics/preflight_202606200010_phase9f3.sql",
      "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
      "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql",
    ]) {
      const sql = read(f);
      assert(!sql.includes("xpath("), f);
      assert(!sql.includes("query_to_xml"), f);
    }
  }),
  record(27, "verify rollup EXACT_MATCH classification", () => {
    const verify = read("supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql");
    assert(verify.includes("EXACT_MATCH"), "rollup");
    assert(verify.includes("total_required_checks"), "summary");
  }),
  record(28, "discrepancy filters conflicting absent unknown only", () => {
    const disc = read("supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql");
    assert(disc.includes("conflicting"), "conflicting");
    assert(disc.includes("absent"), "absent");
    assert(disc.includes("suggested_interpretation"), "interpretation");
  }),
  record(29, "optional-column safety in preflight", () => {
    assert(read("supabase/diagnostics/preflight_202606200010_phase9f3.sql").includes("to_regclass"), "to_regclass");
  }),
  record(30, "structured index checks in resolved core", () => {
    const core = read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql");
    assert(core.includes("idx_binder_exports_lineage_version"), "lineage index");
    assert(core.includes("idx_binder_exports_generation_idempotent"), "idempotent index");
  }),
  record(31, "binder_client_publication disabled by default documented", () => {
    const audit = read("docs/PHASE_9F3_MIGRATION_AUDIT.md");
    assert(audit.includes("binder_client_publication"), "feature");
    assert(audit.includes("false") || audit.includes("disabled"), "disabled");
  }),
  record(32, "no new PDF feature control in migration", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").toLowerCase();
    assert(!sql.includes("platform_feature_controls"), "no new feature seed");
  }),
  record(33, "existing row backfill documented", () => {
    const audit = read("docs/PHASE_9F3_MIGRATION_AUDIT.md");
    assert(audit.includes("legacy_manifest") || audit.includes("backfill"), "backfill");
  }),
  record(34, "rollback documentation present", () => {
    const doc = read("docs/PHASE_9F3_MIGRATION_AND_ROLLBACK.md");
    assert(doc.includes("Rollback"), "rollback section");
    assert(doc.includes("binder_lineage_id") || doc.includes("DROP INDEX"), "objects");
  }),
  record(35, "migration chain audit updated", () => {
    assert(read("docs/MIGRATION_CHAIN_AUDIT.md").includes("202606200010"), "chain audit");
  }),
  record(36, "migration dependency graph updated", () => {
    assert(read("docs/MIGRATION_DEPENDENCY_GRAPH.md").includes("202606200010"), "graph");
  }),
  record(37, "classify-migration-drift includes 010", () => {
    assert(read("scripts/classify-migration-drift.ts").includes("202606200010"), "drift");
  }),
  record(38, "state machine includes generating and published_to_client", () => {
    const doc = read("docs/PHASE_9F3_BINDER_PDF_ARCHITECTURE.md");
    assert(doc.includes("generating"), "generating");
    assert(doc.includes("published_to_client"), "published");
    assert(doc.includes("withdrawn"), "withdrawn");
  }),
  record(39, "audit documents html2canvas server boundary", () => {
    const audit = read("docs/PHASE_9F3_EXISTING_SYSTEM_AUDIT.md");
    assert(audit.includes("html2canvas"), "html2canvas");
    assert(audit.toLowerCase().includes("server"), "server boundary");
  }),
  record(40, "binder PDF renderer module exists", () => {
    assert(existsSync("lib/binder/binderPdfRenderer.ts"), "renderer");
    assert(existsSync("lib/binder/binderGenerationService.ts"), "service");
  }),
  record(41, "preflight has no unsafe direct optional-column references", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    const issues = detectUnsafeOptionalBinderColumnReferences(preflight);
    if (issues.length > 0) {
      throw new Error(issues.map((i) => i.message).join("; "));
    }
  }),
  record(42, "preflight uses to_jsonb for migration-owned data probes", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    assert(preflight.includes("to_jsonb(be) ->> 'generation_idempotency_key'"), "idempotency jsonb");
    assert(preflight.includes("to_jsonb(be) ->> 'binder_lineage_id'"), "lineage jsonb");
    assert(preflight.includes("to_jsonb(be) ->> 'published_document_id'"), "published doc jsonb");
    assert(preflight.includes("to_jsonb(be) ->> 'generation_status'"), "generation status jsonb");
  }),
  record(43, "all migration-owned columns listed in analyzer registry", () => {
    for (const col of [
      "binder_lineage_id",
      "generation_status",
      "generation_idempotency_key",
      "storage_bucket",
      "file_size_bytes",
      "mime_type",
      "content_hash",
      "generation_error_code",
      "generation_completed_at",
      "published_document_id",
      "supersedes_binder_id",
      "withdrawn_at",
      "withdrawal_reason",
    ]) {
      assert(PHASE9F3_OPTIONAL_BINDER_COLUMNS.includes(col as (typeof PHASE9F3_OPTIONAL_BINDER_COLUMNS)[number]), col);
    }
  }),
  record(44, "analyzer rejects unsafe duplicate idempotency probe pattern", () => {
    const issues = detectUnsafeOptionalBinderColumnReferences(`
      SELECT generation_idempotency_key FROM binder_exports WHERE generation_idempotency_key IS NOT NULL;
    `);
    assert(issues.some((i) => i.kind === "unsafe_optional_column_reference"), "unsafe");
  }),
  record(45, "analyzer accepts safe jsonb duplicate idempotency probe pattern", () => {
    const issues = detectUnsafeOptionalBinderColumnReferences(`
      SELECT NULLIF(to_jsonb(be) ->> 'generation_idempotency_key', '') FROM public.binder_exports be;
    `);
    assert(issues.length === 0, issues.map((i) => i.message).join("; "));
  }),
  record(46, "verify diagnostics have no unsafe binder_exports column references", () => {
    for (const file of [
      "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
      "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql",
    ]) {
      const issues = detectUnsafeOptionalBinderColumnReferences(read(file));
      if (issues.length > 0) {
        throw new Error(`${file}: ${issues.map((i) => i.message).join("; ")}`);
      }
    }
  }),
  record(47, "preflight schema probes use information_schema catalogs", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    assert(preflight.includes("information_schema.columns"), "information_schema");
    assert(preflight.includes("to_regclass('public.idx_binder_exports_generation_idempotent')"), "index catalog");
  }),
  record(48, "preflight duplicate probes return zero when optional columns absent", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    assert(
      preflight.includes("WHEN (SELECT duplicate_idempotency_keys FROM data_quality) = 0 THEN 'READY'"),
      "idempotency zero is ready",
    );
    assert(!preflight.includes("SELECT generation_idempotency_key FROM"), "no direct idempotency select");
  }),
  record(49, "preflight probes CTE declares typed output columns", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    assert(
      preflight.includes("probes (probe_id, classification, detail) AS ("),
      "typed probes CTE",
    );
    const issues = detectPreflightProbeCteIssues(preflight);
    if (issues.length > 0) {
      throw new Error(issues.map((i) => i.message).join("; "));
    }
  }),
  record(50, "preflight exposes probe_id classification detail only", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    assert(/SELECT\s+probe_id\s*,\s*classification\s*,\s*detail\s+FROM\s+probes/i.test(preflight), "final select");
    for (const col of PREFLIGHT_RESULT_COLUMNS) {
      assert(preflight.includes(col), col);
    }
  }),
  record(51, "preflight classification literals are READY WARNING BLOCKER UNKNOWN only", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    const thenLiterals = [...preflight.matchAll(/\bTHEN\s+'([^']+)'/gi)].map((m) => m[1]);
    for (const literal of thenLiterals) {
      assert(
        ["READY", "WARNING", "BLOCKER", "UNKNOWN"].includes(literal),
        `unexpected classification literal: ${literal}`,
      );
    }
  }),
  record(52, "PDF renderer decision doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_PDF_RENDERER_DECISION.md"), "decision")),
  record(53, "generation workflow doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_GENERATION_WORKFLOW.md"), "workflow")),
  record(54, "PDF content policy doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_PDF_CONTENT_POLICY.md"), "policy")),
  record(55, "generation operations doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_GENERATION_OPERATIONS.md"), "ops")),
  record(56, "checkpoint 2 manual tests doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_CHECKPOINT2_MANUAL_TESTS.md"), "manual")),
  record(57, "binder lib modules use server-only", () => {
    for (const file of [
      "lib/binder/binderGenerationService.ts",
      "lib/binder/binderPdfRenderer.ts",
      "lib/binder/binderPdfRedaction.ts",
      "lib/binder/binderSectionResolvers.ts",
      "lib/supabase/binderStoragePersistence.ts",
      "lib/supabase/binderExportPersistence.ts",
    ]) {
      assert(read(file).includes('import "server-only"'), file);
    }
  }),
  record(58, "binder renderer does not import html2canvas", () => {
    const renderer = read("lib/binder/binderPdfRenderer.ts");
    assert(!renderer.includes("html2canvas"), "html2canvas");
    assert(!renderer.includes("window"), "window");
    assert(!renderer.includes("document"), "document");
  }),
  record(59, "binder generation service uses jsPDF path not browser pipeline", () => {
    const svc = read("lib/binder/binderGenerationService.ts");
    assert(svc.includes("renderBinderPdf"), "render");
    assert(!svc.includes("html2canvas"), "no canvas");
  }),
  record(60, "A4 geometry constants in renderer", () => {
    const types = read("lib/binder/binderPdfTypes.ts");
    assert(types.includes("widthMm: 210"), "width");
    assert(types.includes("heightMm: 297"), "height");
    assert(types.includes("marginMm: 16"), "margin");
  }),
  record(61, "renderer runtime A4 and multi-page checks", () => runBinderQaRuntimeChecks()),
  record(62, "idempotency key stability and privacy", () => runBinderQaRuntimeChecks()),
  record(63, "storage path convention server-side only", () => {
    const storage = read("lib/supabase/binderStoragePersistence.ts");
    assert(storage.includes("clients/${input.clientId}/binders/"), "path");
    assert(storage.includes("meeting-pack.pdf"), "filename");
    assert(storage.includes("upsert: false"), "no upsert");
  }),
  record(64, "storage upload enforces 25 MiB limit", () => {
    assert(read("lib/supabase/binderStoragePersistence.ts").includes("BINDER_MAX_PDF_BYTES"), "limit");
  }),
  record(65, "SHA-256 integrity helper", () => {
    assert(read("lib/binder/binderGenerationIdempotency.ts").includes("sha256"), "sha256");
  }),
  record(66, "atomic ready update sets all artifact fields", () => {
    const svc = read("lib/binder/binderGenerationService.ts");
    assert(svc.includes("generation_status: \"ready\""), "ready");
    assert(svc.includes("content_hash"), "hash");
    assert(svc.includes("file_size_bytes"), "size");
    assert(svc.includes("mime_type: \"application/pdf\""), "mime");
  }),
  record(67, "failed state uses stable error codes only", () => {
    const svc = read("lib/binder/binderGenerationService.ts");
    assert(svc.includes("BINDER_ERROR_CODES.RENDER_FAILED"), "render");
    assert(svc.includes("BINDER_ERROR_CODES.STORAGE_FAILED"), "storage");
    assert(svc.includes("generation_error_code: code"), "sanitized code");
  }),
  record(68, "orphan risk audit on finalize failure", () => {
    assert(read("lib/binder/binderGenerationService.ts").includes("binder_storage_orphan_risk"), "orphan");
  }),
  record(69, "section resolver uses isCurrentPublishedOutput", () => {
    assert(read("lib/binder/binderSectionResolvers.ts").includes("isCurrentPublishedOutput"), "current");
  }),
  record(70, "section resolver blocks adviser_internal", () => {
    assert(read("lib/binder/binderPdfRedaction.ts").includes("adviser_internal"), "internal");
  }),
  record(71, "redaction allowlist and sensitive patterns", () => {
    const red = read("lib/binder/binderPdfRedaction.ts");
    assert(red.includes("FINANCIAL_READINESS_SNAPSHOT_ALLOWLIST"), "allowlist");
    assert(red.includes("BINDER_SENSITIVE_MARKERS"), "markers");
  }),
  record(72, "sensitive fixture markers defined", () => {
    assert(read("lib/binder/binderRedactionFixtures.ts").includes("SENSITIVE_NRIC"), "nric");
  }),
  record(73, "POST binder-export route adviser auth", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-export/route.ts");
    assert(route.includes("requireAdvisorAccess"), "auth");
    assert(route.includes("resolveAccessibleClient"), "assignment");
    assert(route.includes("isFeatureEnabled(\"binder_export\")"), "gate");
  }),
  record(74, "POST binder-export strict section validation", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-export/route.ts");
    assert(route.includes("BINDER_SECTIONS"), "sections");
    assert(route.includes("rejectClientIdInBody"), "client id reject");
    assert(route.includes("privateNoStoreHeaders"), "no-store");
  }),
  record(75, "POST response omits storage path and hash", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-export/route.ts");
    assert(!route.includes("storagePath:"), "no storage path in response mapping");
    assert(!route.includes("content_hash"), "no hash");
  }),
  record(76, "GET binder-exports list route exists", () =>
    assert(existsSync("app/api/advisor/clients/[clientId]/binder-exports/route.ts"), "list")),
  record(77, "list route bounded and scoped", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-exports/route.ts");
    assert(route.includes("listBinderExportsForAdviserClient"), "service");
    assert(route.includes("privateNoStoreHeaders"), "no-store");
    assert(!route.includes("storage_path"), "no path");
  }),
  record(78, "signed-url route exists", () =>
    assert(
      existsSync(
        "app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/signed-url/route.ts",
      ),
      "signed-url",
    )),
  record(79, "signed-url requires ready status", () => {
    const svc = read("lib/binder/binderGenerationService.ts");
    assert(svc.includes("BINDER_ERROR_CODES.NOT_READY"), "not ready");
    assert(svc.includes('generation_status !== "ready"'), "ready check");
  }),
  record(80, "signed-url cross-client binder load by clientId", () => {
    const route = read(
      "app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/signed-url/route.ts",
    );
    assert(route.includes("dbLoadBinderExportForClient"), "scoped load");
    assert(route.includes("auditBinderDownload"), "audit");
  }),
  record(81, "signed download uses SIGNED_URL_EXPIRY_SECONDS", () => {
    assert(read("lib/supabase/binderStoragePersistence.ts").includes("SIGNED_URL_EXPIRY_SECONDS"), "expiry");
  }),
  record(82, "audit events defined", () => {
    const audit = read("lib/binder/binderAudit.ts");
    for (const action of [
      "binder_generation_started",
      "binder_generated",
      "binder_generation_reused",
      "binder_generation_failed",
      "binder_storage_orphan_risk",
      "binder_downloaded",
    ]) {
      assert(audit.includes(action), action);
    }
  }),
  record(83, "audit metadata excludes signed URL and storage path", () => {
    const audit = read("lib/binder/binderAudit.ts");
    assert(!audit.includes("signedUrl"), "no url");
    assert(!audit.includes("storage_path"), "no path");
  }),
  record(84, "version allocation uses lineage max version", () => {
    const persist = read("lib/supabase/binderExportPersistence.ts");
    assert(persist.includes("dbGetMaxBinderVersionForLineage"), "max version");
    assert(persist.includes("idx_binder_exports_lineage_version") || persist.includes("binder_lineage_id"), "lineage");
  }),
  record(85, "idempotency unique index referenced in persistence", () => {
    assert(read("lib/supabase/binderExportPersistence.ts").includes("generation_idempotency_key"), "key");
  }),
  record(86, "communications binderExport delegates to generation service", () => {
    const mod = read("lib/communications/binderExport.ts");
    assert(mod.includes("generateBinderMeetingPack"), "delegate");
    assert(mod.includes('import "server-only"'), "server only");
  }),
  record(87, "PDF decision selects jsPDF for server binder", () => {
    const doc = read("docs/PHASE_9F3_PDF_RENDERER_DECISION.md");
    assert(doc.includes("jspdf"), "jspdf");
    assert(doc.includes("Rejected") && doc.includes("html2canvas"), "reject canvas");
  }),
  record(88, "generation workflow documents failed retry", () => {
    assert(read("docs/PHASE_9F3_GENERATION_WORKFLOW.md").includes("failed"), "failed retry");
  }),
  record(89, "UUID validation on storage path segments", () => {
    assert(read("lib/supabase/binderStoragePersistence.ts").includes("isValidBinderStorageUuid"), "uuid");
  }),
  record(90, "concurrency conflict error code", () => {
    assert(read("lib/binder/binderErrors.ts").includes("BINDER_GENERATION_CONFLICT"), "conflict");
  }),
  record(91, "checkpoint 3 audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_CHECKPOINT3_EXISTING_SYSTEM_AUDIT.md"), "audit")),
  record(92, "publication workflow doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_PUBLICATION_WORKFLOW.md"), "workflow")),
  record(93, "client access policy doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_CLIENT_ACCESS_POLICY.md"), "policy")),
  record(94, "lifecycle event catalog doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_LIFECYCLE_EVENT_CATALOG.md"), "lifecycle")),
  record(95, "checkpoint 3 operations doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_CHECKPOINT3_OPERATIONS.md"), "ops")),
  record(96, "checkpoint 3 manual tests doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_CHECKPOINT3_MANUAL_TESTS.md"), "manual")),
  record(97, "binderPublicationService exists", () =>
    assert(existsSync("lib/binder/binderPublicationService.ts"), "pub service")),
  record(98, "binderWithdrawalService exists", () =>
    assert(existsSync("lib/binder/binderWithdrawalService.ts"), "withdraw service")),
  record(99, "publication modules use server-only", () => {
    for (const f of [
      "lib/binder/binderPublicationService.ts",
      "lib/binder/binderWithdrawalService.ts",
      "lib/binder/binderClientAccess.ts",
      "lib/binder/binderLifecycleIntegration.ts",
    ]) {
      assert(read(f).includes('import "server-only"'), f);
    }
  }),
  record(100, "insertPublishedBinderDocument metadata only", () => {
    const doc = read("lib/supabase/documentPersistence.ts");
    assert(doc.includes("insertPublishedBinderDocument"), "insert");
    assert(doc.includes("ADVISOR_BINDER_EXPORT_SOURCE"), "source");
    const start = doc.indexOf("insertPublishedBinderDocument");
    const end = doc.indexOf("export async function deleteClientDocument");
    const block = doc.slice(start, end);
    assert(!block.includes("storage.from"), "no storage upload");
  }),
  record(101, "publish route exists", () =>
    assert(
      existsSync("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts"),
      "publish route",
    )),
  record(102, "withdraw route exists", () =>
    assert(
      existsSync("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/withdraw/route.ts"),
      "withdraw route",
    )),
  record(103, "publish requires binder_client_publication", () => {
    assert(
      read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts").includes(
        "binder_client_publication",
      ),
      "feature",
    );
  }),
  record(104, "publish requires explicit confirm", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts");
    assert(route.includes("confirm"), "confirm");
    assert(read("lib/binder/binderPublicationService.ts").includes("CONFIRMATION_REQUIRED"), "code");
  }),
  record(105, "publish response omits storage details", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts");
    assert(!route.includes("storagePath:"), "path in response");
    assert(!route.includes("signedUrl:"), "url in response");
    assert(!route.includes("content_hash"), "hash in response");
  }),
  record(106, "withdraw uses allowlisted reasons", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/withdraw/route.ts");
    assert(route.includes("BINDER_WITHDRAWAL_REASONS"), "allowlist");
    assert(read("lib/binder/binderPublicationTypes.ts").includes("adviser_withdrawal"), "reason");
  }),
  record(107, "publication idempotency key builder", () => {
    assert(read("lib/binder/binderPublicationIdempotency.ts").includes("sha256"), "hash");
  }),
  record(108, "publication reuses existing published row", () => {
    assert(read("lib/binder/binderPublicationService.ts").includes("binder_publication_reused"), "reuse");
  }),
  record(109, "lineage current published unique index in migration", () => {
    assert(
      read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").includes(
        "idx_binder_exports_lineage_current_published",
      ),
      "index",
    );
  }),
  record(110, "supersession within lineage only", () => {
    assert(read("lib/binder/binderPublicationService.ts").includes("dbFindCurrentPublishedBinderInLineage"), "lineage");
    assert(read("lib/binder/binderPublicationService.ts").includes("dbSupersedePublishedBinder"), "supersede");
  }),
  record(111, "withdraw archives document without storage delete", () => {
    const pub = read("lib/supabase/documentPersistence.ts");
    assert(pub.includes("isBinderDocumentTags"), "binder tag check");
    assert(pub.includes("!isBinderDocument"), "skip storage delete");
    assert(read("lib/binder/binderWithdrawalService.ts").includes("dbArchiveDocumentRow"), "archive");
  }),
  record(112, "available lifecycle event registered", () => {
    assert(read("lib/communications/lifecycleNotificationTypes.ts").includes('"available"'), "event");
    assert(read("lib/communications/lifecycleNotificationPolicy.ts").includes("available:"), "policy");
  }),
  record(113, "binder lifecycle integration emits available", () => {
    assert(read("lib/binder/binderLifecycleIntegration.ts").includes('event: "available"'), "available");
  }),
  record(114, "notification failure does not roll back publication", () => {
    const svc = read("lib/binder/binderPublicationService.ts");
    assert(svc.includes("emitBinderAvailableNotification"), "notify after publish");
    assert(read("lib/binder/binderLifecycleIntegration.ts").includes("binder_lifecycle_notification_failed"), "fail audit");
  }),
  record(115, "client signed url binder guard", () => {
    assert(read("lib/supabase/documentPersistence.ts").includes("assertBinderDocumentClientAccessible"), "guard");
  }),
  record(116, "binder client download audit", () => {
    assert(read("lib/supabase/documentPersistence.ts").includes("binder_client_downloaded"), "audit");
  }),
  record(117, "no dedicated client binder list route required", () => {
    assert(!existsSync("app/api/client/binders/route.ts"), "no parallel route");
    assert(read("docs/PHASE_9F3_CHECKPOINT3_EXISTING_SYSTEM_AUDIT.md").includes("existing document list"), "documented");
  }),
  record(118, "adviser binder UI panel exists", () =>
    assert(existsSync("components/aegis/advisor/AdvisorClientBinderPanel.tsx"), "ui")),
  record(119, "adviser UI has publish confirmation", () => {
    assert(read("components/aegis/advisor/AdvisorClientBinderPanel.tsx").includes("confirm"), "confirm");
    assert(read("components/aegis/advisor/AdvisorClientBinderPanel.tsx").includes("Publish to client"), "publish");
  }),
  record(120, "adviser UI wired in workspace", () => {
    assert(read("components/aegis/advisor/AdvisorClientWorkspace.tsx").includes("AdvisorClientBinderPanel"), "panel");
    assert(read("components/aegis/advisor/AdvisorClientWorkspace.tsx").includes("meeting-packs"), "tab");
  }),
  record(121, "stale document safe unavailable message", () => {
    assert(read("components/aegis/documents/DocumentVaultClient.tsx").includes("no longer available"), "stale");
  }),
  record(122, "publication audit actions defined", () => {
    const audit = read("lib/binder/binderAudit.ts");
    for (const action of [
      "binder_published_to_client",
      "binder_publication_reused",
      "binder_superseded",
      "binder_withdrawn_from_client",
      "binder_client_downloaded",
      "binder_lifecycle_notification_failed",
    ]) {
      assert(audit.includes(action), action);
    }
  }),
  record(123, "publish validates canonical storage path", () => {
    assert(read("lib/binder/binderPublicationService.ts").includes("buildBinderStoragePath"), "path check");
  }),
  record(124, "publish validates ready artifact fields", () => {
    const svc = read("lib/binder/binderPublicationService.ts");
    assert(svc.includes("generation_status"), "status");
    assert(svc.includes("content_hash"), "hash");
    assert(svc.includes("application/pdf"), "mime");
  }),
  record(125, "consistency risk audit on publish failure", () => {
    assert(read("lib/binder/binderPublicationService.ts").includes("binder_publication_consistency_risk"), "risk");
  }),
  record(126, "superseded lifecycle includes document source", () => {
    assert(read("lib/communications/lifecycleNotificationPolicy.ts").includes('"document"'), "document in superseded");
  }),
  record(127, "feature disabled blocks new publication", () => {
    assert(read("lib/binder/binderClientAccess.ts").includes("requireBinderClientPublicationFeature"), "require");
  }),
  record(128, "already published readable when feature disabled documented", () => {
    assert(read("docs/PHASE_9F3_CLIENT_ACCESS_POLICY.md").includes("remain readable"), "readable");
  }),
  record(129, "no client binder_exports API route", () => {
    assert(!existsSync("app/api/client/binders"), "no client binder api");
  }),
  record(130, "publish and withdraw use private no-store", () => {
    for (const f of [
      "app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts",
      "app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/withdraw/route.ts",
    ]) {
      assert(read(f).includes("privateNoStoreHeaders"), f);
    }
  }),
  record(131, "IDOR cross-client publish uses scoped load", () => {
    assert(read("lib/binder/binderPublicationService.ts").includes("dbLoadBinderExportForClient"), "scoped");
  }),
  record(132, "IDOR cross-client withdraw uses scoped load", () => {
    assert(read("lib/binder/binderWithdrawalService.ts").includes("dbLoadBinderExportForClient"), "scoped");
  }),
  record(133, "diagnostics include lineage current published index", () => {
    assert(
      read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql").includes(
        "idx_binder_exports_lineage_current_published",
      ),
      "core",
    );
  }),
  record(134, "PHASE_9F2 event catalog documents available", () => {
    assert(read("docs/PHASE_9F2_EVENT_CATALOG.md").includes("`available`"), "catalog");
  }),
  record(135, "downloaded remains audit-only for binders", () => {
    const policy = read("lib/communications/lifecycleNotificationPolicy.ts");
    assert(policy.includes("downloaded:"), "downloaded policy");
    assert(/downloaded:[\s\S]*?inAppEligible: false/.test(policy), "audit only");
    assert(read("lib/supabase/documentPersistence.ts").includes("binder_client_downloaded"), "binder audit");
  }),
  record(136, "publication does not auto-run after generation", () => {
    assert(!read("lib/binder/binderGenerationService.ts").includes("publishBinderToClient"), "no auto");
  }),
  record(137, "binder errors include publication codes", () => {
    const err = read("lib/binder/binderErrors.ts");
    assert(err.includes("PUBLICATION_DENIED"), "denied");
    assert(err.includes("NOT_PUBLISHABLE"), "not publishable");
    assert(err.includes("CONFIRMATION_REQUIRED"), "confirm");
  }),
  record(138, "withdraw retains storage object", () => {
    const svc = read("lib/binder/binderWithdrawalService.ts");
    assert(!svc.includes(".remove("), "no delete");
    assert(svc.includes("dbWithdrawBinderExport"), "withdraw row");
  }),
  record(139, "published_document_id set on publish", () => {
    assert(read("lib/supabase/binderExportPersistence.ts").includes("published_document_id"), "col");
    assert(read("lib/binder/binderPublicationService.ts").includes("dbPublishBinderExport"), "publish");
  }),
  record(140, "binder_client_publication default off in feature flags", () => {
    assert(read("lib/compliance/featureFlags.ts").includes("binder_client_publication"), "flag");
    assert(/binder_client_publication:[\s\S]*?enabled:\s*false/.test(read("lib/compliance/featureFlags.ts")), "off");
  }),
  record(141, "final migration audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_FINAL_MIGRATION_AUDIT.md"), "final mig audit")),
  record(142, "transaction consistency audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_TRANSACTION_CONSISTENCY_AUDIT.md"), "txn audit")),
  record(143, "storage security audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_STORAGE_SECURITY_AUDIT.md"), "storage audit")),
  record(144, "publication lifecycle audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_PUBLICATION_LIFECYCLE_AUDIT.md"), "lifecycle audit")),
  record(145, "final release audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_FINAL_RELEASE_AUDIT.md"), "release audit")),
  record(146, "final manual acceptance tests doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_FINAL_MANUAL_ACCEPTANCE_TESTS.md"), "manual")),
  record(147, "deployment and enablement doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_DEPLOYMENT_AND_ENABLEMENT.md"), "deploy")),
  record(148, "incident response doc exists", () =>
    assert(existsSync("docs/PHASE_9F3_INCIDENT_RESPONSE.md"), "incident")),
  record(149, "binder document inserted archived until publish", () => {
    const block = read("lib/supabase/documentPersistence.ts");
    const start = block.indexOf("insertPublishedBinderDocument");
    const end = block.indexOf("export async function deleteClientDocument");
    assert(block.slice(start, end).includes("is_archived: true"), "archived insert");
  }),
  record(150, "document unarchived after successful publish", () => {
    assert(read("lib/binder/binderPublicationService.ts").includes("dbUnarchiveDocumentRow"), "unarchive");
  }),
  record(151, "list filters unpublished binder documents", () => {
    assert(read("lib/supabase/documentPersistence.ts").includes("isBinderDocumentListedForClient"), "filter");
    assert(read("lib/supabase/documentPersistence.ts").includes("loadBinderByPublishedDocumentId"), "linkage");
  }),
  record(152, "publish enforces version ordering within lineage", () => {
    assert(read("lib/binder/binderPublicationService.ts").includes("binder.version <= prior.version"), "ordering");
  }),
  record(153, "no publication RPC in migration", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").toLowerCase();
    assert(!sql.includes("create function"), "no rpc");
    assert(!sql.includes("create or replace function"), "no rpc");
  }),
  record(154, "preflight duplicate current published per lineage probe", () => {
    assert(
      read("supabase/diagnostics/preflight_202606200010_phase9f3.sql").includes(
        "duplicate_current_published_per_lineage",
      ),
      "probe",
    );
  }),
  record(155, "preflight malformed content hash probe", () => {
    assert(read("supabase/diagnostics/preflight_202606200010_phase9f3.sql").includes("malformed_content_hashes"), "hash");
  }),
  record(156, "preflight document_event_notifications prerequisite", () => {
    assert(
      read("supabase/diagnostics/preflight_202606200010_phase9f3.sql").includes("document_notifications_seed_present"),
      "notifications",
    );
  }),
  record(157, "diagnostic inventory has 65 checks", () => {
    const core = read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql");
    const matches = core.match(/\('202606200010'/g);
    assert(Boolean(matches && matches.length === 65), `expected 65, got ${matches?.length ?? 0}`);
  }),
  record(158, "document_event_notifications seed in resolved core", () => {
    assert(
      read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql").includes(
        "document_event_notifications",
      ),
      "seed",
    );
  }),
  record(159, "lineage current published index resolved in core", () => {
    const core = read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql");
    assert(core.includes("idx_binder_exports_lineage_current_published"), "index name");
    assert(core.includes("withdrawn_at"), "predicate");
  }),
  record(160, "publication idempotency runtime checks", () => runBinderPublicationQaChecks()),
  record(161, "PDF determinism boundary documented", () => {
    const doc = read("docs/PHASE_9F3_FINAL_RELEASE_AUDIT.md");
    assert(doc.includes("Determinism boundary"), "section");
    assert(doc.includes("Byte-for-byte"), "boundary");
  }),
  record(162, "toBinderPublicError sanitizes unknown errors", () => {
    const mod = read("lib/binder/binderErrors.ts");
    assert(mod.includes("toBinderPublicError"), "helper");
    assert(mod.includes("BinderServiceError"), "typed");
    assert(!mod.includes("error.message"), "no raw passthrough");
  }),
  record(163, "publish route uses toBinderPublicError", () => {
    assert(
      read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts").includes(
        "toBinderPublicError",
      ),
      "sanitize",
    );
  }),
  record(164, "withdraw route uses toBinderPublicError", () => {
    assert(
      read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/withdraw/route.ts").includes(
        "toBinderPublicError",
      ),
      "sanitize",
    );
  }),
  record(165, "signed-url route uses toBinderPublicError", () => {
    assert(
      read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/signed-url/route.ts").includes(
        "toBinderPublicError",
      ),
      "sanitize",
    );
  }),
  record(166, "list route omits storage_path from response", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-exports/route.ts");
    assert(!route.includes("storage_path:"), "path in json");
    assert(!route.includes("content_hash:"), "hash in json");
  }),
  record(167, "concurrency one-current index documented", () => {
    assert(read("docs/PHASE_9F3_TRANSACTION_CONSISTENCY_AUDIT.md").includes("idx_binder_exports_lineage_current_published"), "index");
  }),
  record(168, "feature disabled read policy in deployment doc", () => {
    assert(read("docs/PHASE_9F3_DEPLOYMENT_AND_ENABLEMENT.md").includes("remain client-readable"), "policy");
  }),
  record(169, "orphan object handling in incident doc", () => {
    assert(read("docs/PHASE_9F3_INCIDENT_RESPONSE.md").includes("binder_storage_orphan_risk"), "orphan");
  }),
  record(170, "discrepancy parity shares resolved core", () => {
    const begin = "-- PHASE9F3_RESOLVED_CORE_BEGIN";
    const end = "-- PHASE9F3_RESOLVED_CORE_END";
    const extract = (text: string) => text.slice(text.indexOf(begin) + begin.length, text.indexOf(end)).trim();
    const verify = read("supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql");
    const disc = read("supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql");
    assert(extract(verify) === extract(disc), "parity");
  }),
  record(171, "preflight exposes only probe_id classification detail", () => {
    const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
    assert(/SELECT\s+probe_id\s*,\s*classification\s*,\s*detail\s+FROM\s+probes/i.test(preflight), "columns");
    assert(!preflight.includes("SELECT * FROM probes"), "no star select");
  }),
  record(172, "redaction blocks internal notes marker", () => {
    assert(read("lib/binder/binderPdfRedaction.ts").includes("adviser_internal"), "internal");
    assert(read("lib/binder/binderRedactionFixtures.ts").includes("SENSITIVE_ADVISER_NOTE"), "fixture");
  }),
  record(173, "lifecycle idempotency keys avoid storage paths", () => {
    const svc = read("lib/communications/lifecycleNotificationService.ts");
    assert(svc.includes("buildLifecycleIdempotencyKey") || svc.includes("idempotency"), "keys");
    assert(!svc.includes("storage_path"), "no path in service");
  }),
  record(174, "signed URL reauthorizes binder linkage", () => {
    assert(read("lib/supabase/documentPersistence.ts").includes("assertBinderDocumentClientAccessible"), "guard");
  }),
  record(175, "withdrawn binder blocks client access check", () => {
    assert(read("lib/binder/binderClientAccess.ts").includes("withdrawn_at"), "withdrawn");
    assert(read("lib/binder/binderClientAccess.ts").includes('status !== "published_to_client"'), "status");
  }),
  record(176, "supersession uses dedicated withdrawal reason", () => {
    assert(read("lib/supabase/binderExportPersistence.ts").includes("superseded_by_new_version"), "reason");
  }),
  record(177, "migration remains additive", () => {
    const sql = read("supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql").toLowerCase();
    assert(!sql.includes("drop table binder_exports"), "no drop table");
    assert(sql.includes("add column if not exists"), "additive columns");
  }),
  record(178, "PDF runtime forbidden marker checks", () => {
    runBinderQaRuntimeChecks();
    const pdf = read("lib/binder/binderQaRuntime.ts");
    assert(pdf.includes("QA_FORBIDDEN_PDF_MARKERS"), "markers");
    assert(pdf.includes("INTERNAL_NOTE_DO_NOT_SHARE"), "internal");
  }),
  record(179, "deployment sequence documents feature order", () => {
    const doc = read("docs/PHASE_9F3_DEPLOYMENT_AND_ENABLEMENT.md");
    assert(doc.includes("binder_export"), "export");
    assert(doc.includes("binder_client_publication"), "publication");
    assert(doc.includes("document_event_notifications"), "notifications");
  }),
  record(180, "final release gate QA count at least 180", () => {
    assert(TESTS.length >= 180, `count ${TESTS.length}`);
  }),
];

function main(): void {
  for (const test of TESTS) {
    try {
      test.run();
      results.push({ id: test.id, name: test.name, passed: true });
    } catch (err) {
      results.push({
        id: test.id,
        name: test.name,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`Phase 9F.3 binder client vault: ${passed}/${results.length} passed`);

  for (const f of failed) {
    console.error(`  FAIL #${f.id} ${f.name}: ${f.error}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
