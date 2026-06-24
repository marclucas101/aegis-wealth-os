/**
 * Phase 9F.4 Checkpoint 3 — controlled promotion migration review validation.
 * Run: npm run qa:phase9f4-migration-review
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { legacyPromotionMigrationDestinationId } from "../lib/promotions/promotionMigrationIdempotency";

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
  record(77, "idempotency via migrated_content_id and atomic RPC", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(svc.includes("migrated_content_id"), "column refs");
    assert(svc.includes("executeAtomicLegacyPromotionMigration"), "atomic rpc");
  }),
  record(78, "reused and orphan recovered audit actions", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(svc.includes("legacy_promotion_migration_reused"), "reused audit");
    assert(svc.includes("legacy_promotion_migration_orphan_recovered"), "orphan audit");
  }),
  record(79, "atomic RPC persistence wrapper", () =>
    assert(read("lib/promotions/promotionMigrationPersistence.ts").includes("execute_legacy_promotion_migration"), "rpc")),
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
  record(85, "migration uses transform approvalStatus draft", () => {
    const transform = read("lib/promotions/legacyPromotionTransform.ts");
    assert(transform.includes('approvalStatus: "draft"'), "draft");
  }),
  record(86, "atomic migration SQL links review in same transaction", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("promotion_migration_reviews"), "review table");
    assert(sql.includes("migrated_content_id"), "linkage");
  }),
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
  record(100, "migration 202606200012 idempotency exists", () =>
    assert(
      existsSync("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql"),
      "012 migration",
    )),
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
  record(108, "idempotency migration uses advisory lock", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("pg_advisory_xact_lock"), "advisory lock");
    assert(sql.includes("uuid_generate_v5"), "deterministic id");
  }),

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

  // Checkpoint 3.1 idempotency (116-140)
  record(116, "deterministic destination id helper", () =>
    assert(
      read("lib/promotions/promotionMigrationIdempotency.ts").includes(
        "legacyPromotionMigrationDestinationId",
      ),
      "helper",
    )),
  record(117, "source key uses legacy_promotion prefix", () =>
    assert(
      read("lib/promotions/promotionMigrationIdempotency.ts").includes("legacy_promotion:"),
      "prefix",
    )),
  record(118, "stable migration outcomes defined", () => {
    const t = read("lib/promotions/promotionMigrationIdempotency.ts");
    assert(t.includes('"recovered_orphan"'), "recovered_orphan");
    assert(t.includes('"already_migrated"'), "already_migrated");
    assert(t.includes('"conflict"'), "conflict");
  }),
  record(119, "service returns outcome field", () =>
    assert(read("lib/promotions/promotionMigrationReviewService.ts").includes("outcome:"), "outcome")),
  record(120, "failed linkage not reported as success", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(svc.includes("if (!atomic.ok)"), "atomic failure branch");
    assert(!svc.includes("throw new Error(\"Failed to link migration review\")"), "no false success");
  }),
  record(121, "no dbCreateGovernedContent in migration service", () =>
    assert(!read("lib/promotions/promotionMigrationReviewService.ts").includes("dbCreateGovernedContent"), "no direct create")),
  record(122, "RPC grants service_role only", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("GRANT EXECUTE"), "grant");
    assert(sql.includes("service_role"), "service role");
    assert(sql.includes("REVOKE ALL"), "revoke public");
  }),
  record(123, "RPC uses ON CONFLICT for governed_content id", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("ON CONFLICT (id) DO NOTHING"), "conflict safe insert");
  }),
  record(124, "RPC orphan recovery branch", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("recovered_orphan"), "orphan outcome");
  }),
  record(125, "RPC linkage_failed outcome", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("linkage_failed"), "linkage failed");
  }),
  record(126, "cross-promotion id uses promotion_id in v5 name", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("'legacy_promotion:' || p_promotion_id::text"), "per-promotion key");
  }),
  record(127, "browser cannot pass destination id to RPC wrapper", () => {
    const p = read("lib/promotions/promotionMigrationPersistence.ts");
    assert(!p.includes("p_destination_id"), "no client dest param");
    assert(p.includes("p_promotion_id"), "server promotion id only");
  }),
  record(128, "browser cannot pass idempotency key", () => {
    const routes = [
      "app/api/admin/promotions-migration/[promotionId]/migrate/route.ts",
      "lib/promotions/promotionMigrationRouteParams.ts",
    ];
    for (const route of routes) {
      const src = read(route);
      assert(!src.includes("idempotencyKey"), route);
      assert(!src.includes("destinationId"), route);
    }
  }),
  record(129, "migrate route handles conflict response", () =>
    assert(
      read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes(
        "LEGACY_PROMOTION_MIGRATION_CONFLICT",
      ),
      "conflict",
    )),
  record(130, "migrate route handles failed response", () =>
    assert(
      read("app/api/admin/promotions-migration/[promotionId]/migrate/route.ts").includes(
        "LEGACY_PROMOTION_MIGRATION_FAILED",
      ),
      "failed",
    )),
  record(131, "deterministic destination id is stable for same promotion", () => {
    const sample = "11111111-1111-4111-8111-111111111111";
    const a = legacyPromotionMigrationDestinationId(sample);
    const b = legacyPromotionMigrationDestinationId(sample);
    assert(a === b, "stable");
    assert(
      a !== legacyPromotionMigrationDestinationId("22222222-2222-4222-8222-222222222222"),
      "unique per promotion",
    );
  }),
  record(132, "deterministic id differs across promotions", () => {
    const a = legacyPromotionMigrationDestinationId("11111111-1111-4111-8111-111111111111");
    const b = legacyPromotionMigrationDestinationId("22222222-2222-4222-8222-222222222222");
    assert(a !== b, "cross-promotion isolation");
  }),
  record(133, "review-only RPC path has review_only outcome", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("'outcome', 'review_only'"), "review only outcome");
  }),
  record(134, "asset block remains before RPC in service", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    const fn = svc.slice(svc.indexOf("export async function executePromotionMigration"));
    const assetIdx = fn.indexOf("transform.migrationBlocked");
    const rpcIdx = fn.indexOf("await executeAtomicLegacyPromotionMigration");
    assert(assetIdx > 0 && rpcIdx > assetIdx, "asset check before rpc");
  }),
  record(135, "external_source_name legacy_promotion in RPC insert", () =>
    assert(
      read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").includes(
        "'legacy_promotion'",
      ),
      "source marker",
    )),
  record(136, "governed draft approval_status draft in RPC", () =>
    assert(
      read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").includes(
        "'draft'",
      ),
      "draft status",
    )),
  record(137, "no notification or schedule in idempotency migration", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").toLowerCase();
    assert(!sql.includes("client_notifications"), "no notifications");
    assert(!sql.includes("scheduled_at"), "no schedule");
    assert(!sql.includes("published_at"), "no publish");
  }),
  record(138, "012 migration is additive only", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").toLowerCase();
    assert(!sql.includes("drop table"), "no drop");
    assert(!sql.includes("delete from promotions"), "no delete promotions");
  }),
  record(139, "012 follows 011 in chain", () => {
    const stamps = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0])
      .sort();
    assert(stamps.indexOf("202606200012") === stamps.indexOf("202606200011") + 1, "ordering");
  }),
  record(140, "checkpoint 3.1 idempotency audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_CHECKPOINT31_IDEMPOTENCY.md"), "doc")),

  // Migration 012 release gate (141-160)
  record(141, "012 preflight diagnostic exists", () =>
    assert(existsSync("supabase/diagnostics/preflight_202606200012_phase9f4.sql"), "preflight")),
  record(142, "012 verify diagnostic exists", () =>
    assert(
      existsSync("supabase/diagnostics/verify_202606200012_phase9f4_promotion_migration_idempotency.sql"),
      "verify",
    )),
  record(143, "012 discrepancies diagnostic exists", () =>
    assert(existsSync("supabase/diagnostics/verify_202606200012_phase9f4_discrepancies.sql"), "discrepancies")),
  record(144, "012 preflight probes typed output columns", () => {
    const sql = read("supabase/diagnostics/preflight_202606200012_phase9f4.sql");
    assert(sql.includes("probes (probe_id, classification, detail) AS ("), "typed probes");
    assert(/SELECT\s+probe_id\s*,\s*classification\s*,\s*detail\s+FROM\s+probes/i.test(sql), "final select");
  }),
  record(145, "012 verify exact-match verdict row", () =>
    assert(
      read("supabase/diagnostics/verify_202606200012_phase9f4_promotion_migration_idempotency.sql").includes(
        "overall.exact_match_verdict",
      ),
      "verdict",
    )),
  record(146, "012 discrepancies filter non-match only", () =>
    assert(
      read("supabase/diagnostics/verify_202606200012_phase9f4_discrepancies.sql").includes(
        "WHERE COALESCE(classification, 'unknown') <> 'match'",
      ),
      "filter",
    )),
  record(147, "012 migration fixed search_path on RPC", () =>
    assert(
      read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").includes(
        "SET search_path = public",
      ),
      "search_path",
    )),
  record(148, "012 migration revokes anon execute", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("FROM anon"), "revoke anon");
    assert(!sql.includes("GRANT EXECUTE") || sql.includes("TO service_role"), "service_role only grant");
  }),
  record(149, "012 migration revokes authenticated execute", () =>
    assert(
      read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").includes(
        "FROM authenticated",
      ),
      "revoke authenticated",
    )),
  record(150, "012 migration schema-qualified table references", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("public.promotion_migration_reviews"), "reviews");
    assert(sql.includes("public.governed_content"), "governed");
    assert(sql.includes("public.legacy_promotion_migration_destination_id"), "destination fn");
  }),
  record(151, "012 migration no destructive DDL", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").toLowerCase();
    assert(!sql.includes("drop table"), "no drop table");
    assert(!sql.includes("truncate "), "no truncate");
    assert(!sql.includes("delete from promotions"), "no delete promotions");
  }),
  record(152, "012 migration no dynamic SQL", () => {
    const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql").toLowerCase();
    assert(!sql.includes("execute format"), "no dynamic sql");
    assert(!sql.includes("execute immediate"), "no execute immediate");
  }),
  record(153, "RPC security audit doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_MIGRATION_012_RPC_SECURITY_AUDIT.md"), "audit doc")),
  record(154, "persistence uses admin service role client", () => {
    const p = read("lib/promotions/promotionMigrationPersistence.ts");
    assert(p.includes("createAdminSupabaseClient"), "admin client");
    assert(p.includes('import "server-only"'), "server only");
    assert(p.includes('.rpc("execute_legacy_promotion_migration"'), "rpc name");
  }),
  record(155, "admin supabase client uses service role key", () => {
    const admin = read("lib/supabase/admin.ts");
    assert(admin.includes("getSupabaseServiceRoleKey"), "service role key helper");
    assert(admin.includes("createAdminSupabaseClient"), "admin client export");
  }),
  record(156, "012 preflight checks 011 applied and 012 pending", () => {
    const sql = read("supabase/diagnostics/preflight_202606200012_phase9f4.sql");
    assert(sql.includes("202606200011"), "011");
    assert(sql.includes("202606200012"), "012");
    assert(sql.includes("pending"), "pending wording");
  }),
  record(157, "012 verify checks service_role grant and denies anon/authenticated", () => {
    const sql = read("supabase/diagnostics/verify_202606200012_phase9f4_promotion_migration_idempotency.sql");
    assert(sql.includes("grants.service_role_execute_migration_rpc"), "service_role");
    assert(sql.includes("grants.anon_no_execute_migration_rpc"), "anon deny");
    assert(sql.includes("grants.authenticated_no_execute_migration_rpc"), "authenticated deny");
  }),
  record(158, "012 preflight avoids promotion body exposure", () => {
    const sql = read("supabase/diagnostics/preflight_202606200012_phase9f4.sql").toLowerCase();
    assert(!/\bfrom\s+promotions\b/.test(sql), "no promotions table read");
    assert(!sql.includes("promotions.body"), "no promotion body column");
  }),
  record(159, "012 migration remains pending in drift list", () => {
    const drift = read("scripts/classify-migration-drift.ts");
    assert(drift.includes('version: "202606200012"'), "pending version");
  }),
  record(160, "012 verify checks write-freeze still disabled", () =>
    assert(
      read("supabase/diagnostics/verify_202606200012_phase9f4_promotion_migration_idempotency.sql").includes(
        "legacy_promotions_write_still_disabled",
      ),
      "write freeze",
    )),
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
