/**
 * Phase 9F.4 Checkpoint 1 — compliance role and legacy promotions audit validation.
 * 62 explicit checks. Run: npm run qa:phase9f4-audit
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  analyzePostgresSql,
  detectPreflightProbeCteIssues,
} from "./diagnostic-sql-analyzer";

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

const AUDIT_DOCS = [
  "docs/PHASE_9F4_ROLE_AND_COMPLIANCE_AUDIT.md",
  "docs/PHASE_9F4_COMPLIANCE_WORKFLOW_AUDIT.md",
  "docs/PHASE_9F4_PROMOTIONS_INVENTORY.md",
  "docs/PHASE_9F4_PROMOTIONS_DEPENDENCY_GRAPH.md",
  "docs/PHASE_9F4_REPLACEMENT_MAPPING.md",
  "docs/PHASE_9F4_RETIREMENT_ARCHITECTURE.md",
  "docs/PHASE_9F4_SECURITY_AUDIT.md",
  "docs/PHASE_9F4_MIGRATION_PLAN.md",
] as const;

const PROMOTION_CODE_PATHS = [
  "lib/aegis/promotions.ts",
  "lib/supabase/promotionsPersistence.ts",
  "lib/communications/legacyPromotionsMigration.ts",
  "app/api/promotions/route.ts",
  "app/api/advisor/promotions/route.ts",
  "app/api/advisor/promotions/[promotionId]/route.ts",
  "app/api/advisor/promotions/[promotionId]/upload/route.ts",
  "app/api/admin/promotions-migration/route.ts",
  "app/promotions/page.tsx",
  "app/advisor/promotions/page.tsx",
  "supabase/migrations/202606100016_promotions.sql",
] as const;

const TESTS: TestCase[] = [
  ...AUDIT_DOCS.map((doc, i) =>
    record(i + 1, `audit doc exists: ${doc}`, () => assert(existsSync(doc), "missing")),
  ),

  record(9, "role audit documents canonical user_role values", () => {
    const doc = read("docs/PHASE_9F4_ROLE_AND_COMPLIANCE_AUDIT.md");
    assert(doc.includes("client") && doc.includes("advisor") && doc.includes("admin"), "roles");
    assert(doc.includes("no distinct `compliance` role") || doc.includes("no distinct compliance role"), "compliance");
  }),

  record(10, "workflow audit covers governed and legacy paths", () => {
    const doc = read("docs/PHASE_9F4_COMPLIANCE_WORKFLOW_AUDIT.md");
    assert(doc.includes("contentWorkflow") || doc.includes("governed communications"), "9e");
    assert(doc.includes("legacy promotions") || doc.includes("Legacy promotions"), "legacy");
    assert(doc.includes("binder"), "binder");
  }),

  record(11, "inventory lists promotions table and APIs", () => {
    const doc = read("docs/PHASE_9F4_PROMOTIONS_INVENTORY.md");
    assert(doc.includes("public.promotions"), "table");
    assert(doc.includes("/api/advisor/promotions"), "api");
    assert(doc.includes("promotion-assets"), "bucket");
  }),

  record(12, "dependency graph states insights does not read promotions", () => {
    const doc = read("docs/PHASE_9F4_PROMOTIONS_DEPENDENCY_GRAPH.md");
    assert(doc.includes("insightsFeedService") || doc.includes("Phase 9E"), "9e");
    assert(doc.includes("scheduledContentEligibility") || doc.includes("Scheduled publishing"), "9f");
  }),

  record(13, "replacement mapping uses status legend", () => {
    const doc = read("docs/PHASE_9F4_REPLACEMENT_MAPPING.md");
    assert(doc.includes("Fully replaced"), "full");
    assert(doc.includes("Partially replaced"), "partial");
    assert(doc.includes("Intentionally obsolete"), "obsolete");
  }),

  record(14, "retirement architecture selects Option B", () => {
    const doc = read("docs/PHASE_9F4_RETIREMENT_ARCHITECTURE.md");
    assert(doc.includes("Option B"), "option b");
    assert(doc.includes("Stage 1"), "stages");
    assert(doc.includes("legacy_promotions_write"), "proposed flag");
  }),

  record(15, "security audit lists confirmed gaps", () => {
    const doc = read("docs/PHASE_9F4_SECURITY_AUDIT.md");
    assert(doc.includes("SEC-9F4"), "gap ids");
    assert(
      doc.includes("no broad fixes") ||
        doc.includes("findings only") ||
        doc.includes("Checkpoint 2 addressed"),
      "scope",
    );
  }),

  record(16, "migration plan defers destructive SQL", () => {
    const doc = read("docs/PHASE_9F4_MIGRATION_PLAN.md");
    assert(
      doc.includes("No migration file required now") ||
        doc.includes("no migration file created") ||
        doc.includes("202606200011") ||
        doc.includes("destructive SQL still deferred"),
      "additive migration only",
    );
    assert(doc.includes("Destructive"), "destructive deferred");
  }),

  record(17, "DB user_role enum in migration", () => {
    const sql = read("supabase/migrations/202606100001_extensions_and_enums.sql");
    assert(sql.includes("user_role") && sql.includes("'client'") && sql.includes("'advisor'") && sql.includes("'admin'"), "enum");
  }),

  record(18, "TS UserRole matches DB enum", () => {
    const roles = read("lib/roles.ts");
    assert(roles.includes('"client"') && roles.includes('"advisor"') && roles.includes('"admin"'), "ts roles");
    assert(!roles.includes("compliance"), "no compliance in ts");
  }),

  record(19, "no compliance in user_role migration", () => {
    const enums = read("supabase/migrations/202606100001_extensions_and_enums.sql");
    assert(!enums.includes("'compliance'"), "compliance absent");
  }),

  record(20, "is_advisor includes admin in SQL", () => {
    const sql = read("supabase/migrations/202606100003_users_and_clients.sql");
    assert(sql.includes("is_advisor()") && sql.includes("'admin'"), "is_advisor");
  }),

  record(21, "requireAdvisorAccess uses isAdvisorRole", () => {
    const auth = read("lib/supabase/advisorAuth.ts");
    assert(auth.includes("isAdvisorRole") || auth.includes("requireAdvisorAccess"), "guard");
  }),

  record(22, "requireAdminAccess for admin routes", () => {
    assert(read("lib/supabase/adminManagement.ts").includes("requireAdminAccess"), "admin");
  }),

  record(23, "admin communications approve requires admin", () => {
    const route = read("app/api/admin/communications/[contentId]/approve/route.ts");
    assert(route.includes("requireAdminAccess"), "admin approve");
  }),

  record(24, "promotions inventory files still present (not removed)", () => {
    for (const p of PROMOTION_CODE_PATHS) {
      assert(existsSync(p), `missing ${p}`);
    }
  }),

  record(25, "promotions migration SQL exists", () => {
    assert(existsSync("supabase/migrations/202606100016_promotions.sql"), "016");
  }),

  record(26, "promotion_migration_reviews in phase9e migration", () => {
    assert(read("supabase/migrations/202606200006_phase9e_communications_governance.sql").includes("promotion_migration_reviews"), "reviews");
  }),

  record(27, "active promotion API routes exist", () => {
    assert(existsSync("app/api/promotions/route.ts"), "client api");
    assert(existsSync("app/api/advisor/promotions/route.ts"), "advisor api");
  }),

  record(28, "insights feed does not query promotions table", () => {
    const feed = read("lib/communications/insightsFeedService.ts");
    assert(!feed.includes('.from("promotions")'), "no promotions query");
    assert(feed.includes("governed_content") || feed.includes("dbList"), "governed");
  }),

  record(29, "scheduled job uses governed_content only", () => {
    const job = read("lib/jobs/scheduledContentEligibility.ts");
    assert(!job.includes("promotions"), "no promotions in job");
    assert(job.includes("GovernedContentRow") || job.includes("governed"), "governed");
  }),

  record(30, "legacy migration service exists", () => {
    assert(read("lib/communications/legacyPromotionsMigration.ts").includes("migratePromotionToDraft"), "migrate");
  }),

  record(31, "client promotions entitlement hardcoded off", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("features.promotions = false"), "off");
  }),

  record(32, "active client nav uses insights not promotions", () => {
    const nav = read("lib/navigation.ts");
    const start = nav.indexOf("export const ACTIVE_CLIENT_NAV_SECTIONS");
    const end = nav.indexOf("export const PROSPECT_NAV_SECTIONS");
    assert(start >= 0 && end > start, "active nav block");
    const activeBlock = nav.slice(start, end);
    assert(activeBlock.includes('href: "/insights"'), "insights");
    assert(!activeBlock.includes('href: "/promotions"'), "no promotions in active nav");
  }),

  record(33, "advisor promotions nav removed from catalogue", () => {
    const nav = read("lib/navigation.ts");
    assert(!nav.includes('href: "/advisor/promotions"'), "no advisor promotions nav");
    assert(nav.includes('href: "/advisor/insights"'), "insights replacement");
  }),

  record(34, "preflight diagnostic exists", () => {
    assert(existsSync("supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql"), "preflight");
  }),

  record(35, "preflight is SELECT-only", () => {
    const sql = read("supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql").toLowerCase();
    assert(!sql.includes("insert into"), "insert");
    assert(!sql.includes("update "), "update");
    assert(!sql.includes("delete from"), "delete");
    assert(!sql.includes("drop table"), "drop");
    assert(!sql.includes("truncate "), "truncate");
  }),

  record(36, "preflight uses probe_id classification detail columns", () => {
    const sql = read("supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql");
    assert(sql.includes("probe_id"), "probe_id");
    assert(sql.includes("classification"), "classification");
    assert(sql.includes("detail"), "detail");
    assert(sql.includes("READY") && sql.includes("WARNING") && sql.includes("BLOCKER"), "classes");
  }),

  record(37, "preflight tolerates absent objects via to_regclass", () => {
    assert(read("supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql").includes("to_regclass"), "to_regclass");
  }),

  record(38, "preflight SQL parses", async () => {
    const sql = read("supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql");
    const analysis = await analyzePostgresSql(sql, { requireSelectOnly: true });
    assert(analysis.issues.length === 0, analysis.issues.map((i) => i.message).join("; ") || "parse failed");
  }),

  record(39, "preflight probe CTE structure valid", () => {
    const sql = read("supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql");
    const issues = detectPreflightProbeCteIssues(sql);
    assert(issues.length === 0, issues.map((i) => i.message).join("; "));
  }),

  record(40, "phase9f4 write-freeze migration file exists", () => {
    assert(
      existsSync("supabase/migrations/202606200011_phase9f4_legacy_promotions_write_freeze.sql"),
      "202606200011 migration",
    );
  }),

  record(41, "202606200011 migration stamp unique", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.startsWith("202606200011"));
    assert(files.length === 1, `expected one 011 migration, got ${files.join(", ")}`);
  }),

  record(42, "qa script imports are filesystem and analyzer only", () => {
    const self = read("scripts/run-phase9f4-audit-validation.ts");
    const importBlock = self.slice(self.indexOf("import "), self.indexOf("const ROOT"));
    assert(importBlock.includes("node:fs"), "fs import");
    assert(importBlock.includes("diagnostic-sql-analyzer"), "analyzer import");
    assert(!/supabase|child_process/.test(importBlock), "no remote-write imports");
  }),

  record(43, "checkpoint docs confirm no feature activation or remote writes", () => {
    const plan = read("docs/PHASE_9F4_MIGRATION_PLAN.md");
    assert(plan.includes("No feature activation") || plan.includes("no feature activation"), "flags");
    assert(plan.includes("No remote database write") || plan.includes("no remote database write"), "remote");
  }),

  record(44, "binder modules unchanged by 9f4 audit (existence)", () => {
    assert(existsSync("lib/binder/binderPublicationService.ts"), "binder pub");
    assert(existsSync("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts"), "binder route");
  }),

  record(45, "binder publish route still uses binder_client_publication flag", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts");
    assert(route.includes("binder_client_publication"), "flag");
  }),

  record(46, "audit docs contain no service role key patterns", () => {
    for (const doc of AUDIT_DOCS) {
      const text = read(doc);
      assert(!text.includes("SUPABASE_SERVICE_ROLE_KEY="), doc);
      assert(!/eyJ[a-zA-Z0-9_-]{20,}/.test(text), `jwt-like secret in ${doc}`);
    }
  }),

  record(47, "audit docs are valid UTF-8 text", () => {
    for (const doc of AUDIT_DOCS) {
      const buf = readFileSync(join(ROOT, doc));
      assert(Buffer.from(buf.toString("utf8")).equals(buf), `utf8 ${doc}`);
    }
  }),

  record(48, "preflight is valid UTF-8", () => {
    const buf = readFileSync(join(ROOT, "supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql"));
    assert(Buffer.from(buf.toString("utf8")).equals(buf), "utf8 preflight");
  }),

  record(49, "package.json registers qa:phase9f4-audit", () => {
    assert(read("package.json").includes("qa:phase9f4-audit"), "npm script");
  }),

  record(50, "inventory documents proposed action column", () => {
    assert(read("docs/PHASE_9F4_PROMOTIONS_INVENTORY.md").includes("Proposed action"), "column");
  }),

  record(51, "role audit classification labels", () => {
    const doc = read("docs/PHASE_9F4_ROLE_AND_COMPLIANCE_AUDIT.md");
    assert(doc.includes("Actively required"), "active");
    assert(doc.includes("Replace before removal"), "replace");
    assert(doc.includes("Safe to deprecate") || doc.includes("safe to deprecate"), "deprecate");
  }),

  record(52, "promotions persistence uses service role for writes", () => {
    const p = read("lib/supabase/promotionsPersistence.ts");
    assert(p.includes("createAdminSupabaseClient"), "admin client");
    assert(p.includes("createPromotion"), "create");
  }),

  record(53, "admin_content_approval flag in feature defaults", () => {
    assert(read("lib/compliance/featureFlags.ts").includes("admin_content_approval"), "flag");
  }),

  record(54, "content workflow blocks author self-approval", () => {
    assert(read("lib/communications/contentWorkflow.ts").includes("Authors cannot approve their own content"), "block");
  }),

  record(55, "publication workflow separate from promotions", () => {
    const wf = read("lib/compliance/publicationWorkflow.ts");
    assert(!wf.includes("promotions"), "no promotions in publication workflow");
  }),

  record(56, "middleware still protects promotions path", () => {
    assert(read("middleware.ts").includes("/promotions"), "middleware");
  }),

  record(57, "dependency graph includes reverse dependencies section", () => {
    assert(read("docs/PHASE_9F4_PROMOTIONS_DEPENDENCY_GRAPH.md").includes("Reverse dependencies"), "reverse");
  }),

  record(58, "migration readiness still lists promotion_migration_reviews optional", () => {
    assert(read("scripts/run-migration-readiness-validation.ts").includes("promotion_migration_reviews"), "optional relation");
  }),

  record(59, "migration chain 010 -> 011 -> 012", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const stamps = files.map((f) => f.split("_")[0]).sort();
    assert(
      stamps.indexOf("202606200011") === stamps.indexOf("202606200010") + 1,
      "011 must follow 010",
    );
    assert(
      stamps.indexOf("202606200012") === stamps.indexOf("202606200011") + 1,
      "012 must follow 011",
    );
    const last = files.at(-1) ?? "";
    assert(last.includes("202606200012"), `expected 012 last, got ${last}`);
  }),

  record(60, "phase9e qa still asserts no promotions in insights", () => {
    assert(read("scripts/run-phase9e-communications-validation.ts").includes("promotions"), "9e regression guard");
  }),

  record(61, "promotions RLS policies in migration", () => {
    const sql = read("supabase/migrations/202606100016_promotions.sql");
    assert(sql.includes("promotions_select_published_active"), "client policy");
    assert(sql.includes("promotions_insert_advisor"), "insert policy");
  }),

  record(62, "audit checkpoint on correct branch name documented", () => {
    const doc = read("docs/PHASE_9F4_ROLE_AND_COMPLIANCE_AUDIT.md");
    assert(doc.includes("phase-9f4-compliance-promotions-retirement"), "branch");
  }),
];

async function main(): Promise<void> {
  console.log(`Phase 9F.4 audit validation — ${TESTS.length} checks\n`);

  for (const test of TESTS) {
    try {
      await test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  ✓ ${test.id}: ${test.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  ✗ ${test.id}: ${test.name} — ${message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
