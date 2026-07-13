/**
 * Phase 10.2 — work queue core domain validation.
 * Run: npm run qa:phase10-work-queue-core
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { runWorkQueueUnitTests } from "../lib/work-queue/workQueueUnitTests";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const DOCS = [
  "docs/PHASE_10_2_SOURCE_DATA_AUDIT.md",
  "docs/PHASE_10_2_WORK_ITEM_DOMAIN_MODEL.md",
  "docs/PHASE_10_2_SERVICING_STATE_MAPPING.md",
  "docs/PHASE_10_2_SOURCE_ADAPTER_MATRIX.md",
  "docs/PHASE_10_2_DEDUPLICATION_POLICY.md",
  "docs/PHASE_10_2_PRIORITY_AND_SORTING_POLICY.md",
  "docs/PHASE_10_2_SECURITY_AND_PRIVACY.md",
  "docs/PHASE_10_2_MANUAL_TESTS.md",
] as const;

const CORE_MODULES = [
  "lib/work-queue/types.ts",
  "lib/work-queue/sourceRegistry.ts",
  "lib/work-queue/servicingState.ts",
  "lib/work-queue/routes.ts",
  "lib/work-queue/normalization.ts",
  "lib/work-queue/priority.ts",
  "lib/work-queue/deduplication.ts",
  "lib/work-queue/sorting.ts",
  "lib/work-queue/batchData.ts",
  "lib/work-queue/assembleAdviserWorkQueue.ts",
  "lib/work-queue/buildAdviserWorkQueue.ts",
  "lib/work-queue/loadWorkQueueBatchData.ts",
  "lib/work-queue/adapters/types.ts",
  "lib/work-queue/adapters/index.ts",
  "lib/work-queue/adapters/advisorTaskAdapter.ts",
  "lib/work-queue/adapters/roadmapItemAdapter.ts",
  "lib/work-queue/adapters/reviewDueAdapter.ts",
  "lib/work-queue/adapters/appointmentAdapter.ts",
  "lib/work-queue/adapters/meetingFollowUpAdapter.ts",
  "lib/work-queue/adapters/planningOutputAdapter.ts",
  "lib/work-queue/adapters/binderExportAdapter.ts",
  "lib/work-queue/adapters/dataCompletenessAdapter.ts",
  "lib/work-queue/fixtures/workQueueFixtures.ts",
  "lib/work-queue/workQueueUnitTests.ts",
] as const;

const SOURCE_TYPES = [
  "advisor_task",
  "roadmap_item",
  "review_due",
  "appointment",
  "meeting_follow_up",
  "planning_output",
  "binder_export",
  "data_completeness",
  "document_follow_up",
] as const;

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
  ...DOCS.map((doc, i) =>
    record(i + 1, `doc exists: ${doc}`, () => assert(existsSync(doc), "missing")),
  ),

  ...CORE_MODULES.map((mod, i) =>
    record(9 + i, `module exists: ${mod}`, () => assert(existsSync(mod), "missing")),
  ),

  record(33, "types define AdviserWorkItem", () => {
    const t = read("lib/work-queue/types.ts");
    assert(t.includes("export type AdviserWorkItem"), "type");
    assert(t.includes("sourceType") && t.includes("reasonCodes"), "fields");
  }),

  record(34, "types define deterministic id fields", () => {
    const t = read("lib/work-queue/types.ts");
    assert(t.includes("sourceId") && t.includes("id: string"), "ids");
  }),

  record(35, "source registry lists all source types", () => {
    const reg = read("lib/work-queue/sourceRegistry.ts");
    for (const st of SOURCE_TYPES) {
      assert(reg.includes(`"${st}"`) || reg.includes(st), st);
    }
  }),

  record(36, "source registry has deferred sources", () =>
    assert(read("lib/work-queue/sourceRegistry.ts").includes("DEFERRED_WORK_QUEUE_SOURCES"), "deferred")),

  record(37, "servicing state canonical type", () => {
    const s = read("lib/work-queue/servicingState.ts");
    assert(s.includes("CanonicalServicingState"), "type");
    assert(s.includes("prospect") && s.includes("unknown"), "values");
  }),

  record(38, "servicing state documents precedence", () => {
    const doc = read("docs/PHASE_10_2_SERVICING_STATE_MAPPING.md");
    assert(doc.includes("Precedence") || doc.includes("precedence"), "precedence");
    assert(doc.includes("relationship_stage"), "stage");
    assert(doc.includes("status"), "status");
  }),

  record(39, "servicing state no mutation", () => {
    const s = read("lib/work-queue/servicingState.ts");
    assert(!s.includes(".update(") && !s.includes("createAdminSupabaseClient"), "pure");
  }),

  record(40, "routes allowlist helper", () =>
    assert(read("lib/work-queue/routes.ts").includes("isAllowlistedWorkQueueHref"), "allowlist")),

  record(41, "routes use client id validation", () =>
    assert(read("lib/work-queue/routes.ts").includes("CLIENT_ID_RE"), "uuid")),

  record(42, "normalization uses supplied now", () => {
    const n = read("lib/work-queue/normalization.ts");
    assert(n.includes("now: Date") && !n.includes("new Date()"), "now param");
  }),

  record(43, "normalization missing due not overdue", () => {
    const n = read("lib/work-queue/normalization.ts");
    assert(n.includes("unscheduled"), "unscheduled");
  }),

  record(44, "priority explainable levels", () => {
    const p = read("lib/work-queue/priority.ts");
    assert(p.includes("critical") && p.includes("high"), "levels");
  }),

  record(45, "priority forbids wealth scoring", () => {
    const doc = read("docs/PHASE_10_2_PRIORITY_AND_SORTING_POLICY.md");
    assert(doc.includes("wealth") || doc.includes("Wealth"), "wealth");
    assert(doc.includes("Forbidden") || doc.includes("must not"), "forbidden");
  }),

  record(46, "deduplication policy doc", () =>
    assert(read("docs/PHASE_10_2_DEDUPLICATION_POLICY.md").includes("Rule"), "rules")),

  record(47, "deduplication does not mutate sources", () => {
    const d = read("lib/work-queue/deduplication.ts");
    assert(!d.includes(".update(") && !d.includes(".insert("), "no writes");
  }),

  record(48, "sorting deterministic policy", () => {
    const s = read("lib/work-queue/sorting.ts");
    const doc = read("docs/PHASE_10_2_PRIORITY_AND_SORTING_POLICY.md");
    assert(s.includes("localeCompare"), "stable id");
    assert(doc.includes("deterministic"), "doc");
  }),

  record(49, "assemble module is pure", () => {
    const a = read("lib/work-queue/assembleAdviserWorkQueue.ts");
    assert(!a.includes("server-only"), "no server-only");
    assert(a.includes("assembleAdviserWorkQueue"), "fn");
  }),

  record(50, "build module is server-only", () =>
    assert(read("lib/work-queue/buildAdviserWorkQueue.ts").includes("server-only"), "server")),

  record(51, "work queue API is Phase 11 read-only route only", () => {
    const routePath = "app/api/advisor-v2/work-queue/route.ts";
    assert(existsSync(join(ROOT, routePath)), "phase 11 work queue route");
    const source = read(routePath);
    assert(source.includes("readOnly: true"), "read only response");
    assert(!source.includes("POST"), "no mutation");
    assert(source.includes("buildAdviserWorkQueue"), "virtual assembly");
  }),

  record(52, "no work queue UI page", () => {
    const found = existsSync("app/advisor/work-queue/page.tsx");
    assert(!found, "ui page");
  }),

  record(53, "phase10 communications migration present for adapter", () => {
    const migrations = readdirSync(join(ROOT, "supabase/migrations"));
    assert(
      migrations.some((f) => f.includes("phase10_crm_v2_communications_core")),
      "communications core migration",
    );
    assert(
      read("lib/work-queue/adapters/index.ts").includes("communicationRecordAdapter"),
      "communication adapter registered",
    );
  }),

  record(54, "feature flag not activated in defaults", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("adviser_work_queue") || !flags.includes("adviser_work_queue: { enabled: true"), "not forced on");
    if (flags.includes("adviser_work_queue")) {
      assert(!flags.includes('adviser_work_queue: { enabled: true'), "not true");
    }
  }),

  record(55, "WORK_QUEUE_FEATURE_FLAG_KEY exported", () =>
    assert(read("lib/work-queue/buildAdviserWorkQueue.ts").includes("adviser_work_queue"), "flag key")),

  record(56, "adapters implement shared contract", () =>
    assert(read("lib/work-queue/adapters/types.ts").includes("AdviserWorkItemAdapter"), "contract")),

  record(57, "adapter context includes batch data", () =>
    assert(read("lib/work-queue/adapters/types.ts").includes("batchData"), "batch")),

  record(58, "eight adapters registered", () => {
    const idx = read("lib/work-queue/adapters/index.ts");
    const count = (idx.match(/Adapter/g) ?? []).length;
    assert(count >= 8, `count ${count}`);
  }),

  record(59, "task adapter excludes completed", () =>
    assert(read("lib/work-queue/adapters/advisorTaskAdapter.ts").includes("completed"), "completed")),

  record(60, "roadmap adapter excludes completed", () =>
    assert(read("lib/work-queue/adapters/roadmapItemAdapter.ts").includes("completed"), "completed")),

  record(61, "review adapter uses canonical servicing", () =>
    assert(read("lib/work-queue/adapters/reviewDueAdapter.ts").includes("resolveCanonicalServicingState"), "canonical")),

  record(62, "appointment adapter bounded window", () =>
    assert(read("lib/work-queue/adapters/appointmentAdapter.ts").includes("appointmentWindowDays"), "window")),

  record(63, "meeting prep separate from appointment", () =>
    assert(read("lib/work-queue/adapters/meetingFollowUpAdapter.ts").includes("meeting_prep_missing"), "prep")),

  record(64, "planning output draft and reviewed", () =>
    assert(read("lib/work-queue/adapters/planningOutputAdapter.ts").includes("adviser_reviewed"), "reviewed")),

  record(65, "binder adapter failed only", () =>
    assert(read("lib/work-queue/adapters/binderExportAdapter.ts").includes('generationStatus !== "failed"'), "failed")),

  record(66, "data completeness safe reason codes", () => {
    const d = read("lib/work-queue/adapters/dataCompletenessAdapter.ts");
    assert(d.includes("missing_required_data"), "data");
    assert(d.includes("missing_supporting_document"), "doc");
  }),

  record(67, "batch loader batches queries", () => {
    const l = read("lib/work-queue/loadWorkQueueBatchData.ts");
    assert(l.includes("Promise.all"), "parallel");
    assert(l.includes(".in(\"client_id\""), "batch in");
  }),

  record(68, "admin scope deferred in builder", () =>
    assert(read("lib/work-queue/buildAdviserWorkQueue.ts").includes("admin_scope_deferred"), "admin")),

  record(69, "assigned clients filtered by adviser", () =>
    assert(read("lib/work-queue/buildAdviserWorkQueue.ts").includes("advisor_user_id"), "assignment")),

  record(70, "security doc covers assignment scope", () => {
    const doc = read("docs/PHASE_10_2_SECURITY_AND_PRIVACY.md");
    assert(doc.includes("assignment") || doc.includes("assigned"), "assignment");
    assert(doc.includes("cross-adviser") || doc.includes("Cross-adviser"), "leakage");
  }),

  record(71, "security doc no financial leakage", () =>
    assert(read("docs/PHASE_10_2_SECURITY_AND_PRIVACY.md").includes("financial"), "financial")),

  record(72, "domain model doc exists", () =>
    assert(read("docs/PHASE_10_2_WORK_ITEM_DOMAIN_MODEL.md").includes("AdviserWorkItem"), "model")),

  record(73, "adapter matrix doc", () =>
    assert(read("docs/PHASE_10_2_SOURCE_ADAPTER_MATRIX.md").includes("advisor_task"), "matrix")),

  record(74, "source audit deferrals documented", () =>
    assert(read("docs/PHASE_10_2_SOURCE_DATA_AUDIT.md").includes("defer") || read("docs/PHASE_10_2_SOURCE_DATA_AUDIT.md").includes("Defer"), "defer")),

  record(75, "manual tests doc present", () =>
    assert(read("docs/PHASE_10_2_MANUAL_TESTS.md").includes("10.3"), "manual")),

  record(76, "9F.4 observation retained in recommendation", () =>
    assert(read("docs/PHASE_10_RECOMMENDATION.md").includes("9F.4"), "observation")),

  record(77, "recommendation updated for 10.2", () =>
    assert(read("docs/PHASE_10_RECOMMENDATION.md").includes("10.2"), "10.2")),

  record(78, "architectural debt register mentions work queue", () =>
    assert(read("docs/PHASE_10_ARCHITECTURAL_DEBT_REGISTER.md").includes("work"), "debt")),

  record(79, "capability map mentions work queue domain", () =>
    assert(read("docs/PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md").includes("work queue") || read("docs/PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md").includes("Work queue"), "cap")),

  record(80, "no OpenAI or ML imports in work-queue", () => {
    for (const mod of CORE_MODULES) {
      const content = read(mod);
      assert(!content.includes("openai") && !content.includes("machine learning"), mod);
    }
  }),

  record(81, "metadata typed SafeWorkItemMetadata", () =>
    assert(read("lib/work-queue/types.ts").includes("SafeWorkItemMetadata"), "metadata")),

  record(82, "deterministic work item id helper", () =>
    assert(read("lib/work-queue/routes.ts").includes("buildDeterministicWorkItemId"), "id")),

  record(83, "queue limits constants", () =>
    assert(read("lib/work-queue/constants.ts").includes("maxItems"), "limits")),

  record(84, "unpublished draft aging threshold", () =>
    assert(read("lib/work-queue/constants.ts").includes("unpublishedDraftAgingDays"), "aging")),

  record(85, "adapter failure isolation", () => {
    const a = read("lib/work-queue/adapters/advisorTaskAdapter.ts");
    assert(a.includes("adapterErrorResult"), "isolation");
  }),

  record(86, "assemble returns adapter status", () =>
    assert(read("lib/work-queue/assembleAdviserWorkQueue.ts").includes("adapterStatus"), "status")),

  record(87, "no persistence in assemble", () => {
    const a = read("lib/work-queue/assembleAdviserWorkQueue.ts");
    assert(!a.includes(".insert(") && !a.includes(".update("), "writes");
  }),

  record(88, "fixtures module for tests", () =>
    assert(existsSync("lib/work-queue/fixtures/workQueueFixtures.ts"), "fixtures")),

  record(89, "unit tests module", () =>
    assert(read("lib/work-queue/workQueueUnitTests.ts").includes("runWorkQueueUnitTests"), "tests")),

  record(90, "qa script registered", () =>
    assert(read("package.json").includes("qa:phase10-work-queue-core"), "npm")),

  record(91, "no remote write in qa script", () => {
    const self = read("scripts/run-phase10-work-queue-core-validation.ts");
    assert(!/import\s+.*buildAdviserWorkQueue/.test(self), "import builder");
    assert(!/import\s+.*loadWorkQueueBatchData/.test(self), "import loader");
  }),

  record(92, "binder 9F.3 spot check unchanged", () =>
    assert(existsSync("lib/binder/binderGenerationService.ts"), "binder")),

  record(93, "no compliance role invented", () =>
    assert(!read("lib/roles.ts").includes('"compliance"'), "role")),

  record(94, "types include actionOwner", () =>
    assert(read("lib/work-queue/types.ts").includes("actionOwner"), "owner")),

  record(95, "types include blocking dismissible", () => {
    const t = read("lib/work-queue/types.ts");
    assert(t.includes("blocking") && t.includes("dismissible"), "flags");
  }),

  record(96, "dedup reason code defined", () =>
    assert(read("lib/work-queue/types.ts").includes("deduplicated_related_source"), "dedup code")),

  record(97, "review due uses pipeline states", () =>
    assert(read("lib/work-queue/adapters/reviewDueAdapter.ts").includes("servicingState"), "pipeline")),

  record(98, "load batch uses review pipeline builder", () =>
    assert(read("lib/work-queue/loadWorkQueueBatchData.ts").includes("buildAdvisorReviewPipelineFromContexts"), "pipeline")),

  record(99, "file quality uses existing helper", () =>
    assert(read("lib/work-queue/loadWorkQueueBatchData.ts").includes("buildClientFileQualityFromContext"), "quality")),

  record(100, "sort does not use display name alone", () => {
    const s = read("lib/work-queue/sorting.ts");
    assert(!s.includes("displayName"), "name sort");
  }),

  record(101, "priority sort weight internal", () =>
    assert(read("lib/work-queue/priority.ts").includes("prioritySortWeight"), "weight")),

  record(102, "document follow up source type in registry", () =>
    assert(read("lib/work-queue/sourceRegistry.ts").includes("document_follow_up"), "doc follow")),

  record(103, "communication delivery deferred", () =>
    assert(read("lib/work-queue/sourceRegistry.ts").includes("communication_delivery"), "defer comm")),

  record(104, "advisor notifications deferred", () =>
    assert(read("lib/work-queue/sourceRegistry.ts").includes("advisor_notifications"), "defer notif")),

  record(105, "client notifications rejected", () =>
    assert(read("lib/work-queue/sourceRegistry.ts").includes("client_notifications"), "reject client")),

  record(106, "task suggestions deferred", () =>
    assert(read("lib/work-queue/sourceRegistry.ts").includes("advisor_task_suggestions"), "defer sugg")),

  record(107, "server-only on load batch", () =>
    assert(read("lib/work-queue/loadWorkQueueBatchData.ts").includes("server-only"), "server")),

  record(108, "adapters do not import browser", () => {
    for (const mod of CORE_MODULES.filter((m) => m.includes("adapters/"))) {
      const c = read(mod);
      assert(!c.includes('"use client"'), mod);
    }
  }),

  record(109, "action href server derived", () => {
    const adapters = read("lib/work-queue/adapters/advisorTaskAdapter.ts");
    assert(adapters.includes("workQueueRoutes"), "routes");
  }),

  record(110, "invalid dates skipped in task adapter", () =>
    assert(read("lib/work-queue/adapters/advisorTaskAdapter.ts").includes("timingResult.ok"), "invalid")),

  record(111, "conflicting servicing unknown", () => {
    const r = read("lib/work-queue/servicingState.ts");
    assert(r.includes('"unknown"'), "unknown");
  }),

  record(112, "raw states preserved in servicing result", () =>
    assert(read("lib/work-queue/servicingState.ts").includes("rawStatus"), "raw")),

  record(113, "PHASE_10 discovery qa still registered", () =>
    assert(read("package.json").includes("qa:phase10-discovery"), "discovery qa")),

  record(114, "no adviser ranking in priority", () => {
    const doc = read("docs/PHASE_10_2_PRIORITY_AND_SORTING_POLICY.md");
    assert(doc.includes("ranking") || doc.includes("leaderboard"), "anti-rank");
  }),

  record(115, "no automatic task creation", () => {
    const wq = readdirSync(join(ROOT, "lib/work-queue"), { recursive: true } as never)
      .map(String)
      .filter((f) => f.endsWith(".ts"));
    for (const rel of wq) {
      const content = read(join("lib/work-queue", rel));
      assert(!content.includes("createAdvisorTask"), rel);
    }
  }),

  record(116, "no source lifecycle mutation", () => {
    const build = read("lib/work-queue/buildAdviserWorkQueue.ts");
    const load = read("lib/work-queue/loadWorkQueueBatchData.ts");
    assert(!build.includes(".update(") && !load.includes(".update("), "mutations");
  }),

  record(117, "UTF-8 docs without null bytes", () => {
    for (const doc of DOCS) {
      const content = read(doc);
      assert(!content.includes("\u0000"), doc);
    }
  }),

  record(118, "source audit table format", () => {
    const doc = read("docs/PHASE_10_2_SOURCE_DATA_AUDIT.md");
    assert(doc.includes("Suitability"), "suitability");
    assert(doc.includes("Source |"), "source col");
  }),

  record(119, "adapter matrix lists all included adapters", () => {
    const doc = read("docs/PHASE_10_2_SOURCE_ADAPTER_MATRIX.md");
    for (const st of SOURCE_TYPES) {
      assert(doc.includes(st), st);
    }
  }),

  record(120, "constants review interval months", () =>
    assert(read("lib/work-queue/constants.ts").includes("REVIEW_INTERVAL_MONTHS"), "review months")),

  record(121, "meeting follow up completed session", () =>
    assert(read("lib/work-queue/adapters/meetingFollowUpAdapter.ts").includes("completed"), "session")),

  record(122, "planning stale unpublished reason", () =>
    assert(read("lib/work-queue/adapters/planningOutputAdapter.ts").includes("planning_stale_unpublished"), "stale")),

  record(123, "binder error code safe exposure", () => {
    const b = read("lib/work-queue/adapters/binderExportAdapter.ts");
    assert(b.includes("generationErrorCode") && !b.includes("stack"), "safe");
  }),

  record(124, "assemble summary counts", () =>
    assert(read("lib/work-queue/assembleAdviserWorkQueue.ts").includes("clientsAffected"), "summary")),

  record(125, "dedup preserves actionable item", () =>
    assert(read("docs/PHASE_10_2_DEDUPLICATION_POLICY.md").includes("actionable"), "actionable")),

  record(126, "security service role boundary", () => {
    const doc = read("docs/PHASE_10_2_SECURITY_AND_PRIVACY.md");
    assert(doc.includes("service-role") || doc.includes("Service-role") || doc.includes("SERVICE_ROLE"), "service");
  }),

  record(127, "logging restrictions documented", () =>
    assert(read("docs/PHASE_10_2_SECURITY_AND_PRIVACY.md").includes("log"), "log")),

  record(128, "virtual queue documented", () =>
    assert(read("docs/PHASE_10_2_WORK_ITEM_DOMAIN_MODEL.md").includes("virtual"), "virtual")),

  record(129, "no notification persistence", () => {
    const wq = read("lib/work-queue/buildAdviserWorkQueue.ts") + read("lib/work-queue/types.ts");
    assert(!wq.includes("advisor_notification_log"), "no persist table");
  }),

  record(130, "phase 10.2 checkpoint in manual tests", () =>
    assert(read("docs/PHASE_10_2_MANUAL_TESTS.md").includes("10.2"), "checkpoint")),

  record(131, "unit tests pass", () => {
    const result = runWorkQueueUnitTests();
    assert(result.failed.length === 0, result.failed.join("; "));
  }),

  record(132, "unit test count minimum", () => {
    const result = runWorkQueueUnitTests();
    assert(result.passed >= 15, `only ${result.passed}`);
  }),

  record(133, "deterministic ids format sourceType:sourceId", () => {
    const r = read("lib/work-queue/routes.ts");
    assert(r.includes("${sourceType}:${sourceId}"), "format");
  }),

  record(134, "forbidden prioritization absent from priority.ts", () => {
    const p = read("lib/work-queue/priority.ts");
    assert(!p.includes("revenue") && !p.includes("AUM"), "forbidden");
  }),

  record(135, "batch loading avoids per client task loop in loader", () => {
    const l = read("lib/work-queue/loadWorkQueueBatchData.ts");
    assert(!l.includes("for (const clientId of clientIds)"), "n+1 loop");
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

  console.log(`Phase 10.2 work queue core: ${passed}/${results.length} passed`);

  for (const f of failed) {
    console.error(`  FAIL #${f.id} ${f.name}: ${f.error}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
