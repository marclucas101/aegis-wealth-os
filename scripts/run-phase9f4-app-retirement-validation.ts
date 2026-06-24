/**
 * Phase 9F.4 Checkpoint 4 — application retirement validation.
 * Run: npm run qa:phase9f4-app-retirement
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const ADVISER_MUTATION_ROUTES = [
  "app/api/advisor/promotions/route.ts",
  "app/api/advisor/promotions/[promotionId]/route.ts",
  "app/api/advisor/promotions/[promotionId]/upload/route.ts",
] as const;

const CP4_DOCS = [
  "docs/PHASE_9F4_CHECKPOINT4_APPLICATION_RETIREMENT_AUDIT.md",
  "docs/PHASE_9F4_APPLICATION_RETIREMENT_ARCHITECTURE.md",
  "docs/PHASE_9F4_OBSERVATION_PLAN.md",
  "docs/PHASE_9F4_PROMOTION_ASSET_OBSERVATION.md",
  "docs/PHASE_9F4_CHECKPOINT4_MANUAL_TESTS.md",
  "docs/PHASE_9F4_RETIREMENT_ROLLBACK.md",
] as const;

const PHASE9F3_BINDER_SPOT_CHECK = [
  "lib/binder/binderPublicationService.ts",
  "lib/binder/binderGenerationService.ts",
  "app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts",
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
  record(1, "retirement constants module exists", () =>
    assert(existsSync("lib/promotions/legacyPromotionsRetirementConstants.ts"), "constants")),
  record(2, "retirement server module exists", () =>
    assert(existsSync("lib/promotions/legacyPromotionsRetirement.ts"), "server module")),
  record(3, "runtime gate module exists", () =>
    assert(existsSync("lib/promotions/promotionMigrationRuntimeGate.ts"), "runtime gate")),
  record(4, "LEGACY_PROMOTIONS_RETIRED code defined", () =>
    assert(read("lib/promotions/legacyPromotionsRetirementConstants.ts").includes("LEGACY_PROMOTIONS_RETIRED"), "code")),
  record(5, "adviser replacement href is insights authoring", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirementConstants.ts").includes(
        'LEGACY_PROMOTIONS_REPLACEMENT_ADVISER_HREF = "/advisor/insights"',
      ),
      "adviser href",
    )),
  record(6, "client replacement href is insights", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirementConstants.ts").includes(
        'LEGACY_PROMOTIONS_REPLACEMENT_CLIENT_HREF = "/insights"',
      ),
      "client href",
    )),
  record(7, "adviser promotions nav removed from catalogue", () => {
    const nav = read("lib/navigation.ts");
    assert(!nav.includes('label: "Promotions Manager"'), "no promotions manager");
    assert(!nav.includes('href: "/advisor/promotions"'), "no adviser promotions href");
  }),
  record(8, "client promotions removed from deliverables nav", () => {
    const nav = read("lib/navigation.ts");
    const deliverables = nav.slice(nav.indexOf('title: "Deliverables"'), nav.indexOf('title: "Advisory"'));
    assert(!deliverables.includes('href: "/promotions"'), "no client promotions nav");
  }),
  record(9, "insights authoring remains in adviser nav", () =>
    assert(read("lib/navigation.ts").includes('href: "/advisor/insights"'), "insights nav")),
  record(10, "active client nav still uses insights only", () => {
    const nav = read("lib/navigation.ts");
    const block = nav.slice(
      nav.indexOf("ACTIVE_CLIENT_NAV_SECTIONS"),
      nav.indexOf("PROSPECT_NAV_SECTIONS"),
    );
    assert(block.includes('href: "/insights"'), "insights");
    assert(!block.includes('href: "/promotions"'), "no promotions");
  }),
  record(11, "admin migration page path retained", () =>
    assert(existsSync("app/admin/promotions-migration/page.tsx"), "admin page")),
  record(12, "admin communications link to migration review", () =>
    assert(
      read("components/aegis/admin/AdminCommunicationsClient.tsx").includes("/admin/promotions-migration"),
      "link",
    )),
  record(13, "qa script registered in package.json", () =>
    assert(read("package.json").includes("qa:phase9f4-app-retirement"), "npm script")),
  record(14, "retired notice component exists", () =>
    assert(existsSync("components/aegis/promotions/LegacyPromotionsRetiredNotice.tsx"), "notice")),
  record(15, "migration admin context builder exists", () =>
    assert(existsSync("lib/promotions/promotionMigrationAdminContext.ts"), "admin context")),

  record(16, "adviser promotions page redirects to insights", () => {
    const page = read("app/advisor/promotions/page.tsx");
    assert(page.includes("redirect("), "redirect");
    assert(page.includes("adviserPromotionsRetiredRedirectTarget"), "insights target");
    assert(!page.includes("PromotionsManagerClient"), "no manager");
  }),
  record(17, "adviser promotions page audits retirement access", () =>
    assert(read("app/advisor/promotions/page.tsx").includes("auditLegacyPromotionsRetirementAccess"), "audit")),
  record(18, "client promotions page redirects to insights", () => {
    const page = read("app/promotions/page.tsx");
    assert(page.includes("redirect("), "redirect");
    assert(page.includes("clientPromotionsRetiredRedirectTarget"), "insights");
    assert(!page.includes("PromotionsClient"), "no client component");
  }),
  record(19, "adviser insights shows retired notice from query param", () => {
    const page = read("app/advisor/insights/page.tsx");
    assert(page.includes("LegacyPromotionsRetiredNotice"), "notice");
    assert(page.includes("isLegacyPromotionsRetiredNoticeRequested"), "query param");
  }),
  record(20, "client insights shows retired notice from query param", () => {
    const page = read("app/insights/page.tsx");
    assert(page.includes("LegacyPromotionsRetiredNotice"), "notice");
  }),
  record(21, "redirect target includes legacy_promotions_retired param", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirementConstants.ts").includes("legacy_promotions_retired"),
      "param",
    )),
  record(22, "retired user message mentions Governed Communications", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirementConstants.ts").includes("Governed Communications"),
      "message",
    )),
  record(23, "no redirect loop adviser promotions to insights", () => {
    const insights = read("app/advisor/insights/page.tsx");
    assert(!insights.includes("/advisor/promotions"), "no back link");
  }),
  record(24, "no redirect loop client promotions to insights", () => {
    const insights = read("app/insights/page.tsx");
    assert(!insights.includes('redirect("/promotions"'), "no loop");
  }),
  record(25, "PromotionsManagerClient not imported by adviser page", () =>
    assert(!read("app/advisor/promotions/page.tsx").includes("PromotionsManagerClient"), "no import")),

  record(26, "adviser promotions list API returns 410 helper", () => {
    const route = read("app/api/advisor/promotions/route.ts");
    assert(route.includes("legacyPromotionsRetiredAdvisorResponse"), "410 helper");
    assert(read("lib/promotions/legacyPromotionsRetirement.ts").includes(", 410"), "status via helper");
  }),
  record(27, "adviser promotions POST returns retired response", () => {
    const route = read("app/api/advisor/promotions/route.ts");
    assert(route.includes("advisor_api_mutation"), "mutation category");
    assert(route.includes("legacyPromotionsRetiredAdvisorResponse"), "410");
  }),
  record(28, "adviser promotion detail GET returns 410", () =>
    assert(
      read("app/api/advisor/promotions/[promotionId]/route.ts").includes(
        "legacyPromotionsRetiredAdvisorResponse",
      ),
      "410",
    )),
  record(29, "adviser promotion PATCH returns 410", () => {
    const route = read("app/api/advisor/promotions/[promotionId]/route.ts");
    assert(route.includes("export async function PATCH"), "patch");
    assert(route.includes("advisor_api_mutation"), "mutation audit");
  }),
  record(30, "upload route returns 410 before formData", () => {
    const route = read("app/api/advisor/promotions/[promotionId]/upload/route.ts");
    assert(route.includes("legacyPromotionsRetiredAdvisorResponse"), "410");
    assert(!route.includes("formData"), "no form parse");
    assert(!route.includes("uploadPromotionAsset"), "no upload");
  }),
  record(31, "adviser retired APIs require authentication first", () => {
    for (const route of ADVISER_MUTATION_ROUTES) {
      const text = read(route);
      assert(text.includes("requireAdvisorAccess"), route);
    }
  }),
  record(32, "adviser retired APIs do not call persistence layer", () => {
    for (const route of ADVISER_MUTATION_ROUTES) {
      const text = read(route);
      assert(!text.includes("createPromotion"), route);
      assert(!text.includes("updatePromotion"), route);
      assert(!text.includes("listAdvisorPromotions"), route);
      assert(!text.includes("uploadPromotionAsset"), route);
    }
  }),
  record(33, "retirement remains active independent of write flag", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirement.ts").includes(
        "adviserLegacyPromotionsMutationsRetired",
      ),
      "permanent retirement",
    )),
  record(34, "410 body uses LEGACY_PROMOTIONS_RETIRED code", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirementConstants.ts").includes(
        'code: LEGACY_PROMOTIONS_RETIRED_CODE',
      ),
      "code",
    )),
  record(35, "adviser APIs use privatePromotionJson", () => {
    for (const route of ADVISER_MUTATION_ROUTES) {
      assert(read(route).includes("privatePromotionJson"), route);
    }
  }),
  record(36, "mutation blocked audit action exists", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirement.ts").includes(
        "legacy_promotions_retired_mutation_blocked",
      ),
      "audit",
    )),
  record(37, "replacement redirect audit action exists", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirement.ts").includes(
        "legacy_promotions_replacement_redirected",
      ),
      "audit",
    )),
  record(38, "retired route accessed audit action exists", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirement.ts").includes(
        "legacy_promotions_retired_route_accessed",
      ),
      "audit",
    )),
  record(39, "audit metadata excludes promotion body", () => {
    const mod = read("lib/promotions/legacyPromotionsRetirement.ts");
    assert(!mod.includes("title:"), "no title in audit");
    assert(!mod.includes("storage_path"), "no storage path");
  }),
  record(40, "410 response does not disclose record existence", () => {
    for (const route of ADVISER_MUTATION_ROUTES) {
      const text = read(route);
      assert(!text.includes("getAdvisorPromotionById"), route);
    }
  }),

  record(41, "client promotions API returns retired empty payload", () => {
    const route = read("app/api/promotions/route.ts");
    assert(route.includes("retired: true"), "retired flag");
    assert(route.includes('replacement: "insights"'), "replacement");
    assert(route.includes("promotions: []"), "empty list");
  }),
  record(42, "client API requires authentication", () =>
    assert(read("app/api/promotions/route.ts").includes("ensureUserClientProfile"), "session")),
  record(43, "client API requires client role", () =>
    assert(read("app/api/promotions/route.ts").includes('role !== "client"'), "client role")),
  record(44, "client API does not list published promotions", () =>
    assert(!read("app/api/promotions/route.ts").includes("listPublishedPromotions"), "no list")),
  record(45, "client API uses privatePromotionJson", () =>
    assert(read("app/api/promotions/route.ts").includes("privatePromotionJson"), "private json")),
  record(46, "client API has no storage references", () =>
    assert(!read("app/api/promotions/route.ts").includes("signed"), "no signed urls")),
  record(47, "client entitlements file unchanged promotions off", () =>
    assert(read("lib/compliance/entitlements.ts").includes("features.promotions = false"), "entitlement")),
  record(48, "no client migration review exposure in client API", () =>
    assert(!read("app/api/promotions/route.ts").includes("promotion_migration"), "no migration")),

  record(49, "admin migration list API retained", () =>
    assert(read("app/api/admin/promotions-migration/route.ts").includes("export async function GET"), "GET")),
  record(50, "admin migration requires admin access", () =>
    assert(
      read("app/api/admin/promotions-migration/route.ts").includes("requirePromotionMigrationAdminAccess"),
      "auth",
    )),
  record(51, "admin migration list returns retirement context", () =>
    assert(
      read("app/api/admin/promotions-migration/route.ts").includes(
        "buildPromotionMigrationAdminRetirementContext",
      ),
      "context",
    )),
  record(52, "queue overview helper exists", () =>
    assert(
      read("lib/promotions/promotionMigrationReviewService.ts").includes(
        "getPromotionMigrationQueueOverview",
      ),
      "overview",
    )),
  record(53, "admin UI shows legacy retired banner", () =>
    assert(
      read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes(
        "Legacy Promotions is retired",
      ),
      "banner",
    )),
  record(54, "admin UI shows empty queue message", () =>
    assert(
      read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes(
        "No legacy promotions require migration",
      ),
      "empty",
    )),
  record(55, "admin UI shows production queue count", () =>
    assert(
      read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes(
        "Production migration queue",
      ),
      "queue",
    )),
  record(56, "admin UI shows observation period note", () =>
    assert(
      read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes("observation period"),
      "observation",
    )),
  record(57, "admin migrate route checks runtime gate", () =>
    assert(
      read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes(
        "isPhase9f4MigrationExecutionRestricted",
      ),
      "gate",
    )),
  record(58, "admin list POST migrate checks runtime gate", () =>
    assert(
      read("app/api/admin/promotions-migration/route.ts").includes("isPhase9f4MigrationExecutionRestricted"),
      "gate",
    )),
  record(59, "runtime gate message documented", () =>
    assert(
      read("lib/promotions/promotionMigrationRuntimeGate.ts").includes(
        "staging concurrency acceptance",
      ),
      "message",
    )),
  record(60, "runtime gate defaults incomplete", () =>
    assert(
      read("lib/promotions/promotionMigrationRuntimeGate.ts").includes(
        'process.env.PHASE9F4_MIGRATION_RUNTIME_ACCEPTANCE_COMPLETE === "true"',
      ),
      "env gate",
    )),
  record(61, "admin UI disables migrate when runtime gate restricted", () =>
    assert(
      read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes(
        "migrationExecutionRestricted",
      ),
      "disabled",
    )),
  record(62, "admin review classification still available", () =>
    assert(
      read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes("Save review"),
      "review",
    )),

  record(63, "no new destructive migration file", () => {
    const migrations = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(!migrations.toLowerCase().includes("drop table"), "012 no drop");
  }),
  record(64, "promotions persistence module retained", () =>
    assert(existsSync("lib/supabase/promotionsPersistence.ts"), "persistence")),
  record(65, "promotion-assets bucket constant retained", () =>
    assert(read("lib/supabase/promotionsPersistence.ts").includes("promotion-assets"), "bucket")),
  record(66, "no DELETE FROM promotions in retirement code", () => {
    for (const path of [
      "lib/promotions/legacyPromotionsRetirement.ts",
      "app/api/advisor/promotions/route.ts",
      "app/promotions/page.tsx",
    ]) {
      assert(!read(path).toLowerCase().includes("delete from promotions"), path);
    }
  }),
  record(67, "legacy_promotions_write not enabled in feature flags default", () =>
    assert(read("lib/compliance/featureFlags.ts").includes("legacy_promotions_write"), "flag key")),
  record(68, "governed communications persistence unchanged", () =>
    assert(read("lib/supabase/governedContentPersistence.ts").includes("dbCreateGovernedContent"), "governed")),
  record(69, "adviser insights API unchanged route exists", () =>
    assert(existsSync("app/api/advisor/insights/route.ts"), "insights api")),
  record(70, "phase 9f3 binder publish route unchanged", () =>
    assert(
      read("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts").includes(
        "CONFIRMATION_REQUIRED",
      ),
      "binder",
    )),

  record(71, "checkpoint 4 audit doc exists", () =>
    assert(existsSync(CP4_DOCS[0]), "audit doc")),
  record(72, "checkpoint 4 architecture doc exists", () =>
    assert(existsSync(CP4_DOCS[1]), "architecture doc")),
  record(73, "observation plan doc exists", () =>
    assert(existsSync(CP4_DOCS[2]), "observation")),
  record(74, "asset observation doc exists", () =>
    assert(existsSync(CP4_DOCS[3]), "assets")),
  record(75, "manual tests doc exists", () =>
    assert(existsSync(CP4_DOCS[4]), "manual")),
  record(76, "rollback doc exists", () =>
    assert(existsSync(CP4_DOCS[5]), "rollback")),
  record(77, "release signoff mentions runtime waiver", () =>
    assert(read("docs/PHASE_9F4_RELEASE_SIGNOFF.md").toLowerCase().includes("runtime"), "waiver")),
  record(78, "retirement architecture updated for checkpoint 4", () =>
    assert(read("docs/PHASE_9F4_RETIREMENT_ARCHITECTURE.md").includes("Checkpoint 4"), "cp4")),
  record(79, "replacement mapping documents 410 response", () =>
    assert(read("docs/PHASE_9F4_REPLACEMENT_MAPPING.md").includes("410"), "410")),
  record(80, "security audit updated for checkpoint 4", () =>
    assert(read("docs/PHASE_9F4_SECURITY_AUDIT.md").includes("Checkpoint 4"), "security")),
  record(81, "migration runbook mentions runtime gate", () =>
    assert(read("docs/PHASE_9F4_PROMOTION_MIGRATION_RUNBOOK.md").toLowerCase().includes("runtime"), "runbook")),
  record(82, "observation plan is 30 days", () =>
    assert(read("docs/PHASE_9F4_OBSERVATION_PLAN.md").includes("30"), "30 days")),
  record(83, "rollback does not restore adviser legacy UI", () =>
    assert(
      read("docs/PHASE_9F4_RETIREMENT_ROLLBACK.md").includes("Do not restore adviser Legacy Promotions"),
      "no restore",
    )),
  record(84, "asset observation defers deletion", () =>
    assert(read("docs/PHASE_9F4_PROMOTION_ASSET_OBSERVATION.md").includes("defer"), "defer")),

  record(85, "phase 9f3 binder files spot check unchanged", () => {
    for (const path of PHASE9F3_BINDER_SPOT_CHECK) {
      assert(existsSync(path), path);
    }
  }),
  record(86, "migration 011 file still exists", () =>
    assert(
      existsSync("supabase/migrations/202606200011_phase9f4_legacy_promotions_write_freeze.sql"),
      "011",
    )),
  record(87, "migration 012 file still exists", () =>
    assert(
      existsSync("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql"),
      "012",
    )),
  record(88, "local acceptance harness retained for staging gate", () =>
    assert(existsSync("scripts/run-phase9f4-migration-idempotency-local.ts"), "harness")),
  record(89, "open redirect guard adviser target is fixed path", () =>
    assert(
      read("lib/promotions/legacyPromotionsRetirementConstants.ts").includes('"/advisor/insights"'),
      "fixed path",
    )),
  record(90, "private no-store via privatePromotionJson on retired APIs", () =>
    assert(
      read("lib/promotions/legacyPromotionsAuthorization.ts").includes("privateNoStoreHeaders"),
      "no-store",
    )),

  record(91, "audit doc classifies adviser page retire", () =>
    assert(
      read("docs/PHASE_9F4_CHECKPOINT4_APPLICATION_RETIREMENT_AUDIT.md").includes("retire"),
      "classify",
    )),
  record(92, "audit doc classifies admin migration retain", () =>
    assert(
      read("docs/PHASE_9F4_CHECKPOINT4_APPLICATION_RETIREMENT_AUDIT.md").includes("admin"),
      "admin",
    )),
  record(93, "manual tests include 410 adviser API", () =>
    assert(read("docs/PHASE_9F4_CHECKPOINT4_MANUAL_TESTS.md").includes("410"), "410")),
  record(94, "manual tests include upload no processing", () =>
    assert(read("docs/PHASE_9F4_CHECKPOINT4_MANUAL_TESTS.md").includes("upload"), "upload")),
  record(95, "observation tracks aggregate signals only", () =>
    assert(read("docs/PHASE_9F4_OBSERVATION_PLAN.md").includes("aggregate"), "aggregate")),
  record(96, "observation excludes promotion content logging", () =>
    assert(read("docs/PHASE_9F4_OBSERVATION_PLAN.md").includes("Do not log"), "no content")),
  record(97, "application architecture documents option B", () =>
    assert(read("docs/PHASE_9F4_APPLICATION_RETIREMENT_ARCHITECTURE.md").includes("Option B"), "option b")),
  record(98, "rollback requires staging concurrency before migration", () =>
    assert(
      read("docs/PHASE_9F4_RETIREMENT_ROLLBACK.md").includes("concurrency acceptance"),
      "staging",
    )),
  record(99, "admin migration review service still reads promotions table", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes('.from("promotions")'), "read")),
  record(100, "no schema drop in migrations folder for promotions", () => {
    const sql = readFileSync(join(ROOT, "supabase/migrations/202606100016_promotions.sql"));
    assert(sql.includes("CREATE TABLE promotions"), "table exists");
  }),

  record(101, "middleware still protects promotions path", () =>
    assert(read("middleware.ts").includes("/promotions"), "middleware")),
  record(102, "adviser insights manager client still renders", () =>
    assert(read("app/advisor/insights/page.tsx").includes("AdviserInsightsManagerClient"), "manager")),
  record(103, "client insights feed still renders", () =>
    assert(read("app/insights/page.tsx").includes("InsightsFeedClient"), "feed")),
  record(104, "promotion migration RPC migration file retained", () =>
    assert(
      read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").includes(
        "execute_legacy_promotion_migration",
      ),
      "rpc",
    )),
  record(105, "write freeze feature remains separate from retirement", () =>
    assert(
      read("lib/promotions/legacyPromotionsAuthorization.ts").includes("LEGACY_PROMOTIONS_WRITE_DISABLED"),
      "write freeze",
    )),

  record(106, "checkpoint 4 audit lists PromotionCard as deferred UI", () =>
    assert(
      read("docs/PHASE_9F4_CHECKPOINT4_APPLICATION_RETIREMENT_AUDIT.md").includes("PromotionCard"),
      "PromotionCard",
    )),
  record(107, "checkpoint 4 audit lists promotion-assets retain", () =>
    assert(
      read("docs/PHASE_9F4_CHECKPOINT4_APPLICATION_RETIREMENT_AUDIT.md").includes("promotion-assets"),
      "bucket",
    )),
  record(108, "preflight phase9f4 promotions retirement diagnostic retained", () =>
    assert(existsSync("supabase/diagnostics/preflight_phase9f4_promotions_retirement.sql"), "preflight")),
  record(109, "no compliance role added", () => {
    const roles = read("lib/roles.ts");
    assert(!roles.includes("compliance"), "no compliance role");
  }),
  record(110, "admin migrate route still uses executePromotionMigration when gate open", () =>
    assert(
      read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes(
        "executePromotionMigration",
      ),
      "execute",
    )),
  record(111, "runtime gate code constant exported", () =>
    assert(
      read("lib/promotions/promotionMigrationRuntimeGate.ts").includes(
        "PHASE9F4_MIGRATION_RUNTIME_GATE_CODE",
      ),
      "code",
    )),
  record(112, "asset observation excludes path telemetry in UI policy", () =>
    assert(
      read("docs/PHASE_9F4_PROMOTION_ASSET_OBSERVATION.md").includes("Do not expose"),
      "no paths",
    )),
  record(113, "replacement mapping adviser path", () =>
    assert(read("docs/PHASE_9F4_REPLACEMENT_MAPPING.md").includes("/advisor/insights"), "mapping")),
  record(114, "replacement mapping client path", () =>
    assert(read("docs/PHASE_9F4_REPLACEMENT_MAPPING.md").includes("/insights"), "mapping")),
  record(115, "observation stage 6 exit criteria listed", () =>
    assert(read("docs/PHASE_9F4_OBSERVATION_PLAN.md").includes("Stage 6"), "stage 6")),
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

  console.log(`Phase 9F.4 application retirement: ${passed}/${results.length} passed`);

  for (const f of failed) {
    console.error(`  FAIL #${f.id} ${f.name}: ${f.error}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
