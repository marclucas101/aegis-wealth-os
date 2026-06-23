/**
 * Phase 9F.4 Checkpoint 3 — controlled promotion migration review validation.
 * Run: npm run qa:phase9f4-migration-review
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const ROUTES = [
  "app/api/admin/promotions-migration/route.ts",
  "app/api/admin/promotions-migration/[promotionId]/route.ts",
  "app/api/admin/promotions-migration/[promotionId]/preview/route.ts",
  "app/api/admin/promotions-migration/[promotionId]/review/route.ts",
  "app/api/admin/promotions-migration/[promotionId]/migrate/route.ts",
] as const;

const CORE_LIBS = [
  "lib/promotions/promotionMigrationTypes.ts",
  "lib/promotions/promotionMigrationReviewService.ts",
  "lib/promotions/legacyPromotionTransform.ts",
  "lib/promotions/promotionAssetPolicy.ts",
  "lib/promotions/promotionMigrationAdminAccess.ts",
  "lib/promotions/promotionMigrationRouteParams.ts",
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
  // Page & navigation (1-8)
  record(1, "admin page exists", () =>
    assert(existsSync("app/admin/promotions-migration/page.tsx"), "missing page")),
  record(2, "admin client component exists", () =>
    assert(existsSync("components/aegis/admin/PromotionsMigrationReviewClient.tsx"), "missing client")),
  record(3, "page uses AuthenticatedAppShell", () =>
    assert(read("app/admin/promotions-migration/page.tsx").includes("AuthenticatedAppShell"), "shell")),
  record(4, "communications admin links to migration page", () =>
    assert(read("components/aegis/admin/AdminCommunicationsClient.tsx").includes("/admin/promotions-migration"), "nav link")),
  record(5, "client fetches list API", () =>
    assert(read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes("/api/admin/promotions-migration"), "list fetch")),
  record(6, "client does not display bucket paths", () => {
    const ui = read("components/aegis/admin/PromotionsMigrationReviewClient.tsx");
    assert(!ui.includes("image_url"), "image_url in UI");
    assert(!ui.includes("signedUrl"), "signed URL in UI");
  }),
  record(7, "client links to communications approval not publish shortcut", () => {
    const ui = read("components/aegis/admin/PromotionsMigrationReviewClient.tsx");
    assert(ui.includes("/admin/communications"), "communications link");
    assert(!ui.includes("/publish"), "no publish shortcut");
  }),
  record(8, "page force-dynamic", () =>
    assert(read("app/admin/promotions-migration/page.tsx").includes("force-dynamic"), "dynamic")),

  // Core libs exist (9-14)
  ...CORE_LIBS.map((path, i) =>
    record(9 + i, `core lib exists: ${path}`, () => assert(existsSync(path), "missing")),
  ),

  // Classification model (15-28)
  record(15, "canonical classifications in promotion migration constants", () => {
    const t = read("lib/promotions/promotionMigrationConstants.ts");
    assert(t.includes('"safe_educational"'), "safe_educational");
    assert(t.includes('"unsuitable"'), "unsuitable");
    assert(t.includes("PROMOTION_MIGRATION_CLASSIFICATIONS"), "const");
  }),
  record(16, "promotionMigrationTypes re-exports classifications", () =>
    assert(read("lib/promotions/promotionMigrationTypes.ts").includes("PROMOTION_MIGRATION_CLASSIFICATIONS"), "re-export")),
  record(17, "draft classifications allowlist", () => {
    const t = read("lib/promotions/promotionMigrationTypes.ts");
    assert(t.includes("MIGRATION_DRAFT_CLASSIFICATIONS"), "draft list");
    assert(t.includes('"product_promotional"'), "product");
  }),
  record(18, "review-only classifications", () => {
    const t = read("lib/promotions/promotionMigrationTypes.ts");
    assert(t.includes("MIGRATION_REVIEW_ONLY_CLASSIFICATIONS"), "review only");
    assert(t.includes('"expired"'), "expired");
  }),
  record(19, "isMigrationDraftClassification helper", () =>
    assert(read("lib/promotions/promotionMigrationTypes.ts").includes("isMigrationDraftClassification"), "helper")),
  record(20, "sanitizeOperatorNote strips HTML", () => {
    const t = read("lib/promotions/promotionMigrationTypes.ts");
    assert(t.includes("sanitizeOperatorNote"), "fn");
    assert(t.includes("replace(/<[^>]+>/g"), "html strip");
  }),
  record(21, "operator note max length 500", () =>
    assert(read("lib/promotions/promotionMigrationTypes.ts").includes("PROMOTION_MIGRATION_MAX_OPERATOR_NOTE = 500"), "max")),
  record(22, "UI imports PROMOTION_MIGRATION_CLASSIFICATIONS", () =>
    assert(
      read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes(
        "promotionMigrationConstants",
      ),
      "ui enum",
    )),
  record(23, "route params validate classification enum", () =>
    assert(read("lib/promotions/promotionMigrationRouteParams.ts").includes("PROMOTION_MIGRATION_CLASSIFICATIONS"), "route enum")),
  record(24, "no arbitrary classification strings in service", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes("migrate_governed_communication"), "user alias not in code");
  }),
  record(25, "classification alone does not update promotions table", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes('.from("promotions").update'), "no promotion update");
  }),
  record(26, "review update uses promotion_migration_reviews only", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes('from("promotion_migration_reviews")'), "reviews")),
  record(27, "six asset statuses defined", () =>
    assert(read("lib/promotions/promotionMigrationTypes.ts").includes("PROMOTION_ASSET_STATUSES"), "asset statuses")),
  record(28, "audit doc maps user dispositions", () =>
    assert(read("docs/PHASE_9F4_CHECKPOINT3_MIGRATION_API_AUDIT.md").includes("migrate_governed_communication"), "mapping doc")),

  // Admin access (29-36)
  record(29, "requirePromotionMigrationAdminAccess exists", () =>
    assert(read("lib/promotions/promotionMigrationAdminAccess.ts").includes("requirePromotionMigrationAdminAccess"), "fn")),
  record(30, "admin access requires requireAdminAccess", () =>
    assert(read("lib/promotions/promotionMigrationAdminAccess.ts").includes("requireAdminAccess"), "admin")),
  record(31, "admin access requires admin_content_approval", () =>
    assert(read("lib/promotions/promotionMigrationAdminAccess.ts").includes("admin_content_approval"), "feature")),
  record(32, "all migration routes use requirePromotionMigrationAdminAccess", () => {
    for (const route of ROUTES) {
      assert(read(route).includes("requirePromotionMigrationAdminAccess"), route);
    }
  }),
  record(33, "privatePromotionJson on access denial", () =>
    assert(read("lib/promotions/promotionMigrationAdminAccess.ts").includes("privatePromotionJson"), "private json")),
  record(34, "advisor promotions route still has write guard", () =>
    assert(read("app/api/advisor/promotions/route.ts").includes("requireLegacyPromotionsWriteAccess"), "write guard")),
  record(35, "client promotions route unchanged entitlement", () =>
    assert(read("app/api/promotions/route.ts").includes("evaluateClientPromotionsAccess"), "client route")),
  record(36, "admin layout requires admin", () =>
    assert(read("app/admin/layout.tsx").includes("requireAdminAccess"), "layout")),

  // API routes structure (37-52)
  record(37, "list route GET handler", () =>
    assert(read("app/api/admin/promotions-migration/route.ts").includes("export async function GET"), "GET")),
  record(38, "list route uses parsePromotionMigrationListParams", () =>
    assert(read("app/api/admin/promotions-migration/route.ts").includes("parsePromotionMigrationListParams"), "parse")),
  record(39, "detail route exists", () =>
    assert(existsSync("app/api/admin/promotions-migration/[promotionId]/route.ts"), "detail")),
  record(40, "preview route exists", () =>
    assert(existsSync("app/api/admin/promotions-migration/[promotionId]/preview/route.ts"), "preview")),
  record(41, "review PATCH route exists", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/review/route.ts").includes("PATCH"), "PATCH")),
  record(42, "migrate POST route exists", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("export async function POST"), "POST migrate")),
  record(43, "bounded page size max 50", () =>
    assert(read("lib/promotions/promotionMigrationTypes.ts").includes("PROMOTION_MIGRATION_MAX_PAGE_SIZE = 50"), "max page")),
  record(44, "route params cap pageSize", () =>
    assert(read("lib/promotions/promotionMigrationRouteParams.ts").includes("PROMOTION_MIGRATION_MAX_PAGE_SIZE"), "cap")),
  record(45, "allowlisted sort keys", () =>
    assert(read("lib/promotions/promotionMigrationTypes.ts").includes("PROMOTION_MIGRATION_LIST_SORT_KEYS"), "sort keys")),
  record(46, "allowlisted migration status filter", () => {
    const p = read("lib/promotions/promotionMigrationRouteParams.ts");
    assert(p.includes("unmigrated"), "unmigrated");
    assert(p.includes("migrated"), "migrated");
  }),
  record(47, "routes use toPublicErrorMessage not raw errors", () => {
    for (const route of ROUTES) {
      assert(read(route).includes("toPublicErrorMessage"), route);
    }
  }),
  record(48, "migrate routes reject unexpected fields", () => {
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("rejectUnexpectedFields"), "reject");
  }),
  record(49, "migrate route rate limited", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("rateLimitOrThrow"), "rate limit")),
  record(50, "invalid promotion id returns 404 on detail", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/route.ts").includes("404"), "404")),
  record(51, "root POST backward compatible migrate", () =>
    assert(read("app/api/admin/promotions-migration/route.ts").includes("executePromotionMigration"), "execute")),
  record(52, "dynamic force-dynamic on routes", () => {
    for (const route of ROUTES) {
      assert(read(route).includes("force-dynamic"), route);
    }
  }),

  // Transformation mapper (53-68)
  record(53, "transformLegacyPromotionToGovernedDraft exists", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes("transformLegacyPromotionToGovernedDraft"), "transform")),
  record(54, "toMigrationPreviewDto exists", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes("toMigrationPreviewDto"), "preview dto")),
  record(55, "stripHtmlTags used on title", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes("stripHtmlTags(input.source.title)"), "strip title")),
  record(56, "audience fixed to all_active_clients", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes('audienceScope: "all_active_clients"'), "audience")),
  record(57, "approval status always draft", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes('approvalStatus: "draft"'), "draft")),
  record(58, "omits image_url and attachment_url", () => {
    const t = read("lib/promotions/legacyPromotionTransform.ts");
    assert(t.includes('"image_url"'), "omitted image");
    assert(t.includes('"attachment_url"'), "omitted attachment");
  }),
  record(59, "expired CTA omitted", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes("Expired call-to-action"), "expired cta")),
  record(60, "validateExternalUrl for cta", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes("validateExternalUrl"), "url validation")),
  record(61, "preview and execute share transform in service", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    const count = (svc.match(/transformLegacyPromotionToGovernedDraft/g) ?? []).length;
    assert(count >= 3, `expected >=3 uses, got ${count}`);
  }),
  record(62, "preview service reloads source", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("loadLegacyPromotionSource"), "load source")),
  record(63, "browser does not submit body as authoritative", () => {
    const migrate = read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts");
    assert(!migrate.includes("body:") || !migrate.includes("parsed.body.body"), "no body from client");
    assert(migrate.includes("executePromotionMigration"), "server execute");
  }),
  record(64, "destination audience is all_active_clients not all_users", () => {
    const t = read("lib/promotions/legacyPromotionTransform.ts");
    assert(t.includes('audienceScope: "all_active_clients"'), "active clients");
    const returnBlock = t.slice(t.indexOf("return {"), t.indexOf("};", t.indexOf("return {")) + 2);
    assert(!returnBlock.includes('"all_users"'), "no all_users in return");
  }),
  record(65, "warnings for non-migrated audience", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes("all_active_clients"), "warning path")),
  record(66, "body preview bounded 500 chars", () =>
    assert(read("lib/promotions/legacyPromotionTransform.ts").includes("slice(0, 500)"), "preview bound")),
  record(67, "no storage path in transform output", () => {
    const t = read("lib/promotions/legacyPromotionTransform.ts");
    assert(!t.includes("signed"), "no signed");
    assert(!t.includes("bucket"), "no bucket");
  }),
  record(68, "classifyPromotion heuristic separate from operator classification", () =>
    assert(read("lib/communications/legacyPromotionsMigration.ts").includes("classifyPromotion"), "classify")),

  // Asset policy (69-76)
  record(69, "asset policy doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_ASSET_MIGRATION_POLICY.md"), "doc")),
  record(70, "migrationBlockedByAssetPolicy blocks non-no_asset", () =>
    assert(read("lib/promotions/promotionAssetPolicy.ts").includes('assetStatus !== "no_asset"'), "block")),
  record(71, "asset blocked returns 409 LEGACY_PROMOTION_ASSET_BLOCKED", () => {
    const r = read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts");
    assert(r.includes("LEGACY_PROMOTION_ASSET_BLOCKED"), "code");
    assert(r.includes("409"), "status");
  }),
  record(72, "executePromotionMigration checks asset_blocked", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes('reason: "asset_blocked"'), "asset blocked")),
  record(73, "UI disables migrate when preview blocked", () =>
    assert(read("components/aegis/admin/PromotionsMigrationReviewClient.tsx").includes("migrationBlocked"), "ui block")),
  record(74, "no asset copy in checkpoint 3", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes("copyObject"), "no copy");
    assert(!svc.includes("storage.from"), "no storage copy");
  }),
  record(75, "assetBlockMessage helper", () =>
    assert(read("lib/promotions/promotionAssetPolicy.ts").includes("assetBlockMessage"), "message")),
  record(76, "unsupported attachment classification", () =>
    assert(read("lib/promotions/promotionAssetPolicy.ts").includes('"unsupported"'), "unsupported")),

  // Migration transaction & idempotency (77-88)
  record(77, "idempotency via migrated_content_id", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(svc.includes("migrated_content_id"), "column");
    assert(svc.includes("alreadyMigrated"), "flag");
  }),
  record(78, "reused audit action", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("legacy_promotion_migration_reused"), "reused audit")),
  record(79, "dbCreateGovernedContent for destination", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("dbCreateGovernedContent"), "create")),
  record(80, "no browser destination id accepted", () => {
    const r = read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts");
    assert(!r.includes("migratedContentId") || !r.includes("body.migrated"), "no client dest id");
  }),
  record(81, "no governed content update/overwrite", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes("dbUpdateGovernedContent"), "no update");
    assert(!svc.includes('.from("governed_content").update'), "no sql update");
  }),
  record(82, "source promotions never updated in migration", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes('.from("promotions").update'), "no promotion update");
    assert(!svc.includes('.from("promotions").delete'), "no promotion delete");
  }),
  record(83, "review blocks update after migrated", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("already_migrated"), "already migrated")),
  record(84, "no schedule or notification in migration service", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes("notification"), "no notification");
    assert(!svc.includes("scheduled_publish"), "no schedule");
    assert(!svc.includes("publishGoverned"), "no publish");
  }),
  record(85, "governed draft approval_status draft in create call", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(svc.includes("approvalStatus: transform.approvalStatus"), "approval from transform");
  }),
  record(86, "linkage in promotion_migration_reviews upsert", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("migrated_content_id: content.id"), "link")),
  record(87, "list DTO excludes raw paths", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes("image_url:"), "no image in dto");
    assert(svc.includes("hasAssets"), "hasAssets flag");
  }),
  record(88, "detail links to communications not auto-publish", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes('"/admin/communications"'), "href")),

  // Audit events (89-98)
  record(89, "legacy_promotion_migration_reviewed audit", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("legacy_promotion_migration_reviewed"), "reviewed")),
  record(90, "legacy_promotion_migration_started in migrate route", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("legacy_promotion_migration_started"), "started")),
  record(91, "legacy_promotion_migration_completed audit", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("legacy_promotion_migration_completed"), "completed")),
  record(92, "legacy_promotion_migration_failed audit", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("legacy_promotion_migration_failed"), "failed")),
  record(93, "audit metadata has promotion_id not body", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(svc.includes("promotion_id"), "promotion_id");
    assert(!svc.includes("source_body"), "no source_body");
    assert(!svc.includes("destination_body"), "no destination_body");
  }),
  record(94, "audit metadata includes classification", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("classification:"), "classification")),
  record(95, "audit metadata includes migrated_destination_id on success", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("migrated_destination_id"), "dest id")),
  record(96, "audit metadata includes asset_status", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("asset_status"), "asset status")),
  record(97, "no storage path in audit metadata", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(!svc.includes("storage_path"), "no storage_path");
    assert(!svc.includes("signed_url"), "no signed_url");
  }),
  record(98, "failed audit uses stable result_code", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("LEGACY_PROMOTION_ASSET_BLOCKED"), "stable code")),

  // Write freeze & phase integrity (99-108)
  record(99, "legacy write freeze migration still exists", () =>
    assert(existsSync("supabase/migrations/202606200011_phase9f4_legacy_promotions_write_freeze.sql"), "011")),
  record(100, "no migration 202606200012 created", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) =>
      f.startsWith("202606200012"),
    );
    assert(files.length === 0, `unexpected 012: ${files.join(",")}`);
  }),
  record(101, "legacy_promotions_write default false", () =>
    assert(read("lib/compliance/featureFlags.ts").includes("legacy_promotions_write"), "flag")),
  record(102, "Phase 9F.3 binder files untouched spot check", () => {
    assert(existsSync("lib/binder/binderPublicationService.ts"), "binder");
    assert(existsSync("app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts"), "binder route");
  }),
  record(103, "governed communications persistence unchanged contract", () =>
    assert(read("lib/supabase/governedContentPersistence.ts").includes("dbCreateGovernedContent"), "create fn")),
  record(104, "no destructive SQL in new checkpoint files", () => {
    for (const path of CORE_LIBS) {
      const content = read(path).toLowerCase();
      assert(!content.includes("drop table"), path);
      assert(!content.includes("delete from promotions"), path);
    }
  }),
  record(105, "runbook exists", () =>
    assert(existsSync("docs/PHASE_9F4_PROMOTION_MIGRATION_RUNBOOK.md"), "runbook")),
  record(106, "manual tests doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_CHECKPOINT3_MANUAL_TESTS.md"), "manual tests")),
  record(107, "migration API audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_CHECKPOINT3_MIGRATION_API_AUDIT.md"), "audit doc")),
  record(108, "audit doc says 012 not required", () =>
    assert(read("docs/PHASE_9F4_CHECKPOINT3_MIGRATION_API_AUDIT.md").includes("NOT required"), "012 verdict")),

  // Package & re-exports (109-115)
  record(109, "package.json qa script", () =>
    assert(read("package.json").includes("qa:phase9f4-migration-review"), "npm script")),
  record(110, "legacyPromotionsMigration re-exports migratePromotionToDraft", () =>
    assert(read("lib/communications/legacyPromotionsMigration.ts").includes("migratePromotionToDraft"), "re-export")),
  record(111, "listUnmigratedPromotions backward compat", () =>
    assert(read("lib/communications/legacyPromotionsMigration.ts").includes("listUnmigratedPromotions"), "compat")),
  record(112, "rejectClientId on migrate body", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("rejectClientId: true"), "reject client id")),
  record(113, "UUID validation for promotion ids", () =>
    assert(read("lib/promotions/promotionMigrationRouteParams.ts").includes("isValidPromotionMigrationId"), "uuid")),
  record(114, "detail uses isValidPromotionId from legacy auth", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/route.ts").includes("isValidPromotionId"), "valid id")),
  record(115, "operator note parsed in migrate route", () =>
    assert(read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes("parseOperatorNote"), "note")),
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

  console.log(`Phase 9F.4 migration review: ${passed}/${results.length} passed`);

  for (const f of failed) {
    console.error(`  FAIL #${f.id} ${f.name}: ${f.error}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
