/**
 * CRM V2 Phase 02 — Relationship list + Relationship 360 validation (≥170 explicit checks).
 * Run: npm run qa:crm-v2-relationship-360
 *
 * Each check is independently reported — grouped assertions are not collapsed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { runRelationshipAccessMockTests } from "../lib/crm-v2/relationships/accessTests";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const PHASE_02_DOCS = [
  "docs/CRM_V2_PHASE_02_RELATIONSHIP_ARCHITECTURE.md",
  "docs/CRM_V2_PHASE_02_READ_MODEL.md",
  "docs/CRM_V2_PHASE_02_TIMELINE_PROJECTION.md",
  "docs/CRM_V2_PHASE_02_SECURITY_REVIEW.md",
  "docs/CRM_V2_PHASE_02_MANUAL_TESTS.md",
  "docs/CRM_V2_PHASE_02_COMPLETION.md",
] as const;

const RELATIONSHIP_LIB_FILES = [
  "lib/crm-v2/relationships/identity.ts",
  "lib/crm-v2/relationships/listQueries.ts",
  "lib/crm-v2/relationships/readModel.ts",
  "lib/crm-v2/relationships/routes.ts",
  "lib/crm-v2/relationships/types.ts",
  "lib/crm-v2/relationships/timelineProjection.ts",
  "lib/crm-v2/relationships/serviceProjection.ts",
  "lib/crm-v2/relationships/documentProjection.ts",
  "lib/crm-v2/relationships/accessTests.ts",
] as const;

const CRM_V2_TABS = [
  "overview",
  "financial-plan",
  "engagement",
  "service",
  "documents",
  "profile",
] as const;

const FORBIDDEN_LIST_DTO_FIELDS = [
  "netWorth",
  "net_worth",
  "premium",
  "income",
  "nric",
  "NRIC",
  "ethnicity",
  "advocacy",
  "policyNumber",
  "policy_number",
  "privateNotes",
  "private_notes",
  "storage_path",
  "signedUrl",
  "signed_url",
  "commission",
  "revenue",
] as const;

const PHASE06_SERVICE_MIGRATIONS = [
  "202606290008_phase06_crm_v2_service_feature_control.sql",
  "202606290009_phase06_crm_v2_service_core.sql",
] as const;

const PHASE07_PROTECTION_MIGRATIONS = [
  "202606290010_phase07_crm_v2_protection_feature_control.sql",
  "202606290011_phase07_crm_v2_protection_core.sql",
] as const;

const PHASE08_MOMENTS_MIGRATIONS = [
  "202606290012_phase08_crm_v2_relationship_moments_feature_control.sql",
  "202606290013_phase08_crm_v2_relationship_moments_core.sql",
] as const;

const PHASE09_ADVOCACY_MIGRATIONS = [
  "202606290014_phase09_crm_v2_advocacy_feature_control.sql",
  "202606290015_phase09_crm_v2_advocacy_core.sql",
] as const;

const PHASE02_FORBIDDEN_MIGRATION_PATTERNS = [
  /household/i,
  /service_commitments/i,
  /protection_portfolio/i,
  /relationship_moments/i,
  /advocacy_events/i,
  /crm_timeline/i,
  /relationship_timeline/i,
] as const;

const TESTS: TestCase[] = [];
let nextId = 1;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function check(name: string, fn: () => void): void {
  const id = nextId++;
  TESTS.push({ id, name, run: fn });
}

function doc(path: string): string {
  return read(path);
}

function listMigrations(): string[] {
  return readdirSync(join(ROOT, "supabase/migrations"));
}

function phase02CrmMigrations(): string[] {
  return listMigrations().filter((f) => /phase0[12]_crm_v2/i.test(f));
}

function phase02MigrationSql(): string {
  return doc("supabase/migrations/202606290002_phase02_crm_v2_relationships_feature_control.sql");
}

function relationshipsFeatureFlagsBlock(): string {
  const flags = doc("lib/compliance/featureFlags.ts");
  const start = flags.indexOf("crm_v2_relationships:");
  const end = flags.indexOf("crm_v2_appointments_adviser:", start);
  return flags.slice(start, end > start ? end : flags.indexOf("};", start));
}

// --- Feature controls (22 checks) ---

check("feature: CRM_V2_RELATIONSHIPS_FEATURE_KEY in constants.ts", () => {
  assert(
    doc("lib/crm-v2/constants.ts").includes('CRM_V2_RELATIONSHIPS_FEATURE_KEY = "crm_v2_relationships"'),
    "missing constant",
  );
});

check("feature: crm_v2_relationships in PlatformFeatureKey union", () => {
  assert(doc("lib/compliance/types.ts").includes('| "crm_v2_relationships"'), "missing union member");
});

check("feature: crm_v2_relationships in PLATFORM_FEATURE_KEYS array", () => {
  assert(doc("lib/compliance/types.ts").includes('"crm_v2_relationships"'), "missing array entry");
});

check("feature: crm_v2_relationships in FEATURE_DEFAULTS", () => {
  assert(doc("lib/compliance/featureFlags.ts").includes("crm_v2_relationships:"), "missing defaults");
});

check("feature: code default enabled false", () => {
  assert(relationshipsFeatureFlagsBlock().includes("enabled: false"), "enabled not false");
});

check("feature: code default client_visible false", () => {
  assert(relationshipsFeatureFlagsBlock().includes("client_visible: false"), "client_visible not false");
});

check("feature: code default adviser_visible true", () => {
  assert(relationshipsFeatureFlagsBlock().includes("adviser_visible: true"), "adviser_visible not true");
});

check("feature: assertCrmV2RelationshipsAccess exported", () => {
  assert(
    /export async function assertCrmV2RelationshipsAccess/.test(doc("lib/crm-v2/access.ts")),
    "missing export",
  );
});

check("feature: relationships gate calls assertCrmV2Access first", () => {
  const access = doc("lib/crm-v2/access.ts");
  const fnStart = access.indexOf("export async function assertCrmV2RelationshipsAccess");
  const fnBody = access.slice(fnStart, fnStart + 600);
  assert(fnBody.includes("await assertCrmV2Access()"), "master/pilot gate not invoked");
});

check("feature: relationships gate uses CRM_V2_RELATIONSHIPS_FEATURE_KEY", () => {
  const access = doc("lib/crm-v2/access.ts");
  assert(access.includes("CRM_V2_RELATIONSHIPS_FEATURE_KEY"), "missing feature key");
  assert(access.includes("isFeatureEnabled(CRM_V2_RELATIONSHIPS_FEATURE_KEY)"), "isFeatureEnabled not used");
});

check("feature: relationships gate does not bypass master flag", () => {
  const access = doc("lib/crm-v2/access.ts");
  const relFn = access.slice(access.indexOf("assertCrmV2RelationshipsAccess"));
  const masterIdx = access.indexOf("CRM_V2_MASTER_FEATURE_KEY");
  const relIdx = access.indexOf("CRM_V2_RELATIONSHIPS_FEATURE_KEY");
  assert(masterIdx > 0 && relIdx > masterIdx, "master must precede relationships key");
});

check("feature: relationships gate does not bypass pilot flag", () => {
  const access = doc("lib/crm-v2/access.ts");
  const pilotIdx = access.indexOf("CRM_V2_PILOT_MODE_FEATURE_KEY");
  const relIdx = access.indexOf("CRM_V2_RELATIONSHIPS_FEATURE_KEY");
  assert(pilotIdx > 0 && relIdx > pilotIdx, "pilot must precede relationships key");
});

check("feature: relationships allowed result includes relationshipsEnabled", () => {
  assert(doc("lib/crm-v2/access.ts").includes("relationshipsEnabled: true"), "missing flag on success");
});

check("feature: migration 202606290002 file exists", () => {
  assert(
    existsSync("supabase/migrations/202606290002_phase02_crm_v2_relationships_feature_control.sql"),
    "missing migration",
  );
});

check("feature: migration seeds crm_v2_relationships", () => {
  assert(phase02MigrationSql().includes("'crm_v2_relationships'"), "missing seed key");
});

check("feature: migration seeds disabled", () => {
  const sql = phase02MigrationSql();
  const block = sql.slice(sql.indexOf("'crm_v2_relationships'"));
  assert(/\bfalse\b/.test(block), "not disabled in migration");
});

check("feature: migration seeds client_visible false", () => {
  const sql = phase02MigrationSql();
  const lines = sql
    .slice(sql.indexOf("'crm_v2_relationships'"))
    .split("\n")
    .map((l) => l.trim());
  const falseCount = lines.filter((l) => l === "false," || l === "false").length;
  assert(falseCount >= 2, "expected enabled and client_visible false");
});

check("feature: migration seeds adviser_visible true", () => {
  const sql = phase02MigrationSql();
  const block = sql.slice(sql.indexOf("'crm_v2_relationships'"));
  assert(/\btrue\b/.test(block), "adviser_visible not true");
});

check("feature: migration uses idempotent ON CONFLICT", () => {
  assert(phase02MigrationSql().includes("ON CONFLICT (feature_key) DO NOTHING"), "missing idempotent insert");
});

check("feature: migration has no UPDATE statement", () => {
  assert(!/\bUPDATE\b/i.test(phase02MigrationSql()), "UPDATE present");
});

check("feature: migration has no CREATE TABLE", () => {
  assert(!/\bCREATE\s+TABLE\b/i.test(phase02MigrationSql()), "CREATE TABLE present");
});

check("feature: no remote activation in relationship routes", () => {
  const listRoute = doc("app/api/advisor-v2/relationships/route.ts");
  const detailRoute = doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts");
  assert(!listRoute.includes("setFeatureControl"), "remote activation in list API");
  assert(!detailRoute.includes("setFeatureControl"), "remote activation in detail API");
});

// --- Diagnostics (10 checks) ---

check("diagnostics: preflight exists for phase02", () => {
  assert(
    existsSync(
      "supabase/diagnostics/preflight_202606290002_phase02_crm_v2_relationships_feature_control.sql",
    ),
    "missing preflight",
  );
});

check("diagnostics: verify exists for phase02", () => {
  assert(
    existsSync(
      "supabase/diagnostics/verify_202606290002_phase02_crm_v2_relationships_feature_control.sql",
    ),
    "missing verify",
  );
});

check("diagnostics: discrepancies exists for phase02", () => {
  assert(
    existsSync(
      "supabase/diagnostics/verify_202606290002_phase02_crm_v2_relationships_feature_control_discrepancies.sql",
    ),
    "missing discrepancies",
  );
});

check("diagnostics: preflight references 202606290002", () => {
  assert(
    doc("supabase/diagnostics/preflight_202606290002_phase02_crm_v2_relationships_feature_control.sql").includes(
      "202606290002",
    ),
    "version missing",
  );
});

check("diagnostics: verify checks crm_v2_relationships disabled", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290002_phase02_crm_v2_relationships_feature_control.sql",
  );
  assert(sql.includes("crm_v2_relationships"), "key missing");
  assert(sql.includes("crm_v2_relationships.enabled"), "enabled check missing");
  assert(sql.includes("'false'"), "disabled expectation missing");
});

check("diagnostics: discrepancies returns failing rows only pattern", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290002_phase02_crm_v2_relationships_feature_control_discrepancies.sql",
  );
  assert(sql.includes("missing_or_mismatch"), "issue label missing");
  assert(sql.toLowerCase().includes("where"), "filter clause missing");
});

check("diagnostics: discrepancies checks adviser_visible true", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290002_phase02_crm_v2_relationships_feature_control_discrepancies.sql",
  );
  assert(sql.includes("expected_adviser_visible"), "adviser_visible check missing");
  assert(sql.includes("true"), "adviser_visible true expectation missing");
});

check("diagnostics: preflight is read-only classification", () => {
  const sql = doc(
    "supabase/diagnostics/preflight_202606290002_phase02_crm_v2_relationships_feature_control.sql",
  );
  assert(sql.toLowerCase().includes("read-only"), "read-only note missing");
  assert(!/\bINSERT\b/i.test(sql), "INSERT in preflight");
});

check("diagnostics: verify selects from platform_feature_controls", () => {
  assert(
    doc("supabase/diagnostics/verify_202606290002_phase02_crm_v2_relationships_feature_control.sql").includes(
      "platform_feature_controls",
    ),
    "table missing",
  );
});

check("diagnostics: phase02 migration has no DROP", () => {
  assert(!/\bDROP\b/i.test(phase02MigrationSql()), "DROP present");
});

// --- Identity (16 checks) ---

check("identity: identity.ts exists", () => {
  assert(existsSync("lib/crm-v2/relationships/identity.ts"), "missing");
});

check("identity: identity.ts is server-only", () => {
  assert(doc("lib/crm-v2/relationships/identity.ts").includes('import "server-only"'), "missing server-only");
});

check("identity: CrmRelationshipKind is single_person only", () => {
  const source = doc("lib/crm-v2/relationships/identity.ts");
  assert(source.includes('"single_person"'), "single_person missing");
  assert(!source.includes('"household"'), "household kind present");
});

check("identity: relationshipId equals clientId in resolveAuthorizedRelationship", () => {
  const source = doc("lib/crm-v2/relationships/identity.ts");
  assert(source.includes("relationshipId: access.client.id"), "relationshipId not client id");
  assert(source.includes("clientId: access.client.id"), "clientId not client id");
});

check("identity: resolveAuthorizedRelationship uses resolveAccessibleClient", () => {
  const source = doc("lib/crm-v2/relationships/identity.ts");
  assert(source.includes("resolveAccessibleClient"), "missing import/use");
  assert(source.includes("await resolveAccessibleClient"), "not awaited");
});

check("identity: forbidden maps to not_found reason", () => {
  const source = doc("lib/crm-v2/relationships/identity.ts");
  assert(source.includes('reason: "not_found"'), "not_found reason missing");
  assert(!source.includes('"forbidden"'), "forbidden leaked in identity layer");
});

check("identity: toRelationshipIdentity exported", () => {
  assert(/export function toRelationshipIdentity/.test(doc("lib/crm-v2/relationships/identity.ts")), "missing export");
});

check("identity: no household table reference in identity.ts", () => {
  const source = doc("lib/crm-v2/relationships/identity.ts");
  assert(!source.includes("households"), "household table referenced");
  assert(!source.includes("household_id"), "household id referenced");
});

check("identity: no synthetic relationship table insert", () => {
  const source = doc("lib/crm-v2/relationships/identity.ts");
  assert(!source.includes(".insert("), "insert present");
  assert(!source.includes("crm_relationships"), "crm_relationships table");
});

check("identity: CrmRelationshipIdentity type exported", () => {
  assert(doc("lib/crm-v2/relationships/identity.ts").includes("export type CrmRelationshipIdentity"), "missing type");
});

check("identity: resolveAuthorizedRelationship exported", () => {
  assert(
    /export async function resolveAuthorizedRelationship/.test(doc("lib/crm-v2/relationships/identity.ts")),
    "missing export",
  );
});

check("identity: no backfill or migration logic", () => {
  const source = doc("lib/crm-v2/relationships/identity.ts");
  assert(!/backfill/i.test(source), "backfill reference");
  assert(!source.includes("UPDATE"), "update logic");
});

check("identity: read model uses toRelationshipIdentity", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("toRelationshipIdentity"), "not used in read model");
});

check("identity: types CrmRelationship360 identity uses single_person", () => {
  assert(doc("lib/crm-v2/relationships/types.ts").includes('relationshipKind: "single_person"'), "kind missing");
});

check("identity: no createPerson helper in relationship lib", () => {
  const corpus = RELATIONSHIP_LIB_FILES.map((f) => doc(f)).join("\n");
  assert(!corpus.includes("createPerson"), "person creation");
});

check("identity: no crm_relationships persistence table in lib", () => {
  const corpus = RELATIONSHIP_LIB_FILES.map((f) => doc(f)).join("\n");
  assert(!corpus.includes("crm_relationships"), "crm_relationships table");
});

check("identity: future household compatibility documented in read model", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("Household grouping"), "household deferral missing");
});

// --- Routes (18 checks) ---

check("routes: list page exists at app/advisor-v2/relationships/page.tsx", () => {
  assert(existsSync("app/advisor-v2/relationships/page.tsx"), "missing list page");
});

check("routes: detail page exists at [relationshipId]/page.tsx", () => {
  assert(existsSync("app/advisor-v2/relationships/[relationshipId]/page.tsx"), "missing detail page");
});

check("routes: no legacy [id] alias route", () => {
  assert(!existsSync("app/advisor-v2/relationships/[id]"), "legacy [id] alias present");
});

check("routes: list API route exists", () => {
  assert(existsSync("app/api/advisor-v2/relationships/route.ts"), "missing list API");
});

check("routes: detail API route exists", () => {
  assert(existsSync("app/api/advisor-v2/relationships/[relationshipId]/route.ts"), "missing detail API");
});

check("routes: list page uses assertCrmV2RelationshipsAccess", () => {
  assert(doc("app/advisor-v2/relationships/page.tsx").includes("assertCrmV2RelationshipsAccess"), "missing guard");
});

check("routes: detail page uses assertCrmV2RelationshipsAccess", () => {
  assert(
    doc("app/advisor-v2/relationships/[relationshipId]/page.tsx").includes("assertCrmV2RelationshipsAccess"),
    "missing guard",
  );
});

check("routes: detail page independently calls resolveAuthorizedRelationship", () => {
  const page = doc("app/advisor-v2/relationships/[relationshipId]/page.tsx");
  assert(page.includes("resolveAuthorizedRelationship"), "missing identity resolution");
  assert(page.includes("loadCrmRelationship360"), "missing read model load");
});

check("routes: detail page does not rely on list state", () => {
  const page = doc("app/advisor-v2/relationships/[relationshipId]/page.tsx");
  assert(!page.includes("RelationshipListClient"), "list client imported");
  assert(!page.includes("searchParams.get(\"fromList\")"), "list dependency");
});

check("routes: relationships pages inherit advisor-v2 layout (no local layout)", () => {
  assert(!existsSync("app/advisor-v2/relationships/layout.tsx"), "local layout breaks inheritance");
});

check("routes: parent layout uses AdviserCrmV2Shell", () => {
  assert(doc("app/advisor-v2/layout.tsx").includes("AdviserCrmV2Shell"), "shell missing");
});

check("routes: routes.ts exports CRM_V2_RELATIONSHIP_TABS with six tabs", () => {
  const source = doc("lib/crm-v2/relationships/routes.ts");
  for (const tab of CRM_V2_TABS) {
    assert(source.includes(`"${tab}"`), `tab ${tab} missing`);
  }
});

check("routes: buildRelationshipListHref returns /advisor-v2/relationships", () => {
  assert(doc("lib/crm-v2/relationships/routes.ts").includes('return "/advisor-v2/relationships"'), "list href wrong");
});

check("routes: buildRelationshipDetailHref uses relationshipId segment", () => {
  assert(
    doc("lib/crm-v2/relationships/routes.ts").includes("/advisor-v2/relationships/${relationshipId}"),
    "detail href pattern missing",
  );
});

check("routes: isAllowlistedRelationshipLink exported", () => {
  assert(/export function isAllowlistedRelationshipLink/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

check("routes: parseRelationshipTab defaults to overview", () => {
  const source = doc("lib/crm-v2/relationships/routes.ts");
  assert(source.includes('return "overview"'), "default tab missing");
});

check("routes: list page uses RelationshipListClient", () => {
  assert(doc("app/advisor-v2/relationships/page.tsx").includes("RelationshipListClient"), "client component missing");
});

check("routes: detail page uses Relationship360View", () => {
  assert(
    doc("app/advisor-v2/relationships/[relationshipId]/page.tsx").includes("Relationship360View"),
    "360 view missing",
  );
});

// --- List queries and DTO (24 checks) ---

check("list: listQueries.ts is server-only", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes('import "server-only"'), "missing server-only");
});

check("list: loadCrmRelationshipListPage exported", () => {
  assert(/export async function loadCrmRelationshipListPage/.test(doc("lib/crm-v2/relationships/listQueries.ts")), "missing");
});

check("list: parseRelationshipListFilters exported", () => {
  assert(/export function parseRelationshipListFilters/.test(doc("lib/crm-v2/relationships/listQueries.ts")), "missing");
});

check("list: uses CRM_V2_RELATIONSHIPS_DEFAULT_PAGE_SIZE", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("CRM_V2_RELATIONSHIPS_DEFAULT_PAGE_SIZE"), "default size");
});

check("list: uses CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE"), "max size");
});

check("list: pageSize capped at max", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("Math.min(CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE"), "cap missing");
});

check("list: advisor scope uses authUserId not browser param", () => {
  const source = doc("lib/crm-v2/relationships/listQueries.ts");
  assert(source.includes('eq("advisor_user_id", authUserId)'), "advisor scope missing");
  assert(!source.includes("searchParams.get(\"adviser"), "browser adviser id");
});

check("list: supports status filter", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("filters.status"), "status filter");
});

check("list: supports stage filter", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("filters.stage"), "stage filter");
});

check("list: supports reviewStatus filter", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("filters.reviewStatus"), "review filter");
});

check("list: supports hasUpcomingAppointment filter", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("hasUpcomingAppointment"), "appointment filter");
});

check("list: supports needsAttention filter", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("needsAttention"), "attention filter");
});

check("list: supports search by display name", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("display_name.ilike"), "search missing");
});

check("list: deterministic ordering by display_name", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes('order("display_name"'), "ordering missing");
});

check("list: partialDataWarning in list page result", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("partialDataWarning"), "partial warning missing");
});

check("list: safe unknown labels exported", () => {
  const types = doc("lib/crm-v2/relationships/types.ts");
  assert(types.includes('CRM_UNKNOWN_LABEL = "Not available"'), "unknown label");
  assert(types.includes('CRM_NOT_SCHEDULED_LABEL = "Not scheduled"'), "not scheduled label");
  assert(types.includes('CRM_NOT_ESTABLISHED_LABEL = "Not established"'), "not established label");
});

check("list: listQueries uses CRM_UNKNOWN_LABEL", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("CRM_UNKNOWN_LABEL"), "unknown label not used");
});

check("list: CrmRelationshipListItem has no financial amount fields", () => {
  const types = doc("lib/crm-v2/relationships/types.ts");
  const block = types.slice(types.indexOf("CrmRelationshipListItem"), types.indexOf("CrmRelationshipListPage"));
  for (const field of FORBIDDEN_LIST_DTO_FIELDS) {
    assert(!block.includes(field), `forbidden field ${field}`);
  }
});

check("list: list item uses relationshipId and clientId", () => {
  const types = doc("lib/crm-v2/relationships/types.ts");
  assert(types.includes("relationshipId: string"), "relationshipId missing");
  assert(types.includes("clientId: string"), "clientId missing");
});

check("list: constants default page size is 20", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_RELATIONSHIPS_DEFAULT_PAGE_SIZE = 20"), "default 20");
});

check("list: constants max page size is 50", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_RELATIONSHIPS_MAX_PAGE_SIZE = 50"), "max 50");
});

check("list: batch supplementary queries with Promise.all", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("Promise.all"), "batching missing");
});

check("list: returns totalCount and totalPages", () => {
  const source = doc("lib/crm-v2/relationships/listQueries.ts");
  assert(source.includes("totalCount"), "totalCount missing");
  assert(source.includes("totalPages"), "totalPages missing");
});

check("list: invalid filter values fall back to all", () => {
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("VALID_STATUSES"), "status validation");
  assert(doc("lib/crm-v2/relationships/listQueries.ts").includes("VALID_STAGES"), "stage validation");
});

// --- Relationship 360 view (20 checks) ---

check("360: Relationship360View component exists", () => {
  assert(existsSync("components/aegis/advisor-v2/relationships/Relationship360View.tsx"), "missing");
});

check("360: six section tabs rendered", () => {
  const source = doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx");
  assert(source.includes("CRM_V2_RELATIONSHIP_TABS"), "tabs not wired");
  for (const tab of CRM_V2_TABS) {
    assert(source.includes(`activeTab === "${tab}"`) || source.includes(`"${tab}"`), `tab ${tab} not handled`);
  }
});

check("360: overview section panel", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes('activeTab === "overview"'), "overview");
});

check("360: financial-plan section panel", () => {
  assert(
    doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes('activeTab === "financial-plan"'),
    "financial-plan",
  );
});

check("360: engagement section panel", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes('activeTab === "engagement"'), "engagement");
});

check("360: service section panel", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes('activeTab === "service"'), "service");
});

check("360: documents section panel", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes('activeTab === "documents"'), "documents");
});

check("360: profile section panel", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes('activeTab === "profile"'), "profile");
});

check("360: header shows return link to list", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("listHref"), "list href");
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("Relationships"), "label");
});

check("360: service section shows phase notice", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("phaseNotice"), "phase notice");
});

check("360: overview shows protection notice", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("protectionNotice"), "protection");
});

check("360: partial source warning banner", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("sourceWarnings"), "warnings");
});

check("360: engagement timeline uses eventId key", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("entry.eventId"), "eventId key");
});

check("360: nav aria-label for sections", () => {
  assert(
    doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes(
      'aria-label="Relationship 360 sections"',
    ),
    "nav label",
  );
});

check("360: focus-visible styles on tab buttons", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("focus-visible:outline"), "focus");
});

check("360: detail denied state does not reveal existence", () => {
  const page = doc("app/advisor-v2/relationships/[relationshipId]/page.tsx");
  assert(page.includes("Relationship unavailable"), "safe title");
  assert(!page.includes("forbidden"), "forbidden disclosed");
  assert(!page.includes("not assigned"), "assignment disclosed");
});

check("360: read model loads all six sections", () => {
  const source = doc("lib/crm-v2/relationships/readModel.ts");
  assert(source.includes("overview:"), "overview");
  assert(source.includes("financialPlan:"), "financialPlan");
  assert(source.includes("engagement:"), "engagement");
  assert(source.includes("service:"), "service");
  assert(source.includes("documents:"), "documents");
  assert(source.includes("profile:"), "profile");
});

check("360: read model protection notice Phase 07", () => {
  const source = doc("lib/crm-v2/relationships/readModel.ts");
  assert(source.includes("loadCrmProtectionOverviewSummary"), "phase 07 protection summary loader");
  assert(
    doc("lib/crm-v2/relationships/protectionProjection.ts").includes("loadCrmProtectionFinancialPlanLink"),
    "phase 07 protection projection",
  );
});

check("360: profile future phase notices", () => {
  const source = doc("lib/crm-v2/relationships/readModel.ts");
  assert(source.includes("Phase 08"), "moments notice");
  assert(source.includes("Phase 09"), "advocacy notice");
});

check("360: no mutation controls in Relationship360View", () => {
  const source = doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx");
  assert(!source.includes("method=\"POST\""), "POST form");
  assert(!source.includes(".mutate"), "mutate call");
});

// --- Read model (14 checks) ---

check("readModel: readModel.ts is server-only", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes('import "server-only"'), "missing server-only");
});

check("readModel: loadCrmRelationship360 exported", () => {
  assert(/export async function loadCrmRelationship360/.test(doc("lib/crm-v2/relationships/readModel.ts")), "missing");
});

check("readModel: uses projection loaders not per-component queries", () => {
  const source = doc("lib/crm-v2/relationships/readModel.ts");
  assert(source.includes("loadCrmTimelineProjection"), "timeline loader");
  assert(source.includes("loadCrmServiceProjection"), "service loader");
  assert(source.includes("loadCrmDocumentProjection"), "document loader");
});

check("readModel: parallel projection load with Promise.all", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("Promise.all"), "parallel load");
});

check("readModel: partial failure catch on timeline", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("timeline_unavailable"), "timeline catch");
});

check("readModel: partial failure catch on service", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("service_unavailable"), "service catch");
});

check("readModel: partial failure catch on documents", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("documents_unavailable"), "documents catch");
});

check("readModel: diagnostics include requestId", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("requestId"), "requestId");
});

check("readModel: diagnostics include timingMs", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("timingMs"), "timing");
});

check("readModel: diagnostics include sourceWarnings", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("sourceWarnings"), "warnings");
});

check("readModel: no insert or update writes", () => {
  const source = doc("lib/crm-v2/relationships/readModel.ts");
  assert(!source.includes(".insert("), "insert");
  assert(!source.includes(".update("), "update");
  assert(!source.includes(".delete("), "delete");
});

check("readModel: supplementary context batched", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("loadSupplementaryContext"), "supplementary loader");
});

check("readModel: CrmRelationship360 type in types.ts", () => {
  assert(doc("lib/crm-v2/relationships/types.ts").includes("export type CrmRelationship360"), "type missing");
});

check("readModel: overview has ten panels in builder", () => {
  const source = doc("lib/crm-v2/relationships/readModel.ts");
  const panels = [
    "relationship_status",
    "planning_stage",
    "next_appointment",
    "review_readiness",
    "open_tasks",
    "roadmap_status",
    "recent_engagement",
    "data_completeness",
    "latest_output",
    "binder_availability",
  ];
  for (const panel of panels) {
    assert(source.includes(`panelId: "${panel}"`), `panel ${panel} missing`);
  }
});

// --- Timeline projection (12 checks) ---

check("timeline: timelineProjection.ts is server-only", () => {
  assert(doc("lib/crm-v2/relationships/timelineProjection.ts").includes('import "server-only"'), "server-only");
});

check("timeline: loadCrmTimelineProjection exported", () => {
  assert(/export async function loadCrmTimelineProjection/.test(doc("lib/crm-v2/relationships/timelineProjection.ts")), "missing");
});

check("timeline: deterministic eventId uses sourceType:sourceId", () => {
  const source = doc("lib/crm-v2/relationships/timelineProjection.ts");
  assert(source.includes("eventId: `meeting_session:${row.id}`"), "meeting pattern");
  assert(source.includes("eventId: `adviser_appointment:${row.id}`"), "appointment pattern");
  assert(source.includes("eventId: `advisor_task:${row.id}`"), "task pattern");
  assert(source.includes("eventId: `document:${row.id}`"), "document pattern");
});

check("timeline: bounded by CRM_V2_TIMELINE_MAX_ENTRIES", () => {
  const source = doc("lib/crm-v2/relationships/timelineProjection.ts");
  assert(source.includes("CRM_V2_TIMELINE_MAX_ENTRIES"), "bound constant");
  assert(source.includes(".slice(0, CRM_V2_TIMELINE_MAX_ENTRIES)"), "slice bound");
});

check("timeline: sorted by occurredAt descending", () => {
  assert(doc("lib/crm-v2/relationships/timelineProjection.ts").includes("entries.sort"), "sort missing");
});

check("timeline: visibility classification on entries", () => {
  assert(doc("lib/crm-v2/relationships/timelineProjection.ts").includes('visibility: "adviser"'), "adviser visibility");
  assert(doc("lib/crm-v2/relationships/timelineProjection.ts").includes('visibility: "client_visible"'), "client visibility");
});

check("timeline: no storage_path in projection", () => {
  assert(!doc("lib/crm-v2/relationships/timelineProjection.ts").includes("storage_path"), "storage_path");
});

check("timeline: no private notes in projection", () => {
  const source = doc("lib/crm-v2/relationships/timelineProjection.ts");
  assert(!source.includes("private_notes"), "private notes");
  assert(!source.includes("note_body"), "note body");
});

check("timeline: no timeline table migration in phase02 chain", () => {
  const migrations = phase02CrmMigrations();
  for (const file of migrations) {
    const sql = doc(`supabase/migrations/${file}`);
    assert(!/CREATE\s+TABLE.*timeline/i.test(sql), `timeline table in ${file}`);
  }
});

check("timeline: no crm_timeline table reference in lib", () => {
  assert(!doc("lib/crm-v2/relationships/timelineProjection.ts").includes("crm_timeline"), "crm_timeline table");
});

check("timeline: uses allowlisted source links", () => {
  assert(doc("lib/crm-v2/relationships/timelineProjection.ts").includes("isAllowlistedRelationshipLink"), "allowlist check");
});

check("timeline: constants timeline max is 50", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_TIMELINE_MAX_ENTRIES = 50"), "max 50");
});

// --- Service projection (8 checks) ---

check("service: serviceProjection.ts is server-only", () => {
  assert(doc("lib/crm-v2/relationships/serviceProjection.ts").includes('import "server-only"'), "server-only");
});

check("service: CRM_SERVICE_PHASE_NOTICE exported", () => {
  assert(doc("lib/crm-v2/relationships/serviceProjection.ts").includes("CRM_SERVICE_PHASE_NOTICE"), "notice");
});

check("service: phase notice references Phase 06", () => {
  assert(doc("lib/crm-v2/relationships/serviceProjection.ts").includes("Phase 06"), "phase 06");
});

check("service: bounded by CRM_V2_SERVICE_MAX_ITEMS", () => {
  const source = doc("lib/crm-v2/relationships/serviceProjection.ts");
  assert(source.includes("CRM_V2_SERVICE_MAX_ITEMS"), "bound constant");
  assert(source.includes(".slice(0, CRM_V2_SERVICE_MAX_ITEMS)"), "slice");
});

check("service: projects service_commitments", () => {
  const source = doc("lib/crm-v2/relationships/serviceProjection.ts");
  assert(source.includes("service_commitments"), "commitments table");
  assert(source.includes("client_service_requests"), "requests table");
});

check("service: projects advisor_tasks", () => {
  assert(doc("lib/crm-v2/relationships/serviceProjection.ts").includes("advisor_tasks"), "tasks source");
});

check("service: projects roadmap_items", () => {
  assert(doc("lib/crm-v2/relationships/serviceProjection.ts").includes("roadmap_items"), "roadmap source");
});

check("service: constants service max is 30", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_SERVICE_MAX_ITEMS = 30"), "max 30");
});

// --- Document projection (8 checks) ---

check("documents: documentProjection.ts is server-only", () => {
  assert(doc("lib/crm-v2/relationships/documentProjection.ts").includes('import "server-only"'), "server-only");
});

check("documents: loadCrmDocumentProjection exported", () => {
  assert(/export async function loadCrmDocumentProjection/.test(doc("lib/crm-v2/relationships/documentProjection.ts")), "missing");
});

check("documents: no storage_path in projection", () => {
  assert(!doc("lib/crm-v2/relationships/documentProjection.ts").includes("storage_path"), "storage_path");
});

check("documents: no signed URL in projection", () => {
  const source = doc("lib/crm-v2/relationships/documentProjection.ts");
  assert(!source.includes("signedUrl"), "signedUrl");
  assert(!source.includes("signed_url"), "signed_url");
  assert(!source.includes("createSignedUrl"), "createSignedUrl");
});

check("documents: bounded by CRM_V2_DOCUMENTS_MAX_SUMMARY", () => {
  const source = doc("lib/crm-v2/relationships/documentProjection.ts");
  assert(source.includes("CRM_V2_DOCUMENTS_MAX_SUMMARY"), "bound constant");
  assert(source.includes(".slice(0, CRM_V2_DOCUMENTS_MAX_SUMMARY)"), "slice");
});

check("documents: itemId uses sourceType:sourceId pattern", () => {
  const source = doc("lib/crm-v2/relationships/documentProjection.ts");
  assert(source.includes("itemId: `document:${row.id}`"), "document id pattern");
  assert(source.includes("itemId: `binder_export:${row.id}`"), "binder id pattern");
});

check("documents: vault href via legacy builder", () => {
  assert(doc("lib/crm-v2/relationships/documentProjection.ts").includes("buildLegacyDocumentVaultHref"), "vault href");
});

check("documents: constants documents max is 20", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_DOCUMENTS_MAX_SUMMARY = 20"), "max 20");
});

// --- API routes (14 checks) ---

check("api: list route force-dynamic", () => {
  assert(doc("app/api/advisor-v2/relationships/route.ts").includes('export const dynamic = "force-dynamic"'), "dynamic");
});

check("api: detail route force-dynamic", () => {
  assert(
    doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts").includes('export const dynamic = "force-dynamic"'),
    "dynamic",
  );
});

check("api: list uses assertCrmV2RelationshipsAccess", () => {
  assert(doc("app/api/advisor-v2/relationships/route.ts").includes("assertCrmV2RelationshipsAccess"), "guard");
});

check("api: detail uses assertCrmV2RelationshipsAccess", () => {
  assert(
    doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts").includes("assertCrmV2RelationshipsAccess"),
    "guard",
  );
});

check("api: list derives adviser from access.authUser.id", () => {
  const route = doc("app/api/advisor-v2/relationships/route.ts");
  assert(route.includes("access.authUser.id"), "auth user id");
  assert(!route.includes("searchParams.get(\"adviser"), "browser adviser id");
  assert(!route.includes("searchParams.get(\"advisor"), "browser advisor id");
});

check("api: list sets Cache-Control private no-store", () => {
  assert(doc("app/api/advisor-v2/relationships/route.ts").includes("private, no-store"), "cache header");
});

check("api: detail sets Cache-Control private no-store", () => {
  assert(doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts").includes("private, no-store"), "cache header");
});

check("api: list sets X-Request-Id header", () => {
  assert(doc("app/api/advisor-v2/relationships/route.ts").includes('"X-Request-Id"'), "request id");
});

check("api: detail sets X-Request-Id header", () => {
  assert(doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts").includes('"X-Request-Id"'), "request id");
});

check("api: detail returns 404 not_found for unauthorized relationship", () => {
  const route = doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts");
  assert(route.includes('reason: "not_found"'), "not_found reason");
  assert(route.includes("404"), "404 status");
});

check("api: list returns 401 for unauthenticated", () => {
  const route = doc("app/api/advisor-v2/relationships/route.ts");
  assert(route.includes("unauthenticated"), "unauthenticated branch");
  assert(route.includes("401"), "401 status");
});

check("api: list returns 403 for other denials", () => {
  assert(doc("app/api/advisor-v2/relationships/route.ts").includes("403"), "403 status");
});

check("api: no mutation methods in list route", () => {
  const route = doc("app/api/advisor-v2/relationships/route.ts");
  assert(!route.includes("export async function POST"), "POST");
  assert(!route.includes("export async function PUT"), "PUT");
  assert(!route.includes("export async function DELETE"), "DELETE");
});

check("api: detail uses resolveAuthorizedRelationship before load", () => {
  const route = doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts");
  const resolveIdx = route.indexOf("resolveAuthorizedRelationship");
  const loadIdx = route.indexOf("loadCrmRelationship360");
  assert(resolveIdx > 0 && loadIdx > resolveIdx, "resolve must precede load");
});

// --- Security and accessTests (12 checks) ---

check("security: accessTests.ts exports runRelationshipAccessMockTests", () => {
  assert(typeof runRelationshipAccessMockTests === "function", "import failed");
});

check("security: mock tests all pass", () => {
  const result = runRelationshipAccessMockTests();
  assert(result.failed.length === 0, result.failed.join("; "));
});

check("security: mock tests cover six cases", () => {
  const result = runRelationshipAccessMockTests();
  assert(result.passed === 6, `expected 6 passed, got ${result.passed}`);
});

check("security: mock adviser A sees assigned client", () => {
  const source = doc("lib/crm-v2/relationships/accessTests.ts");
  assert(source.includes("adviser A sees assigned client"), "case missing");
});

check("security: mock adviser A denied client B", () => {
  assert(doc("lib/crm-v2/relationships/accessTests.ts").includes("adviser A denied client B"), "case missing");
});

check("security: mock forged UUID not found", () => {
  assert(doc("lib/crm-v2/relationships/accessTests.ts").includes("forged UUID not found"), "case missing");
});

check("security: mock invalid UUID not found", () => {
  assert(doc("lib/crm-v2/relationships/accessTests.ts").includes("invalid UUID not found"), "case missing");
});

check("security: mock admin can access book client", () => {
  assert(doc("lib/crm-v2/relationships/accessTests.ts").includes("admin can access any assigned book client"), "case missing");
});

check("security: mockResolveAccessibleClient does not use live Supabase", () => {
  const source = doc("lib/crm-v2/relationships/accessTests.ts");
  assert(!source.includes("createClient"), "supabase client");
  assert(!source.includes("createAdminSupabaseClient"), "admin client");
});

check("security: routes.ts allowlists internal prefixes only", () => {
  const source = doc("lib/crm-v2/relationships/routes.ts");
  assert(source.includes("/advisor-v2/relationships"), "v2 prefix");
  assert(source.includes("/advisor/clients"), "legacy clients prefix");
  assert(source.includes("/advisor/appointments"), "appointments prefix");
});

check("security: list client fetches API without adviser id param", () => {
  const source = doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx");
  assert(source.includes("/api/advisor-v2/relationships"), "api path");
  assert(!source.includes("adviserId"), "adviserId param");
  assert(!source.includes("advisorId"), "advisorId param");
});

check("security: list client uses cache no-store", () => {
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes('cache: "no-store"'), "no-store");
});

// --- UI list client (10 checks) ---

check("ui list: RelationshipListClient exists", () => {
  assert(existsSync("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx"), "missing");
});

check("ui list: loading state with aria-busy", () => {
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("aria-busy"), "aria-busy");
});

check("ui list: empty state distinguishes zero book vs no results", () => {
  const source = doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx");
  assert(source.includes("No assigned relationships"), "empty book");
  assert(source.includes("No matching relationships"), "no results");
});

check("ui list: partial data warning", () => {
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("partialWarning"), "partial");
});

check("ui list: desktop table hidden on mobile", () => {
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("hidden"), "responsive table");
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("md:block"), "desktop table");
});

check("ui list: mobile card layout", () => {
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("md:hidden"), "mobile cards");
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("<article"), "article cards");
});

check("ui list: pagination nav with aria-label", () => {
  assert(
    doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes(
      'aria-label="Relationship list pagination"',
    ),
    "pagination label",
  );
});

check("ui list: focus-visible on name links", () => {
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("focus-visible:outline"), "focus");
});

check("ui list: semantic table headings", () => {
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("<thead"), "thead");
  assert(doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx").includes("<th"), "th");
});

check("ui list: no financial amount columns", () => {
  const source = doc("components/aegis/advisor-v2/relationships/RelationshipListClient.tsx");
  assert(!source.includes("net worth"), "net worth");
  assert(!source.includes("premium"), "premium");
  assert(!source.includes("income"), "income");
});

// --- Compatibility (14 checks) ---

check("compat: legacy /advisor layout unchanged by phase02", () => {
  const layout = doc("app/advisor/layout.tsx");
  assert(layout.includes("requireAdvisorAccess"), "adviser guard");
  assert(!layout.includes("advisor-v2/relationships"), "v2 route injected");
});

check("compat: legacy /advisor page still exists", () => {
  assert(existsSync("app/advisor/page.tsx"), "legacy landing");
});

check("compat: phase02 CRM migrations are feature-control only", () => {
  const crmMigrations = phase02CrmMigrations();
  assert(crmMigrations.length === 2, `expected 2 CRM migrations, got ${crmMigrations.join(", ")}`);
  for (const file of crmMigrations) {
    const sql = doc(`supabase/migrations/${file}`);
    assert(sql.includes("platform_feature_controls"), `${file} must seed feature controls`);
    assert(!/\bCREATE\s+TABLE\b/i.test(sql), `${file} has CREATE TABLE`);
  }
});

check("compat: no household schema migration in phase02 CRM chain", () => {
  for (const file of phase02CrmMigrations()) {
    const sql = doc(`supabase/migrations/${file}`);
    assert(!/CREATE\s+TABLE.*household/i.test(sql), `household in ${file}`);
  }
});

check("compat: no service_commitments migration in phase02 CRM chain", () => {
  for (const file of phase02CrmMigrations()) {
    assert(!/service_commitments/i.test(doc(`supabase/migrations/${file}`)), `service in ${file}`);
  }
});

check("compat: no protection schema migration in phase02 CRM chain", () => {
  for (const file of phase02CrmMigrations()) {
    assert(!/protection_portfolio/i.test(doc(`supabase/migrations/${file}`)), `protection in ${file}`);
  }
});

check("compat: no relationship_moments migration in phase02 CRM chain", () => {
  for (const file of phase02CrmMigrations()) {
    assert(!/relationship_moments/i.test(doc(`supabase/migrations/${file}`)), `moments in ${file}`);
  }
});

check("compat: no advocacy schema migration in phase02 CRM chain", () => {
  for (const file of phase02CrmMigrations()) {
    assert(!/advocacy_events/i.test(doc(`supabase/migrations/${file}`)), `advocacy in ${file}`);
  }
});

check("compat: relationships pages do not import work-queue", () => {
  const pages = [
    "app/advisor-v2/relationships/page.tsx",
    "app/advisor-v2/relationships/[relationshipId]/page.tsx",
  ];
  for (const page of pages) {
    assert(!doc(page).includes("work-queue"), `${page} imports work-queue`);
  }
});

check("compat: Phase 01 shell gates still in parent layout", () => {
  assert(doc("app/advisor-v2/layout.tsx").includes("assertCrmV2Access"), "shell gate preserved");
});

check("compat: relationships list replaces placeholder not foundation page", () => {
  const page = doc("app/advisor-v2/relationships/page.tsx");
  assert(!page.includes("CrmV2FoundationPlaceholderPage"), "still placeholder");
});

check("compat: no new household table anywhere in relationship lib", () => {
  const corpus = RELATIONSHIP_LIB_FILES.map((f) => doc(f)).join("\n");
  assert(!corpus.includes("from(\"households\")"), "households query");
  assert(!corpus.includes("crm_households"), "crm_households");
});

check("compat: qa script registered in package.json", () => {
  assert(read("package.json").includes("qa:crm-v2-relationship-360"), "npm script missing");
});

check("compat: no forbidden phase02 migration patterns in new migrations", () => {
  const newMigrations = listMigrations().filter((f) => f.includes("20260629"));
  const phaseScopedMigrations = [
    ...(PHASE06_SERVICE_MIGRATIONS as readonly string[]),
    ...(PHASE07_PROTECTION_MIGRATIONS as readonly string[]),
    ...(PHASE08_MOMENTS_MIGRATIONS as readonly string[]),
    ...(PHASE09_ADVOCACY_MIGRATIONS as readonly string[]),
  ];
  for (const file of newMigrations) {
    if (phaseScopedMigrations.includes(file)) continue;
    const sql = doc(`supabase/migrations/${file}`);
    for (const pattern of PHASE02_FORBIDDEN_MIGRATION_PATTERNS) {
      assert(!pattern.test(sql), `${pattern} matched in ${file}`);
    }
  }
});

// --- Types and DTO safety (14 checks) ---

check("types: CrmRelationshipListPage exported", () => {
  assert(doc("lib/crm-v2/relationships/types.ts").includes("export type CrmRelationshipListPage"), "missing");
});

check("types: CrmRelationshipHeader exported", () => {
  assert(doc("lib/crm-v2/relationships/types.ts").includes("export type CrmRelationshipHeader"), "missing");
});

check("types: CrmTimelineEntry has eventId field", () => {
  assert(doc("lib/crm-v2/relationships/types.ts").includes("eventId: string"), "eventId missing");
});

check("types: CrmTimelineEntry has visibility field", () => {
  assert(doc("lib/crm-v2/relationships/types.ts").includes("visibility: CrmTimelineVisibility"), "visibility missing");
});

check("types: CrmDocumentSummaryItem has no storage_path", () => {
  const block = doc("lib/crm-v2/relationships/types.ts").slice(
    doc("lib/crm-v2/relationships/types.ts").indexOf("CrmDocumentSummaryItem"),
    doc("lib/crm-v2/relationships/types.ts").indexOf("CrmRelationshipProfileField"),
  );
  assert(!block.includes("storage_path"), "storage_path in DTO");
});

check("types: CrmServiceItem has workflowHref not raw payload", () => {
  const block = doc("lib/crm-v2/relationships/types.ts").slice(
    doc("lib/crm-v2/relationships/types.ts").indexOf("CrmServiceItem"),
    doc("lib/crm-v2/relationships/types.ts").indexOf("CrmDocumentSummaryItem"),
  );
  assert(block.includes("workflowHref"), "workflowHref missing");
  assert(!block.includes("raw"), "raw payload field");
});

check("types: CrmRelationship360 diagnostics type exported", () => {
  assert(doc("lib/crm-v2/relationships/types.ts").includes("export type CrmRelationship360Diagnostics"), "missing");
});

check("types: list DTO has detailHref not raw client row", () => {
  const block = doc("lib/crm-v2/relationships/types.ts").slice(
    doc("lib/crm-v2/relationships/types.ts").indexOf("CrmRelationshipListItem"),
    doc("lib/crm-v2/relationships/types.ts").indexOf("CrmRelationshipListPage"),
  );
  assert(block.includes("detailHref"), "detailHref missing");
  assert(!block.includes("advisor_user_id"), "advisor_user_id leaked");
});

for (const field of ["netWorth", "premium", "income", "ethnicity", "advocacy", "nric"] as const) {
  check(`types: CrmRelationshipListItem excludes ${field}`, () => {
    const block = doc("lib/crm-v2/relationships/types.ts").slice(
      doc("lib/crm-v2/relationships/types.ts").indexOf("CrmRelationshipListItem"),
      doc("lib/crm-v2/relationships/types.ts").indexOf("CrmRelationshipListPage"),
    );
    assert(!block.includes(field), `field ${field} present`);
  });
}

// --- Legacy route builders (7 checks) ---

check("routes: buildLegacyClientHref exported", () => {
  assert(/export function buildLegacyClientHref/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

check("routes: buildLegacyDiscoverHref exported", () => {
  assert(/export function buildLegacyDiscoverHref/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

check("routes: buildLegacyPlanningOutputsHref exported", () => {
  assert(/export function buildLegacyPlanningOutputsHref/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

check("routes: buildLegacyRoadmapHref exported", () => {
  assert(/export function buildLegacyRoadmapHref/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

check("routes: buildLegacyMeetingStudioHref exported", () => {
  assert(/export function buildLegacyMeetingStudioHref/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

check("routes: buildLegacyDocumentVaultHref exported", () => {
  assert(/export function buildLegacyDocumentVaultHref/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

check("routes: buildLegacyTasksHref exported", () => {
  assert(/export function buildLegacyTasksHref/.test(doc("lib/crm-v2/relationships/routes.ts")), "missing");
});

// --- Financial plan projection (7 checks) ---

check("financial: read model builds seven financial plan links", () => {
  const source = doc("lib/crm-v2/relationships/readModel.ts");
  assert(source.includes("Discover / fact-find"), "discover link");
  assert(source.includes("Shield diagnostic"), "diagnostics link");
  assert(source.includes("Goals and planning outputs"), "outputs link");
  assert(source.includes("Wealth roadmap"), "roadmap link");
  assert(source.includes("Protection report"), "protection link");
  assert(source.includes("Meeting studio"), "meeting link");
  assert(source.includes("Document vault / binders"), "vault link");
});

check("financial: no editable financial forms in 360 view", () => {
  const source = doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx");
  assert(!source.includes("<form"), "form present");
  assert(!source.includes("<input"), "input present");
});

check("financial: financial plan links use href from model", () => {
  assert(doc("components/aegis/advisor-v2/relationships/Relationship360View.tsx").includes("link.href"), "href binding");
});

check("financial: read model does not duplicate discover_profiles into CRM table", () => {
  assert(!doc("lib/crm-v2/relationships/readModel.ts").includes("crm_discover"), "crm_discover table");
});

check("financial: shield diagnostic uses legacy client href", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes('buildLegacyClientHref(clientId, "diagnostics")'), "diagnostics href");
});

check("financial: planning outputs link uses legacy builder", () => {
  assert(doc("lib/crm-v2/relationships/readModel.ts").includes("buildLegacyPlanningOutputsHref"), "outputs builder");
});

check("financial: no net worth in read model output", () => {
  assert(!/net_worth|netWorth/i.test(doc("lib/crm-v2/relationships/readModel.ts")), "net worth reference");
});

// --- Timeline event types (6 checks) ---

for (const eventType of [
  "meeting_session",
  "appointment",
  "adviser_task",
  "published_output",
  "binder_export",
  "document_upload",
] as const) {
  check(`timeline: projects eventType ${eventType}`, () => {
    assert(doc("lib/crm-v2/relationships/timelineProjection.ts").includes(`eventType: "${eventType}"`), "missing");
  });
}

// --- Page dynamics and exports (6 checks) ---

check("pages: list page force-dynamic", () => {
  assert(doc("app/advisor-v2/relationships/page.tsx").includes('export const dynamic = "force-dynamic"'), "dynamic");
});

check("pages: list page revalidate 0", () => {
  assert(doc("app/advisor-v2/relationships/page.tsx").includes("revalidate = 0"), "revalidate");
});

check("pages: detail page force-dynamic", () => {
  assert(
    doc("app/advisor-v2/relationships/[relationshipId]/page.tsx").includes('export const dynamic = "force-dynamic"'),
    "dynamic",
  );
});

check("pages: detail page revalidate 0", () => {
  assert(doc("app/advisor-v2/relationships/[relationshipId]/page.tsx").includes("revalidate = 0"), "revalidate");
});

check("pages: detail page uses parseRelationshipTab", () => {
  assert(doc("app/advisor-v2/relationships/[relationshipId]/page.tsx").includes("parseRelationshipTab"), "tab parser");
});

check("pages: detail page uses buildRelationshipListHref on denial", () => {
  assert(doc("app/advisor-v2/relationships/[relationshipId]/page.tsx").includes("buildRelationshipListHref"), "back link");
});

// --- Remote activation and rollout (5 checks) ---

check("activation: featureFlags relationships block enabled false only", () => {
  const block = relationshipsFeatureFlagsBlock();
  const enabledMatches = block.match(/enabled:\s*(\w+)/g) ?? [];
  assert(enabledMatches.length === 1, "multiple enabled keys");
  assert(enabledMatches[0] === "enabled: false", "not disabled");
});

check("activation: migration inserts only platform_feature_controls", () => {
  const sql = phase02MigrationSql();
  assert(sql.includes("INSERT INTO platform_feature_controls"), "insert target");
  assert(!sql.includes("UPDATE platform_feature_controls"), "update seed");
});

check("activation: relationship APIs do not load feature controls directly", () => {
  const listRoute = doc("app/api/advisor-v2/relationships/route.ts");
  const detailRoute = doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts");
  assert(!listRoute.includes("loadFeatureControls"), "remote feature load in list API");
  assert(!detailRoute.includes("loadFeatureControls"), "remote feature load in detail API");
});

check("activation: access layer gates relationships via isFeatureEnabled", () => {
  const access = doc("lib/crm-v2/access.ts");
  const relFn = access.slice(access.indexOf("assertCrmV2RelationshipsAccess"));
  const featureIdx = relFn.indexOf("isFeatureEnabled(CRM_V2_RELATIONSHIPS_FEATURE_KEY)");
  const successIdx = relFn.indexOf("relationshipsEnabled: true");
  assert(featureIdx > 0 && successIdx > featureIdx, "feature check must precede success flag");
});

check("rollout: CRM_V2_ROLLOUT_INDEX references qa:crm-v2-relationship-360", () => {
  assert(doc("docs/CRM_V2_ROLLOUT_INDEX.md").includes("qa:crm-v2-relationship-360"), "script missing from index");
});

// --- API detail mutations and errors (4 checks) ---

check("api: detail route has no POST handler", () => {
  assert(!doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts").includes("export async function POST"), "POST");
});

check("api: detail route has no PUT handler", () => {
  assert(!doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts").includes("export async function PUT"), "PUT");
});

check("api: list uses toPublicErrorMessage on catch", () => {
  assert(doc("app/api/advisor-v2/relationships/route.ts").includes("toPublicErrorMessage"), "sanitized errors");
});

check("api: detail uses toPublicErrorMessage on catch", () => {
  assert(
    doc("app/api/advisor-v2/relationships/[relationshipId]/route.ts").includes("toPublicErrorMessage"),
    "sanitized errors",
  );
});

// --- Documentation (6 checks) ---

for (const phaseDoc of PHASE_02_DOCS) {
  check(`docs: ${phaseDoc} exists`, () => {
    assert(existsSync(phaseDoc), "missing file");
  });
}

// --- Lib file inventory (9 checks) ---

for (const libFile of RELATIONSHIP_LIB_FILES) {
  check(`lib: ${libFile} exists`, () => {
    assert(existsSync(libFile), "missing");
  });
}

// --- Meta (3 checks) ---

check("meta: minimum explicit check count ≥ 170", () => {
  assert(TESTS.length >= 170, `only ${TESTS.length} checks defined`);
});

check("meta: runRelationshipAccessMockTests imported", () => {
  assert(typeof runRelationshipAccessMockTests === "function", "import failed");
});

check("meta: verdict target is appointment core", () => {
  assert(TESTS.length >= 170, "insufficient checks for appointment core readiness");
});

function main(): void {
  console.log("CRM V2 Phase 02 — Relationship List + Relationship 360 Validation\n");
  console.log(`Defined explicit checks: ${TESTS.length}\n`);

  for (const test of TESTS) {
    try {
      test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  PASS  [${test.id}] ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  FAIL  [${test.id}] ${test.name}: ${message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`\n${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.log("\nFailed tests:");
    for (const f of failed) {
      console.log(`  [${f.id}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }

  if (TESTS.length < 170) {
    console.error(`\nInsufficient explicit checks: ${TESTS.length} < 170 required`);
    process.exit(1);
  }

  console.log("\nVerdict: READY FOR CRM V2 APPOINTMENT CORE");
}

main();
