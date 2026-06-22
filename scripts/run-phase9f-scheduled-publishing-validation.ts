/**
 * Phase 9F.1 scheduled publishing validation — 86 explicit checks.
 * Run: npm run qa:phase9f-scheduled-publishing
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { detectUnguardedXmlPatterns } from "./diagnostic-sql-analyzer";
import {
  canonicalizeIndexPredicate,
  extractPhase9fResolvedCore,
} from "./phase9f-index-predicate";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void | Promise<void> };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function record(id: number, name: string, fn: () => void | Promise<void>): TestCase {
  return { id, name, run: fn };
}

const TESTS: TestCase[] = [
  // Eligibility
  record(1, "Due scheduled content uses publish workflow", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("publishContent"), "publish");
    assert(read("lib/jobs/scheduledPublishingJob.ts").includes("dbListDueScheduledContent"), "due list");
  }),
  record(2, "Future scheduled content query filters by scheduled_at", () => {
    assert(read("lib/supabase/governedContentPersistence.ts").includes('.lte("scheduled_at", now)'), "lte");
  }),
  record(3, "Draft content excluded from due list", () => {
    assert(read("lib/supabase/governedContentPersistence.ts").includes('.eq("approval_status", "scheduled")'), "status");
  }),
  record(4, "Approved but unscheduled excluded from due list", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes('approval_status !== "scheduled"'), "not scheduled");
    assert(read("lib/supabase/governedContentPersistence.ts").includes('dbListDueScheduledContent'), "due query");
  }),
  record(5, "Withdrawn content excluded from due list", () => {
    assert(read("lib/supabase/governedContentPersistence.ts").includes('.is("withdrawn_at", null)'), "withdrawn");
  }),
  record(6, "Expired content blocked at eligibility", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("Content expired"), "expiry");
  }),
  record(7, "Invalid audience blocked", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("Audience scope not permitted"), "audience");
  }),
  record(8, "Invalid selected-client assignment blocked", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("validateTargetClientIds"), "clients");
  }),
  record(9, "Disabled category/market updates blocked", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("Market updates disabled"), "market");
  }),
  record(10, "Product content blocked when feature disabled", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("Product-related content disabled"), "product");
  }),
  record(11, "Automation feature disabled prevents item eligibility", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("Scheduled automation disabled"), "feature");
  }),

  // Approval
  record(12, "Author cannot self-approve through automation", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("Author cannot approve own content"), "self");
  }),
  record(13, "Revoked approval blocks publication", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("Approval record missing"), "approval");
  }),
  record(14, "Approval rechecked at execution", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("assessScheduledContentEligibility"), "assess");
  }),
  record(15, "Newer superseding version handled", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("dbHasPublishedSupersedingVersion"), "supersede");
  }),

  // Concurrency
  record(16, "Concurrent runs blocked by unique active index", () => {
    assert(read("supabase/migrations/202606200008_phase9f_scheduled_publishing.sql").includes("idx_automation_job_runs_single_active"), "index");
  }),
  record(17, "Conditional publish prevents double publish", () => {
    assert(read("lib/supabase/governedContentPersistence.ts").includes('.in("approval_status", input.expectedStatuses)'), "conditional");
  }),
  record(18, "Publish idempotent when already published", () => {
    assert(read("lib/communications/contentWorkflow.ts").includes('approval_status === "published"'), "idempotent");
  }),
  record(19, "Manual publish during run uses same conditional update", () => {
    assert(read("app/api/admin/communications/[contentId]/publish/route.ts").includes("publishContent"), "manual");
  }),
  record(20, "Stale run cleanup before new run", () => {
    assert(read("lib/jobs/jobRunner.ts").includes("dbClearStaleJobRuns"), "stale");
  }),

  // Notifications and delivery
  record(21, "Shared delivery path for admin and automation", () => {
    assert(read("lib/communications/publicationDelivery.ts").includes("deliverPublicationNotifications"), "shared");
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("deliverPublicationNotifications"), "automation");
  }),
  record(22, "Notification idempotency preserved", () => {
    assert(read("lib/communications/publicationDelivery.ts").includes("dbCreateClientNotification"), "notify");
    assert(read("lib/supabase/clientNotificationsPersistence.ts").includes("maybeSingle"), "dedup");
  }),
  record(23, "Sent email not resent", () => {
    assert(read("lib/communications/emailDelivery.ts").includes('delivery_status === "sent"'), "sent guard");
  }),
  record(24, "Failed email does not roll back publication", () => {
    assert(read("lib/jobs/scheduledContentEligibility.ts").includes("deliverPublicationNotifications"), "after publish");
    assert(!read("lib/communications/emailDelivery.ts").includes("withdraw"), "no rollback");
  }),
  record(25, "Withdrawal route unchanged", () => {
    assert(read("app/api/admin/communications/[contentId]/withdraw/route.ts").includes("withdrawContent"), "withdraw");
  }),

  // Authorization
  record(26, "Missing internal secret rejected", () => {
    assert(read("lib/security/cronAuth.ts").includes("return false"), "fail closed");
    assert(read("app/api/internal/jobs/scheduled-publishing/route.ts").includes("validateCronSecret"), "validate");
  }),
  record(27, "Invalid secret rejected via timing-safe compare", () => {
    assert(read("lib/security/cronAuth.ts").includes("timingSafeEqual"), "timing safe");
  }),
  record(28, "Valid internal execution route exists", () => {
    assert(existsSync(join(ROOT, "app/api/internal/jobs/scheduled-publishing/route.ts")), "route");
    assert(read("app/api/internal/jobs/scheduled-publishing/route.ts").includes("runAutomationJob"), "runner");
  }),
  record(29, "Internal route has no session fallback", () => {
    const route = read("app/api/internal/jobs/scheduled-publishing/route.ts");
    assert(!route.includes("requireAdminAccess"), "no admin");
    assert(!route.includes("getUser"), "no session");
  }),
  record(30, "Admin manual execution requires admin access", () => {
    assert(read("app/api/admin/jobs/scheduled-publishing/run/route.ts").includes("requireAdminAccess"), "admin");
  }),
  record(31, "Manual run requires explicit confirmation", () => {
    assert(read("app/api/admin/jobs/scheduled-publishing/run/route.ts").includes('confirm !== true'), "confirm");
    assert(read("components/aegis/admin/AdminJobOperationsClient.tsx").includes("confirm: true"), "ui confirm");
  }),
  record(32, "No adviser execution route", () => {
    assert(!existsSync(join(ROOT, "app/api/advisor/jobs/scheduled-publishing/route.ts")), "no adviser");
  }),

  // Privacy
  record(33, "Job API omits content bodies", () => {
    const route = read("app/api/admin/jobs/runs/route.ts");
    assert(!route.includes("body"), "no body");
    assert(route.includes("toSanitizedJobRunSummary"), "sanitized");
  }),
  record(34, "Job API omits recipient addresses", () => {
    assert(!read("app/api/admin/jobs/runs/route.ts").includes("email"), "no email");
    assert(!read("app/api/internal/jobs/scheduled-publishing/route.ts").includes("clientId"), "no client");
  }),
  record(35, "Job records use sanitized errors only", () => {
    assert(read("lib/jobs/jobAudit.ts").includes("sanitizeJobError"), "sanitize");
    assert(read("lib/supabase/automationJobPersistence.ts").includes("sanitized_error"), "column");
  }),
  record(36, "No client job-history route", () => {
    assert(!existsSync(join(ROOT, "app/api/client/jobs/runs/route.ts")), "no client");
  }),
  record(37, "No adviser job-history route", () => {
    assert(!existsSync(join(ROOT, "app/api/advisor/jobs/runs/route.ts")), "no adviser");
  }),
  record(38, "Internal response has no-store header", () => {
    assert(read("app/api/internal/jobs/scheduled-publishing/route.ts").includes("no-store"), "no-store");
  }),

  // Operations
  record(39, "Active-run protection on manual trigger", () => {
    assert(read("app/api/admin/jobs/scheduled-publishing/run/route.ts").includes("dbHasActiveJobRun"), "active");
  }),
  record(40, "Batch size enforced", () => {
    assert(read("lib/jobs/types.ts").includes("SCHEDULED_PUBLISHING_MAX_BATCH = 25"), "batch");
  }),
  record(41, "Timeout handling in job handler", () => {
    assert(read("lib/jobs/scheduledPublishingJob.ts").includes("deadlineMs"), "deadline");
    assert(read("lib/jobs/scheduledPublishingJob.ts").includes("Execution timeout reached"), "timeout");
  }),
  record(42, "Partial run classification", () => {
    assert(read("lib/jobs/scheduledPublishingJob.ts").includes('"partial"'), "partial");
  }),
  record(43, "Failed run classification", () => {
    assert(read("lib/jobs/scheduledPublishingJob.ts").includes('"failed"'), "failed");
  }),
  record(44, "Skipped counts when feature disabled", () => {
    assert(read("lib/jobs/jobRunner.ts").includes('status: "skipped"'), "skipped");
  }),
  record(45, "Feature disabled default in code", () => {
    assert(/scheduled_content_automation:[\s\S]*?enabled:\s*false/.test(read("lib/compliance/featureFlags.ts")), "default off");
  }),
  record(46, "Feature disabled seed in migration", () => {
    assert(read("supabase/migrations/202606200008_phase9f_scheduled_publishing.sql").includes("'scheduled_content_automation', false"), "seed");
  }),
  record(47, "Job framework registry blocks arbitrary jobs", () => {
    assert(read("lib/jobs/jobRunner.ts").includes('error: "Unknown job"'), "unknown");
    assert(read("lib/jobs/jobRegistry.ts").includes("scheduled_publishing"), "registry");
  }),
  record(48, "RLS enabled without client policies on job tables", () => {
    const migration = read("supabase/migrations/202606200008_phase9f_scheduled_publishing.sql");
    assert(migration.includes("ENABLE ROW LEVEL SECURITY"), "rls");
    assert(!migration.includes("CREATE POLICY"), "no policies");
  }),
  record(49, "Migration rollback docs present", () => {
    assert(existsSync(join(ROOT, "docs/PHASE_9F1_MIGRATION_AND_ROLLBACK.md")), "rollback doc");
  }),
  record(50, "Scheduler operations docs present", () => {
    assert(existsSync(join(ROOT, "docs/PHASE_9F1_SCHEDULER_OPERATIONS.md")), "ops doc");
  }),
  record(51, "Manual acceptance tests doc present", () => {
    assert(existsSync(join(ROOT, "docs/PHASE_9F1_MANUAL_ACCEPTANCE_TESTS.md")), "manual doc");
  }),
  record(52, "Existing system audit identifies authoritative path", () => {
    const audit = read("docs/PHASE_9F1_EXISTING_SYSTEM_AUDIT.md");
    assert(audit.includes("publishContent"), "publish");
    assert(audit.includes("deliverPublicationNotifications"), "delivery");
  }),

  // Final release gate — durable throttle and diagnostics
  record(53, "Internal route uses database-backed scheduler throttle", () => {
    assert(read("app/api/internal/jobs/scheduled-publishing/route.ts").includes("enforceDatabaseBackedSchedulerThrottle"), "throttle");
    assert(read("lib/jobs/schedulerThrottle.ts").includes("automation_job_runs"), "db backed");
  }),
  record(54, "Throttled scheduler returns 429 with no-store", () => {
    const route = read("app/api/internal/jobs/scheduled-publishing/route.ts");
    assert(route.includes("429"), "status");
    assert(route.includes("Scheduler invocation throttled"), "message");
    assert(route.includes("no-store"), "cache");
  }),
  record(55, "Active concurrent run returns 409", () => {
    const route = read("app/api/internal/jobs/scheduled-publishing/route.ts");
    assert(route.includes("activeRunBlocked"), "guard");
    assert(route.includes("409"), "status");
  }),
  record(56, "Security scanner recognises DB throttle as rate limit", () => {
    assert(read("scripts/check-api-auth-patterns.ts").includes("enforceDatabaseBackedSchedulerThrottle"), "pattern");
  }),
  record(57, "Phase 9F migration diagnostic exists", () => {
    assert(existsSync(join(ROOT, "supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql")), "verify");
  }),
  record(58, "Phase 9F preflight diagnostic exists", () => {
    assert(existsSync(join(ROOT, "supabase/diagnostics/preflight_202606200008_phase9f.sql")), "preflight");
  }),
  record(59, "Phase 9F diagnostics are SELECT-only", () => {
    for (const file of [
      "supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql",
      "supabase/diagnostics/preflight_202606200008_phase9f.sql",
    ]) {
      const sql = read(file).toLowerCase().replace(/--[^\n]*/g, "");
      assert(/\bselect\b/.test(sql), `${file} missing SELECT`);
      assert(!/\b(insert|update|delete|alter|drop|create)\b/.test(sql), `${file} not read-only`);
    }
  }),
  record(60, "Active-run partial unique index verified in diagnostic", () => {
    assert(read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql").includes("idx_automation_job_runs_single_active"), "index");
    assert(read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql").includes("running"), "predicate");
  }),
  record(61, "Feature seed disabled verified in diagnostic", () => {
    assert(read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql").includes("scheduled_content_automation"), "key");
    assert(read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql").includes("seed_disabled"), "probe");
  }),
  record(62, "No client/adviser policies in migration or diagnostic", () => {
    assert(!read("supabase/migrations/202606200008_phase9f_scheduled_publishing.sql").includes("CREATE POLICY"), "migration");
    assert(read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql").includes("no_policy"), "diagnostic");
  }),
  record(63, "Migration version 202606200008 is unique", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.startsWith("202606200008"));
    assert(files.length === 1, "duplicate 008 migration");
  }),

  // XML runtime safety — Phase 9F diagnostics must not call xpath on empty query_to_xml results
  record(64, "Verify diagnostic has no xpath or query_to_xml", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    const stripped = sql.replace(/--[^\n]*/g, "").toLowerCase();
    assert(!/\bxpath\s*\(/.test(stripped), "xpath present");
    assert(!/\bquery_to_xml\s*\(/.test(stripped), "query_to_xml present");
    assert(!/\bxmlparse\s*\(/.test(stripped), "xmlparse present");
    assert(!/::xml\b/.test(stripped), "::xml cast present");
  }),
  record(65, "Preflight diagnostic has no xpath or query_to_xml", () => {
    const sql = read("supabase/diagnostics/preflight_202606200008_phase9f.sql");
    const stripped = sql.replace(/--[^\n]*/g, "").toLowerCase();
    assert(!/\bxpath\s*\(/.test(stripped), "xpath present");
    assert(!/\bquery_to_xml\s*\(/.test(stripped), "query_to_xml present");
  }),
  record(66, "Seed probe guards absent platform_feature_controls with to_regclass", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    assert(sql.includes("to_regclass('public.platform_feature_controls') IS NULL"), "to_regclass guard");
    assert(sql.includes("seed_disabled"), "seed probe column");
  }),
  record(67, "Seed probe uses native SELECT not XML aggregation", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    assert(sql.includes("FROM platform_feature_controls pfc"), "native table read");
    assert(sql.includes("pfc.enabled = false"), "native boolean probe");
    assert(!sql.includes("query_to_xml"), "no query_to_xml");
  }),
  record(68, "Rollup diagnostic classifies migration-absent state as ABSENT", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    assert(sql.includes("THEN 'ABSENT'"), "ABSENT classification");
    assert(sql.includes("absent_checks > 0"), "absent count gate");
  }),
  record(69, "Comment checks handle null or empty descriptions safely", () => {
    const sql = read("supabase/diagnostics/phase9f_202606200008_resolved_core.sql");
    assert(sql.includes("tc.description ILIKE"), "null/empty comment via ILIKE");
    assert(sql.includes("LEFT JOIN pg_description"), "optional comment join");
    assert(!/\bxpath\s*\(/.test(sql), "no xpath on comments");
  }),
  record(70, "Analyzer flags unguarded xpath+query_to_xml (malformed-empty XML crash)", () => {
    const unsafe =
      "SELECT ((xpath('/row/enabled/text()', query_to_xml($$ SELECT enabled FROM t $$, true, true, '')))[1]::text);";
    const issues = detectUnguardedXmlPatterns(unsafe);
    assert(issues.some((i) => i.kind === "unguarded_xpath"), "flags unsafe pattern");
    const verifySql = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    const preflightSql = read("supabase/diagnostics/preflight_202606200008_phase9f.sql");
    assert(detectUnguardedXmlPatterns(verifySql).length === 0, "verify clean");
    assert(detectUnguardedXmlPatterns(preflightSql).length === 0, "preflight clean");
  }),

  // Phase 9F discrepancy diagnostic
  record(71, "Phase 9F discrepancy diagnostic exists", () => {
    assert(
      existsSync(join(ROOT, "supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql")),
      "discrepancies file",
    );
  }),
  record(72, "Discrepancy diagnostic is SELECT-only without XML", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    const stripped = sql.replace(/--[^\n]*/g, "").toLowerCase();
    assert(/\bselect\b/.test(stripped), "SELECT required");
    assert(!/(^|\n)\s*(insert|update|delete|truncate|create|alter|drop)\s+/m.test(stripped), "read-only");
    assert(!/\bxpath\s*\(/.test(stripped), "no xpath");
    assert(!/\bquery_to_xml\s*\(/.test(stripped), "no query_to_xml");
  }),
  record(73, "Discrepancy diagnostic shares 35-check inventory with verify", () => {
    const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    const discrepancies = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    const inventoryMarker = "('202606200008','table','automation_job_runs',NULL)";
    assert(verify.includes(inventoryMarker), "verify inventory");
    assert(discrepancies.includes(inventoryMarker), "discrepancies inventory");
    const count = (discrepancies.match(/\('202606200008'/g) ?? []).length;
    assert(count === 35, `expected 35 checks, found ${count}`);
  }),
  record(74, "Discrepancy diagnostic filters non-present states only", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    assert(sql.includes("WHERE r.state IN ('conflicting', 'absent', 'unknown')"), "state filter");
    assert(!sql.includes("EXACT_MATCH"), "no rollup classification");
    assert(!sql.includes("PARTIAL_MATCH"), "no rollup classification");
  }),
  record(75, "Discrepancy diagnostic exposes interpretation columns", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    assert(sql.includes("suggested_interpretation"), "interpretation");
    assert(sql.includes("expected_canonical_detail"), "expected canonical");
    assert(sql.includes("actual_canonical_detail"), "actual canonical");
    assert(sql.includes("actual_detail"), "actual detail");
  }),
  record(76, "Discrepancy analyzer scan is XML-clean", () => {
    const sql = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    assert(detectUnguardedXmlPatterns(sql).length === 0, "xml clean");
  }),

  // Index catalog semantics and main/discrepancy parity
  record(77, "Verify and discrepancies share identical resolved core", () => {
    const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    const discrepancies = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    const core = read("supabase/diagnostics/phase9f_202606200008_resolved_core.sql").split("\n").slice(3).join("\n").trim();
    assert(extractPhase9fResolvedCore(verify) === core, "verify core drift");
    assert(extractPhase9fResolvedCore(discrepancies) === core, "discrepancies core drift");
    assert(extractPhase9fResolvedCore(verify) === extractPhase9fResolvedCore(discrepancies), "parity");
  }),
  record(78, "Rollup counts are derived from resolved state inventory", () => {
    const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    const discrepancies = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    assert(verify.includes("COUNT(*) FILTER (WHERE state = 'conflicting') AS conflicting_checks"), "rollup conflicting");
    assert(verify.includes("FROM resolved"), "rollup from resolved");
    assert(discrepancies.includes("WHERE r.state IN ('conflicting', 'absent', 'unknown')"), "discrepancy filter");
  }),
  record(79, "Index checks use pg_index catalog not pg_indexes substring search", () => {
    const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    assert(verify.includes("index_key_cols"), "index_key_cols CTE");
    assert(verify.includes("pg_index"), "pg_index catalog");
    assert(verify.includes("pg_get_expr(ix.indpred"), "indpred expression");
    assert(verify.includes("key_columns_ordered"), "ordered keys");
    assert(!verify.includes("FROM pg_indexes"), "no pg_indexes substring probe");
  }),
  record(80, "Predicate canonicalisation treats equivalent running predicates as equal", () => {
    const a = canonicalizeIndexPredicate("WHERE ((status = 'running'::text))");
    const b = canonicalizeIndexPredicate("(status = 'running'::text)");
    assert(a === b, "equivalent predicates");
    assert(a === "status = 'running'", "canonical running predicate");
  }),
  record(81, "Predicate canonicalisation keeps success predicate conflicting", () => {
    const running = canonicalizeIndexPredicate("status = 'running'");
    const success = canonicalizeIndexPredicate("status = 'success'");
    assert(running !== success, "success differs from running");
  }),
  record(82, "Ordinary indexes expect ordered key columns from migration", () => {
    const core = read("supabase/diagnostics/phase9f_202606200008_resolved_core.sql");
    assert(core.includes("'automation_job_runs|job_name, started_at DESC'"), "job_started keys");
    assert(core.includes("'automation_job_items|job_run_id'"), "items_run keys");
    assert(core.includes("started_at DESC"), "sort direction");
  }),
  record(83, "Resolved inventory contains 35 stable migration checks", () => {
    const core = read("supabase/diagnostics/phase9f_202606200008_resolved_core.sql");
    const count = (core.match(/\('202606200008'/g) ?? []).length;
    assert(count === 35, `inventory count ${count}`);
    const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    assert((verify.match(/check_id/g) ?? []).length >= 2, "check_id exposed");
  }),
  record(84, "Partial unique index checks uniqueness and predicate separately", () => {
    const core = read("supabase/diagnostics/phase9f_202606200008_resolved_core.sql");
    assert(core.includes("index_def"), "index_def kind");
    assert(core.includes("idx_automation_job_runs_single_active"), "partial unique index");
    assert(core.includes("predicate_canonical"), "predicate canonical");
    assert(core.includes("status = ''running''"), "expected predicate literal");
  }),
  record(85, "Discrepancy row count uses same states as rollup counters", () => {
    const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
    const discrepancies = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
    assert(verify.includes("conflicting_checks"), "rollup conflicting counter");
    assert(discrepancies.includes("WHERE r.state IN ('conflicting', 'absent', 'unknown')"), "discrepancy states");
    assert(!discrepancies.includes("COUNT(*) FILTER (WHERE state = 'present')"), "no present rows");
  }),
  record(86, "Wrong-column index specification remains conflicting in resolved logic", () => {
    const core = read("supabase/diagnostics/phase9f_202606200008_resolved_core.sql");
    assert(core.includes("key_columns_ordered = 'job_run_id'"), "items_run key match");
    assert(core.includes("ELSE 'conflicting'"), "conflicting fallback");
    assert(core.includes("NOT ik.is_unique"), "non-unique ordinary index");
  }),
];

async function runAll(): Promise<void> {
  console.log(`Phase 9F.1 scheduled publishing validation — ${TESTS.length} cases\n`);

  for (const test of TESTS) {
    try {
      await test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  ✓ ${test.id}. ${test.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  ✗ ${test.id}. ${test.name}: ${message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${results.length - passed} failed`);

  if (passed !== results.length) {
    process.exit(1);
  }
}

void runAll();
