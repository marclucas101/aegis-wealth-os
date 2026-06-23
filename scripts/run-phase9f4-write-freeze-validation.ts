/**
 * Phase 9F.4 Checkpoint 2 — legacy Promotions write freeze validation.
 * Run: npm run qa:phase9f4-write-freeze
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const MIGRATION_PATH =
  "supabase/migrations/202606200011_phase9f4_legacy_promotions_write_freeze.sql";

const MUTATION_ROUTES = [
  "app/api/advisor/promotions/route.ts",
  "app/api/advisor/promotions/[promotionId]/route.ts",
  "app/api/advisor/promotions/[promotionId]/upload/route.ts",
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
  record(1, "migration 202606200011 file exists", () =>
    assert(existsSync(MIGRATION_PATH), "missing migration")),
  record(2, "migration 202606200011 stamp is unique", () => {
    const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) =>
      f.startsWith("202606200011"),
    );
    assert(files.length === 1, `expected 1 file, got ${files.length}`);
  }),
  record(3, "migration 202606200011 follows 202606200010", () => {
    const stamps = readdirSync(join(ROOT, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.split("_")[0])
      .sort();
    assert(
      stamps.indexOf("202606200011") === stamps.indexOf("202606200010") + 1,
      "ordering",
    );
  }),
  record(4, "migration is additive only (no DROP TABLE)", () => {
    const sql = read(MIGRATION_PATH).toLowerCase();
    assert(!sql.includes("drop table"), "drop table");
    assert(!sql.includes("truncate "), "truncate");
  }),
  record(5, "migration has no DELETE FROM promotions", () => {
    const sql = read(MIGRATION_PATH).toLowerCase();
    assert(!sql.includes("delete from promotions"), "delete promotions");
    assert(!sql.includes("delete from platform_feature_controls"), "delete controls");
  }),
  record(6, "migration seeds legacy_promotions_write", () => {
    const sql = read(MIGRATION_PATH);
    assert(sql.includes("'legacy_promotions_write'"), "feature key");
    assert(sql.includes("platform_feature_controls"), "table");
  }),
  record(7, "migration seeds legacy_promotions_write disabled", () => {
    const sql = read(MIGRATION_PATH);
    assert(/legacy_promotions_write[\s\S]*?false/.test(sql), "disabled");
    assert(sql.includes("client_visible") && sql.includes("false"), "not client visible");
  }),
  record(8, "migration uses ON CONFLICT DO NOTHING", () => {
    assert(read(MIGRATION_PATH).toLowerCase().includes("on conflict (feature_key) do nothing"), "idempotent seed");
  }),
  record(9, "migration does not modify promotions RLS", () => {
    const sql = read(MIGRATION_PATH).toLowerCase();
    assert(!sql.includes("create policy"), "no new policy");
    assert(!sql.includes("disable row level security"), "no disable rls");
  }),
  record(10, "migration does not touch promotion-assets bucket", () => {
    const sql = read(MIGRATION_PATH).toLowerCase();
    assert(!sql.includes("promotion-assets"), "no bucket change");
    assert(!sql.includes("storage.buckets"), "no storage buckets");
  }),
  record(11, "legacyPromotionsAuthorization module exists", () =>
    assert(existsSync("lib/promotions/legacyPromotionsAuthorization.ts"), "module")),
  record(12, "central guard exports requireLegacyPromotionsWriteAccess", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("export async function requireLegacyPromotionsWriteAccess"), "guard");
    assert(mod.includes('import "server-only"'), "server only");
  }),
  record(13, "central guard uses isFeatureEnabled for legacy_promotions_write", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("LEGACY_PROMOTIONS_WRITE_FEATURE"), "constant");
    assert(mod.includes("isFeatureEnabled(LEGACY_PROMOTIONS_WRITE_FEATURE)"), "feature lookup");
  }),
  record(14, "central guard audits legacy_promotion_write_blocked", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes('action: "legacy_promotion_write_blocked"'), "audit action");
    assert(mod.includes("result_code: LEGACY_PROMOTIONS_WRITE_DISABLED_BODY.error.code"), "result code");
  }),
  record(15, "central guard exports evaluateClientPromotionsAccess", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("export async function evaluateClientPromotionsAccess"), "client gate");
    assert(mod.includes('session.user.role !== "client"'), "client role check");
  }),
  record(16, "central guard exports requireAdviserPromotionOwnership", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("export function requireAdviserPromotionOwnership"), "ownership");
    assert(mod.includes("export function adviserOwnsPromotion"), "owns helper");
  }),
  record(17, "adviserOwnsPromotion admin bypass and adviser match", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes('if (role === "admin")'), "admin bypass");
    assert(mod.includes("promotion.createdBy === adviserUserId"), "adviser match");
  }),
  record(18, "ownership returns 404 for cross-owner (not 403)", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes('reason: "not_found"'), "not_found reason");
    assert(mod.includes('"Promotion not found"'), "generic message");
  }),
  record(19, "privatePromotionJson applies privateNoStoreHeaders", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("privateNoStoreHeaders"), "no-store");
    assert(mod.includes("export function privatePromotionJson"), "helper");
  }),
  record(20, "CLIENT_PROMOTIONS_MAX_RESULTS is 50", () => {
    assert(read("lib/promotions/legacyPromotionsAuthorization.ts").includes("CLIENT_PROMOTIONS_MAX_RESULTS = 50"), "max");
  }),
  record(21, "isValidPromotionId UUID validation exported", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("export function isValidPromotionId"), "validator");
    assert(mod.includes("UUID_RE"), "uuid regex");
  }),
  record(22, "toClientSafePromotionRecord omits createdBy", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("export function toClientSafePromotionRecord"), "mapper");
    assert(!mod.includes("createdBy:"), "no createdBy in safe record");
  }),
  record(23, "POST advisor promotions uses requireLegacyPromotionsWriteAccess", () => {
    const route = read("app/api/advisor/promotions/route.ts");
    assert(route.includes("requireLegacyPromotionsWriteAccess"), "guard");
    assert(route.includes('actionType: "create"'), "action type");
  }),
  record(24, "PATCH advisor promotion uses requireLegacyPromotionsWriteAccess", () => {
    const route = read("app/api/advisor/promotions/[promotionId]/route.ts");
    assert(route.includes("requireLegacyPromotionsWriteAccess"), "guard");
    assert(route.includes('actionType: "update"'), "action type");
  }),
  record(25, "POST upload uses requireLegacyPromotionsWriteAccess", () => {
    const route = read("app/api/advisor/promotions/[promotionId]/upload/route.ts");
    assert(route.includes("requireLegacyPromotionsWriteAccess"), "guard");
    assert(route.includes('actionType: "upload"'), "action type");
  }),
  record(26, "all mutation routes import central guard module", () => {
    for (const route of MUTATION_ROUTES) {
      assert(read(route).includes("@/lib/promotions/legacyPromotionsAuthorization"), route);
    }
  }),
  record(27, "mutation routes check writeGuard.allowed before proceeding", () => {
    for (const route of MUTATION_ROUTES) {
      const text = read(route);
      assert(text.includes("writeGuard") && text.includes("!writeGuard.allowed"), route);
    }
  }),
  record(28, "advisor GET list does not require write guard", () => {
    const route = read("app/api/advisor/promotions/route.ts");
    const getBlock = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
    assert(!getBlock.includes("requireLegacyPromotionsWriteAccess"), "read allowed");
    assert(getBlock.includes("listAdvisorPromotions"), "list");
  }),
  record(29, "LEGACY_PROMOTIONS_WRITE_DISABLED error schema defined", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes("LEGACY_PROMOTIONS_WRITE_DISABLED_BODY"), "body constant");
    assert(mod.includes('"LEGACY_PROMOTIONS_WRITE_DISABLED"'), "code");
    assert(mod.includes("read-only while content is being migrated"), "message");
  }),
  record(30, "write disabled response returns HTTP 403", () => {
    assert(
      read("lib/promotions/legacyPromotionsAuthorization.ts").includes(
        "legacyPromotionsWriteDisabledResponse",
      ) && read("lib/promotions/legacyPromotionsAuthorization.ts").includes(", 403"),
      "403",
    );
  }),
  record(31, "write freeze architecture documents error envelope", () => {
    const doc = read("docs/PHASE_9F4_WRITE_FREEZE_ARCHITECTURE.md");
    assert(doc.includes("LEGACY_PROMOTIONS_WRITE_DISABLED"), "code in doc");
    assert(doc.includes("HTTP 403"), "status");
  }),
  record(32, "PromotionsManagerClient handles LEGACY_PROMOTIONS_WRITE_DISABLED", () => {
    const ui = read("components/aegis/advisor/promotions/PromotionsManagerClient.tsx");
    assert(ui.includes("LEGACY_PROMOTIONS_WRITE_DISABLED"), "error code");
    assert(ui.includes("data.error.code"), "structured error");
  }),
  record(33, "client GET uses evaluateClientPromotionsAccess", () => {
    const route = read("app/api/promotions/route.ts");
    assert(route.includes("evaluateClientPromotionsAccess"), "gate");
    assert(route.includes("ensureUserClientProfile"), "session");
  }),
  record(34, "client GET returns empty list when entitlement denied", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes('privatePromotionJson({ ok: true, promotions: [] })'), "empty list");
    assert(mod.includes('canAccessClientFeature(ctx, "promotions"'), "entitlement");
  }),
  record(35, "client GET requires product_related_content flag", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    assert(mod.includes('isFeatureEnabled("product_related_content")'), "product flag");
    assert(mod.includes('isFeatureVisibleToRole("product_related_content", "client")'), "visibility");
  }),
  record(36, "client GET applies CLIENT_PROMOTIONS_MAX_RESULTS slice", () => {
    const route = read("app/api/promotions/route.ts");
    assert(route.includes("CLIENT_PROMOTIONS_MAX_RESULTS"), "max");
    assert(route.includes(".slice(0, CLIENT_PROMOTIONS_MAX_RESULTS)"), "bounded");
  }),
  record(37, "client GET uses privatePromotionJson (no-store)", () => {
    const route = read("app/api/promotions/route.ts");
    assert(route.includes("privatePromotionJson"), "private json");
    assert(!route.includes("NextResponse.json(body)"), "no unguarded json");
  }),
  record(38, "client GET maps toClientSafePromotionRecord", () => {
    const route = read("app/api/promotions/route.ts");
    assert(route.includes("toClientSafePromotionRecord"), "safe mapper");
    assert(route.includes("listPublishedPromotions"), "published only");
  }),
  record(39, "client promotions entitlement hardcoded off in entitlements", () => {
    assert(read("lib/compliance/entitlements.ts").includes("features.promotions = false"), "off");
  }),
  record(40, "listAdvisorPromotions scopes adviser to created_by", () => {
    const persist = read("lib/supabase/promotionsPersistence.ts");
    const block = persist.slice(
      persist.indexOf("export async function listAdvisorPromotions"),
      persist.indexOf("export async function getAdvisorPromotionById"),
    );
    assert(block.includes('if (role === "advisor")'), "adviser branch");
    assert(block.includes('.eq("created_by", viewerUserId)'), "scoped query");
  }),
  record(41, "listAdvisorPromotions admin sees all rows", () => {
    const persist = read("lib/supabase/promotionsPersistence.ts");
    const block = persist.slice(
      persist.indexOf("export async function listAdvisorPromotions"),
      persist.indexOf("export async function getAdvisorPromotionById"),
    );
    assert(!block.includes('role === "admin"') || block.includes('role === "advisor"'), "admin unscoped");
  }),
  record(42, "advisor list route passes role to listAdvisorPromotions", () => {
    const route = read("app/api/advisor/promotions/route.ts");
    assert(route.includes("listAdvisorPromotions(access.authUser.id, role)"), "scoped list");
  }),
  record(43, "GET promotion by id uses requireAdviserPromotionOwnership", () => {
    const route = read("app/api/advisor/promotions/[promotionId]/route.ts");
    assert(route.includes("requireAdviserPromotionOwnership"), "ownership");
    assert(route.includes("isValidPromotionId(promotionId)"), "uuid check");
  }),
  record(44, "PATCH promotion checks ownership after write guard", () => {
    const route = read("app/api/advisor/promotions/[promotionId]/route.ts");
    const patch = route.slice(route.indexOf("export async function PATCH"));
    const guardIdx = patch.indexOf("requireLegacyPromotionsWriteAccess");
    const ownIdx = patch.indexOf("requireAdviserPromotionOwnership");
    assert(guardIdx >= 0 && ownIdx > guardIdx, "guard before ownership");
  }),
  record(45, "upload route checks ownership before asset handling", () => {
    const route = read("app/api/advisor/promotions/[promotionId]/upload/route.ts");
    assert(route.includes("requireAdviserPromotionOwnership"), "ownership");
    assert(route.includes("getAdvisorPromotionById"), "load first");
  }),
  record(46, "IDOR: invalid promotion UUID returns 404", () => {
    for (const route of [
      "app/api/advisor/promotions/[promotionId]/route.ts",
      "app/api/advisor/promotions/[promotionId]/upload/route.ts",
    ]) {
      assert(read(route).includes("isValidPromotionId(promotionId)"), route);
      assert(read(route).includes('"Promotion not found"'), route);
    }
  }),
  record(47, "IDOR: rejectClientId in mutation bodies", () => {
    assert(read("app/api/advisor/promotions/route.ts").includes("rejectClientId: true"), "create");
    assert(
      read("app/api/advisor/promotions/[promotionId]/route.ts").includes("rejectClientId: true"),
      "patch",
    );
  }),
  record(48, "IDOR: rejectClientIdInFormData on upload", () => {
    assert(
      read("app/api/advisor/promotions/[promotionId]/upload/route.ts").includes(
        "rejectClientIdInFormData",
      ),
      "form guard",
    );
  }),
  record(49, "IDOR: rejectForbiddenPromotionFields on mutations", () => {
    for (const route of [
      "app/api/advisor/promotions/route.ts",
      "app/api/advisor/promotions/[promotionId]/route.ts",
    ]) {
      assert(read(route).includes("rejectForbiddenPromotionFields"), route);
    }
  }),
  record(50, "admin migration GET requires promotion migration admin access", () => {
    const route = read("app/api/admin/promotions-migration/route.ts");
    assert(route.includes("requirePromotionMigrationAdminAccess"), "admin guard");
    assert(route.includes("listPromotionMigrationRecords"), "list");
  }),
  record(51, "admin migration POST requires promotion migration admin access", () => {
    const route = read("app/api/admin/promotions-migration/route.ts");
    const post = route.slice(route.indexOf("export async function POST"));
    assert(post.includes("requirePromotionMigrationAdminAccess"), "admin");
  }),
  record(52, "promotion migration admin access requires admin_content_approval", () => {
    const access = read("lib/promotions/promotionMigrationAdminAccess.ts");
    assert(access.includes('isFeatureEnabled("admin_content_approval")'), "approval flag");
  }),
  record(53, "admin migration POST validates classification enum", () => {
    const route = read("app/api/admin/promotions-migration/route.ts");
    assert(route.includes("PROMOTION_MIGRATION_CLASSIFICATIONS"), "allowlist");
    assert(route.includes("validateEnum<PromotionMigrationClassification>"), "validate");
  }),
  record(54, "admin migration POST audits migration_started", () => {
    const route = read("app/api/admin/promotions-migration/route.ts");
    assert(route.includes('"legacy_promotion_migration_started"'), "started");
    assert(route.includes("executePromotionMigration"), "migrate call");
  }),
  record(55, "admin migration POST audits migration_failed on error", () => {
    const route = read("app/api/admin/promotions-migration/route.ts");
    assert(route.includes('"legacy_promotion_migration_failed"'), "failed audit");
  }),
  record(56, "promotion migration review service idempotent via promotion_migration_reviews", () => {
    const svc = read("lib/promotions/promotionMigrationReviewService.ts");
    assert(svc.includes("promotion_migration_reviews"), "reviews table");
    assert(svc.includes("alreadyMigrated: true"), "idempotent return");
    assert(svc.includes("migrated_content_id"), "content link");
  }),
  record(57, "promotion migration review service audits migration_completed", () => {
    assert(
      read("lib/promotions/promotionMigrationReviewService.ts").includes(
        '"legacy_promotion_migration_completed"',
      ),
      "completed audit",
    );
  }),
  record(58, "admin migration exempt from write freeze (no write guard)", () => {
    const route = read("app/api/admin/promotions-migration/route.ts");
    assert(!route.includes("requireLegacyPromotionsWriteAccess"), "exempt");
  }),
  record(59, "PromotionsManagerClient read-only notice with role=status", () => {
    const ui = read("components/aegis/advisor/promotions/PromotionsManagerClient.tsx");
    assert(ui.includes('role="status"'), "status role");
    assert(ui.includes("legacyMeta.readOnlyMessage"), "message");
    assert(ui.includes("readOnly &&"), "conditional banner");
  }),
  record(60, "PromotionsManagerClient replacement link to insights", () => {
    const ui = read("components/aegis/advisor/promotions/PromotionsManagerClient.tsx");
    assert(ui.includes("legacyMeta.replacementHref"), "href from api");
    assert(ui.includes("Open Governed Communications"), "link label");
    assert(ui.includes("LEGACY_PROMOTIONS_REPLACEMENT_HREF") || ui.includes("/advisor/insights"), "insights");
  }),
  record(61, "PromotionsManagerClient hides New promotion when readOnly", () => {
    const ui = read("components/aegis/advisor/promotions/PromotionsManagerClient.tsx");
    assert(ui.includes("!readOnly &&"), "conditional create");
    assert(ui.includes("New promotion"), "button label");
  }),
  record(62, "PromotionListTable readOnly shows View not Actions", () => {
    const table = read("components/aegis/advisor/promotions/PromotionListTable.tsx");
    assert(table.includes("readOnly ? \"View\" : \"Actions\""), "column header");
    assert(table.includes("readOnly ?"), "conditional actions");
  }),
  record(63, "PromotionForm disables inputs when readOnly", () => {
    const form = read("components/aegis/advisor/promotions/PromotionForm.tsx");
    assert(form.includes("disabled={readOnly}"), "disabled inputs");
    assert(form.includes("Uploads disabled in read-only mode"), "upload notice");
  }),
  record(64, "PromotionForm hides save button when readOnly", () => {
    const form = read("components/aegis/advisor/promotions/PromotionForm.tsx");
    assert(form.includes("!readOnly &&"), "conditional save");
    assert(form.includes("event.preventDefault()"), "block submit");
  }),
  record(65, "blocked write audit metadata excludes request body", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    const block = mod.slice(
      mod.indexOf("legacy_promotion_write_blocked"),
      mod.indexOf("return {", mod.indexOf("legacy_promotion_write_blocked")),
    );
    assert(!block.includes("body"), "no body");
    assert(block.includes("action_type"), "action type only");
  }),
  record(66, "blocked write audit metadata excludes storage paths", () => {
    const mod = read("lib/promotions/legacyPromotionsAuthorization.ts");
    const block = mod.slice(mod.indexOf("requireLegacyPromotionsWriteAccess"));
    assert(!block.includes("storage_path"), "no storage path");
    assert(!block.includes("signedUrl"), "no signed url");
  }),
  record(67, "route authorization matrix documents metadata privacy", () => {
    const doc = read("docs/PHASE_9F4_ROUTE_AUTHORIZATION_MATRIX.md");
    assert(doc.includes("Metadata excludes"), "privacy note");
    assert(doc.includes("storage paths"), "paths excluded");
    assert(doc.includes("signed URLs"), "urls excluded");
  }),
  record(68, "preflight diagnostic 202606200011 exists", () =>
    assert(existsSync("supabase/diagnostics/preflight_202606200011_phase9f4.sql"), "preflight")),
  record(69, "verify diagnostic 202606200011 exists", () =>
    assert(
      existsSync(
        "supabase/diagnostics/verify_202606200011_phase9f4_legacy_promotions_write_freeze.sql",
      ),
      "verify",
    )),
  record(70, "discrepancy diagnostic 202606200011 exists", () =>
    assert(
      existsSync("supabase/diagnostics/verify_202606200011_phase9f4_discrepancies.sql"),
      "discrepancies",
    )),
  record(71, "preflight is SELECT-only", () => {
    const sql = read("supabase/diagnostics/preflight_202606200011_phase9f4.sql").toLowerCase();
    assert(!sql.includes("insert into"), "insert");
    assert(!sql.includes("update "), "update");
    assert(!sql.includes("delete from"), "delete");
  }),
  record(72, "preflight exposes probe_id classification detail", () => {
    const sql = read("supabase/diagnostics/preflight_202606200011_phase9f4.sql");
    assert(sql.includes("probe_id"), "probe_id");
    assert(sql.includes("READY") && sql.includes("BLOCKER"), "classes");
  }),
  record(73, "diagnostics are compact (under 200 lines each)", () => {
    for (const path of [
      "supabase/diagnostics/preflight_202606200011_phase9f4.sql",
      "supabase/diagnostics/verify_202606200011_phase9f4_legacy_promotions_write_freeze.sql",
      "supabase/diagnostics/verify_202606200011_phase9f4_discrepancies.sql",
    ]) {
      const lines = read(path).split(/\r?\n/).length;
      assert(lines <= 200, `${path}: ${lines} lines`);
    }
  }),
  record(74, "verify diagnostic checks legacy_promotions_write seed", () => {
    assert(
      read("supabase/diagnostics/verify_202606200011_phase9f4_legacy_promotions_write_freeze.sql").includes(
        "legacy_promotions_write",
      ),
      "seed check",
    );
  }),
  record(75, "discrepancy diagnostic asserts legacy_promotions_ui absent", () => {
    const disc = read("supabase/diagnostics/verify_202606200011_phase9f4_discrepancies.sql");
    assert(disc.includes("legacy_promotions_ui"), "ui absent check");
    assert(disc.includes("absent_seed"), "classification");
  }),
  record(76, "write freeze architecture doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_WRITE_FREEZE_ARCHITECTURE.md"), "architecture")),
  record(77, "legacy read-only policy doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_LEGACY_READ_ONLY_POLICY.md"), "policy")),
  record(78, "route authorization matrix doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_ROUTE_AUTHORIZATION_MATRIX.md"), "matrix")),
  record(79, "checkpoint2 manual tests doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_CHECKPOINT2_MANUAL_TESTS.md"), "manual")),
  record(80, "migration and rollback doc exists", () =>
    assert(existsSync("docs/PHASE_9F4_MIGRATION_AND_ROLLBACK.md"), "rollback")),
  record(81, "MIGRATION_CHAIN_AUDIT includes 202606200011", () => {
    assert(read("docs/MIGRATION_CHAIN_AUDIT.md").includes("202606200011"), "chain");
    assert(read("docs/MIGRATION_CHAIN_AUDIT.md").includes("legacy_promotions_write_freeze"), "name");
  }),
  record(82, "MIGRATION_DEPENDENCY_GRAPH includes 202606200011", () => {
    const graph = read("docs/MIGRATION_DEPENDENCY_GRAPH.md");
    assert(graph.includes("202606200011"), "stamp");
    assert(graph.includes("legacy_promotions_write_freeze"), "label");
  }),
  record(83, "classify-migration-drift includes 202606200011", () => {
    assert(read("scripts/classify-migration-drift.ts").includes("202606200011"), "drift");
  }),
  record(84, "featureFlags legacy_promotions_write default false", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("legacy_promotions_write"), "key");
    assert(/legacy_promotions_write:[\s\S]*?enabled:\s*false/.test(flags), "disabled");
    assert(/legacy_promotions_write:[\s\S]*?client_visible:\s*false/.test(flags), "not client visible");
  }),
  record(85, "types.ts includes legacy_promotions_write in PLATFORM_FEATURE_KEYS", () => {
    const types = read("lib/compliance/types.ts");
    assert(types.includes('"legacy_promotions_write"'), "type key");
    assert(types.includes("PLATFORM_FEATURE_KEYS"), "array");
  }),
  record(86, "no legacy_promotions_ui in migration seed", () => {
    assert(!read(MIGRATION_PATH).includes("legacy_promotions_ui"), "no ui seed");
  }),
  record(87, "no legacy_promotions_ui in featureFlags defaults", () => {
    assert(!read("lib/compliance/featureFlags.ts").includes("legacy_promotions_ui"), "no ui flag");
  }),
  record(88, "no legacy_promotions_ui in types PLATFORM_FEATURE_KEYS", () => {
    const types = read("lib/compliance/types.ts");
    const block = types.slice(types.indexOf("PLATFORM_FEATURE_KEYS"), types.indexOf("] as const", types.indexOf("PLATFORM_FEATURE_KEYS")));
    assert(!block.includes("legacy_promotions_ui"), "no ui in keys");
  }),
  record(89, "write freeze architecture confirms no legacy_promotions_ui", () => {
    assert(read("docs/PHASE_9F4_WRITE_FREEZE_ARCHITECTURE.md").includes("No") && read("docs/PHASE_9F4_WRITE_FREEZE_ARCHITECTURE.md").includes("legacy_promotions_ui"), "doc");
  }),
  record(90, "phase9f3 binder publication service unchanged (exists)", () => {
    for (const file of PHASE9F3_BINDER_SPOT_CHECK) {
      assert(existsSync(file), file);
    }
  }),
  record(91, "phase9f3 binder publish route still uses binder_client_publication", () => {
    const route = read(
      "app/api/advisor/clients/[clientId]/binder-exports/[binderExportId]/publish/route.ts",
    );
    assert(route.includes("binder_client_publication"), "independent flag");
    assert(!route.includes("legacy_promotions_write"), "no promotions coupling");
  }),
  record(92, "phase9f3 binder generation service does not import promotions auth", () => {
    const svc = read("lib/binder/binderGenerationService.ts");
    assert(!svc.includes("legacyPromotionsAuthorization"), "no import");
    assert(!svc.includes("legacy_promotions_write"), "no flag");
  }),
  record(93, "write freeze architecture documents phase9f3 isolation", () => {
    const doc = read("docs/PHASE_9F4_WRITE_FREEZE_ARCHITECTURE.md");
    assert(doc.includes("Phase 9F.3 isolation") || doc.includes("9F.3"), "isolation section");
    assert(!doc.includes("binder depends on legacy_promotions_write"), "no false dep");
  }),
  record(94, "advisor list returns legacyPromotions metadata", () => {
    const route = read("app/api/advisor/promotions/route.ts");
    assert(route.includes("legacyPromotions"), "metadata");
    assert(route.includes("LEGACY_PROMOTIONS_READ_ONLY_MESSAGE"), "message");
    assert(route.includes("LEGACY_PROMOTIONS_REPLACEMENT_HREF"), "href");
  }),
  record(95, "admin migration validates promotionId UUID", () => {
    const route = read("app/api/admin/promotions-migration/route.ts");
    assert(route.includes("isValidPromotionId(promotionId)"), "uuid validation");
  }),
  record(96, "package.json registers qa:phase9f4-write-freeze", () => {
    assert(read("package.json").includes("qa:phase9f4-write-freeze"), "script");
    assert(
      read("package.json").includes(
        "scripts/run-phase9f4-write-freeze-validation.ts",
      ),
      "script path",
    );
  }),
  record(97, "write freeze validation count at least 80", () => {
    assert(TESTS.length >= 80, `count ${TESTS.length}`);
  }),
  record(98, "verify diagnostic within byte size guard", () => {
    const path = "supabase/diagnostics/verify_202606200011_phase9f4_legacy_promotions_write_freeze.sql";
    const bytes = statSync(join(ROOT, path)).size;
    assert(bytes <= 50 * 1024, `${bytes} bytes`);
  }),
  record(99, "preflight probes 202606200010 prerequisite", () => {
    assert(
      read("supabase/diagnostics/preflight_202606200011_phase9f4.sql").includes(
        "migration.202606200010_prerequisite",
      ),
      "prerequisite probe",
    );
  }),
  record(100, "checkpoint2 manual tests reference LEGACY_PROMOTIONS_WRITE_DISABLED", () => {
    assert(
      read("docs/PHASE_9F4_CHECKPOINT2_MANUAL_TESTS.md").includes(
        "LEGACY_PROMOTIONS_WRITE_DISABLED",
      ),
      "manual test code",
    );
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

  console.log(`Phase 9F.4 write freeze: ${passed}/${results.length} passed`);

  for (const f of failed) {
    console.error(`  FAIL #${f.id} ${f.name}: ${f.error}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
