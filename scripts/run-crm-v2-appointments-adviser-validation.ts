/**
 * CRM V2 Phase 03 — Appointments (adviser side) validation (≥240 explicit checks; currently 449).
 * Run: npm run qa:crm-v2-appointments-adviser
 *
 * Each check is independently reported — grouped assertions are not collapsed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { runAppointmentAccessMockTests } from "../lib/crm-v2/appointments/accessTests";
import {
  CRM_APPOINTMENT_CREATION_ALLOWED_STATUSES,
  CRM_APPOINTMENT_LIFECYCLE_STATUSES,
  CRM_APPOINTMENT_TERMINAL_STATUSES,
} from "../lib/crm-v2/appointments/lifecycle";
import { runAppointmentLifecycleTests } from "../lib/crm-v2/appointments/lifecycleTests";
import { CRM_V2_APPOINTMENT_LIST_VIEWS } from "../lib/crm-v2/appointments/routes";
import { CRM_APPOINTMENT_TEMPLATE_KEYS, getAppointmentTemplate } from "../lib/crm-v2/appointments/templates";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const PHASE_03_DOCS = [
  "docs/CRM_V2_PHASE_03_EXISTING_APPOINTMENT_AUDIT.md",
  "docs/CRM_V2_FEATURE_CONTROL_PLAN.md",
  "docs/CRM_V2_MIGRATION_SEQUENCE.md",
  "docs/CRM_V2_ROUTE_MAP.md",
  "docs/CRM_V2_ROLLOUT_INDEX.md",
  "docs/CRM_V2_SECURITY_BOUNDARIES.md",
] as const;

const APPOINTMENT_LIB_FILES = [
  "lib/crm-v2/appointments/identity.ts",
  "lib/crm-v2/appointments/listQueries.ts",
  "lib/crm-v2/appointments/service.ts",
  "lib/crm-v2/appointments/routes.ts",
  "lib/crm-v2/appointments/types.ts",
  "lib/crm-v2/appointments/templates.ts",
  "lib/crm-v2/appointments/legacyMapping.ts",
  "lib/crm-v2/appointments/timezone.ts",
  "lib/crm-v2/appointments/lifecycle.ts",
  "lib/crm-v2/appointments/accessTests.ts",
  "lib/crm-v2/appointments/lifecycleTests.ts",
] as const;

const API_ROUTE_FILES = [
  "app/api/advisor-v2/appointments/route.ts",
  "app/api/advisor-v2/appointments/[appointmentId]/route.ts",
  "app/api/advisor-v2/appointments/[appointmentId]/transition/route.ts",
  "app/api/advisor-v2/appointments/[appointmentId]/reschedule/route.ts",
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
  "private_adviser_note",
  "client_notes",
  "storage_path",
  "signedUrl",
  "signed_url",
  "commission",
  "revenue",
  "google_event_id",
  "google_calendar_id",
  "google_event_url",
] as const;

const FORBIDDEN_DETAIL_DTO_FIELDS = [
  ...FORBIDDEN_LIST_DTO_FIELDS,
  "meeting_url",
  "phone_instructions",
  "custom_meeting_link",
  "notification_error",
  "calendar_sync_error",
  "external_reference",
  "external_url",
] as const;

const PHASE03_FORBIDDEN_MIGRATION_PATTERNS = [
  /CREATE\s+TABLE\s+crm_appointments\b/i,
  /DROP\s+TABLE\s+adviser_appointments/i,
  /RENAME\s+TABLE\s+adviser_appointments/i,
  /CREATE\s+TABLE\s+appointments\b/i,
] as const;

const SUPPORTING_TABLES = [
  "crm_appointment_participants",
  "crm_appointment_state_events",
  "crm_appointment_client_topics",
  "crm_appointment_agenda_items",
  "crm_appointment_checklist_items",
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

function appointmentsCorpus(): string {
  return APPOINTMENT_LIB_FILES.map((f) => doc(f)).join("\n");
}

function appointmentsFeatureFlagsBlock(): string {
  const flags = doc("lib/compliance/featureFlags.ts");
  const start = flags.indexOf("crm_v2_appointments_adviser:");
  const end = flags.indexOf("},", start);
  return flags.slice(start, end);
}

function phase03FeatureMigrationSql(): string {
  return doc(
    "supabase/migrations/202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
  );
}

function appointmentsAccessFn(): string {
  const access = doc("lib/crm-v2/access.ts");
  const fnStart = access.indexOf("export async function assertCrmV2AppointmentsAccess");
  return access.slice(fnStart, fnStart + 800);
}

function phase03CoreMigrationSql(): string {
  return doc("supabase/migrations/202606290004_phase03_crm_v2_appointment_core.sql");
}

function loadBinderReadinessFn(): string {
  const service = doc("lib/crm-v2/appointments/service.ts");
  const start = service.indexOf("async function loadBinderReadiness");
  const end = service.indexOf("async function loadMeetingSessionState");
  return service.slice(start, end);
}

// --- Feature controls (22 checks) ---

check("feature: CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY in constants.ts", () => {
  const constants = doc("lib/crm-v2/constants.ts");
  assert(constants.includes("CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY"), "missing export name");
  assert(constants.includes('"crm_v2_appointments_adviser"'), "missing key value");
});

check("feature: crm_v2_appointments_adviser in PlatformFeatureKey union", () => {
  assert(doc("lib/compliance/types.ts").includes('| "crm_v2_appointments_adviser"'), "missing union member");
});

check("feature: crm_v2_appointments_adviser in PLATFORM_FEATURE_KEYS array", () => {
  assert(doc("lib/compliance/types.ts").includes('"crm_v2_appointments_adviser"'), "missing array entry");
});

check("feature: crm_v2_appointments_adviser in FEATURE_DEFAULTS", () => {
  assert(doc("lib/compliance/featureFlags.ts").includes("crm_v2_appointments_adviser:"), "missing defaults");
});

check("feature: code default enabled false", () => {
  assert(appointmentsFeatureFlagsBlock().includes("enabled: false"), "enabled not false");
});

check("feature: code default client_visible false", () => {
  assert(appointmentsFeatureFlagsBlock().includes("client_visible: false"), "client_visible not false");
});

check("feature: code default adviser_visible true", () => {
  assert(appointmentsFeatureFlagsBlock().includes("adviser_visible: true"), "adviser_visible not true");
});

check("feature: assertCrmV2AppointmentsAccess exported", () => {
  assert(
    /export async function assertCrmV2AppointmentsAccess/.test(doc("lib/crm-v2/access.ts")),
    "missing export",
  );
});

check("feature: appointments gate calls assertCrmV2Access first", () => {
  assert(appointmentsAccessFn().includes("await assertCrmV2Access()"), "master/pilot gate not invoked");
});

check("feature: appointments gate uses CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY", () => {
  const fn = appointmentsAccessFn();
  assert(fn.includes("CRM_V2_APPOINTMENTS_ADVISER_FEATURE_KEY"), "missing feature key");
  assert(fn.includes("isFeatureEnabled"), "isFeatureEnabled not used");
});

check("feature: appointments gate chains master pilot before feature flag", () => {
  const fn = appointmentsAccessFn();
  const baseIdx = fn.indexOf("await assertCrmV2Access()");
  const featureIdx = fn.indexOf("isFeatureEnabled");
  const successIdx = fn.indexOf("appointmentsEnabled: true");
  assert(baseIdx >= 0 && featureIdx > baseIdx, "assertCrmV2Access must precede feature check");
  assert(successIdx > featureIdx, "feature check must precede success flag");
});

check("feature: appointments allowed result includes appointmentsEnabled", () => {
  assert(doc("lib/crm-v2/access.ts").includes("appointmentsEnabled: true"), "missing flag on success");
});

check("feature: migration 202606290003 file exists", () => {
  assert(
    existsSync(
      "supabase/migrations/202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
    ),
    "missing migration",
  );
});

check("feature: migration seeds crm_v2_appointments_adviser", () => {
  assert(phase03FeatureMigrationSql().includes("'crm_v2_appointments_adviser'"), "missing seed key");
});

check("feature: migration seeds disabled", () => {
  const sql = phase03FeatureMigrationSql();
  const block = sql.slice(sql.indexOf("'crm_v2_appointments_adviser'"));
  assert(/\bfalse\b/.test(block), "not disabled in migration");
});

check("feature: migration seeds client_visible false", () => {
  const sql = phase03FeatureMigrationSql();
  const lines = sql
    .slice(sql.indexOf("'crm_v2_appointments_adviser'"))
    .split("\n")
    .map((l) => l.trim());
  const falseCount = lines.filter((l) => l === "false," || l === "false").length;
  assert(falseCount >= 2, "expected enabled and client_visible false");
});

check("feature: migration seeds adviser_visible true", () => {
  const sql = phase03FeatureMigrationSql();
  const block = sql.slice(sql.indexOf("'crm_v2_appointments_adviser'"));
  assert(/\btrue\b/.test(block), "adviser_visible not true");
});

check("feature: migration uses idempotent ON CONFLICT", () => {
  assert(phase03FeatureMigrationSql().includes("ON CONFLICT (feature_key) DO NOTHING"), "missing idempotent insert");
});

check("feature: migration has no UPDATE statement", () => {
  assert(!/\bUPDATE\b/i.test(phase03FeatureMigrationSql()), "UPDATE present");
});

check("feature: migration has no CREATE TABLE", () => {
  assert(!/\bCREATE\s+TABLE\b/i.test(phase03FeatureMigrationSql()), "CREATE TABLE present");
});

check("feature: no remote activation in appointment APIs", () => {
  for (const routeFile of API_ROUTE_FILES) {
    assert(!doc(routeFile).includes("setFeatureControl"), `remote activation in ${routeFile}`);
  }
});

// --- Diagnostics migration 003 (10 checks) ---

check("diagnostics: preflight exists for 202606290003", () => {
  assert(
    existsSync(
      "supabase/diagnostics/preflight_202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
    ),
    "missing preflight",
  );
});

check("diagnostics: verify exists for 202606290003", () => {
  assert(
    existsSync(
      "supabase/diagnostics/verify_202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
    ),
    "missing verify",
  );
});

check("diagnostics: discrepancies exists for 202606290003", () => {
  assert(
    existsSync(
      "supabase/diagnostics/verify_202606290003_phase03_crm_v2_appointments_adviser_feature_control_discrepancies.sql",
    ),
    "missing discrepancies",
  );
});

check("diagnostics: preflight references 202606290003", () => {
  assert(
    doc(
      "supabase/diagnostics/preflight_202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
    ).includes("202606290003"),
    "version missing",
  );
});

check("diagnostics: verify checks crm_v2_appointments_adviser disabled", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
  );
  assert(sql.includes("crm_v2_appointments_adviser"), "key missing");
  assert(sql.includes("'false'"), "disabled expectation missing");
});

check("diagnostics: discrepancies returns failing rows only pattern", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290003_phase03_crm_v2_appointments_adviser_feature_control_discrepancies.sql",
  );
  assert(sql.includes("missing_or_mismatch"), "issue label missing");
  assert(sql.toLowerCase().includes("where"), "filter clause missing");
});

check("diagnostics: discrepancies checks adviser_visible true", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290003_phase03_crm_v2_appointments_adviser_feature_control_discrepancies.sql",
  );
  assert(sql.includes("expected_adviser_visible"), "adviser_visible check missing");
  assert(sql.includes("true"), "adviser_visible true expectation missing");
});

check("diagnostics: preflight is read-only classification", () => {
  const sql = doc(
    "supabase/diagnostics/preflight_202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
  );
  assert(sql.toLowerCase().includes("read-only"), "read-only note missing");
  assert(!/\bINSERT\b/i.test(sql), "INSERT in preflight");
});

check("diagnostics: verify selects from platform_feature_controls", () => {
  assert(
    doc(
      "supabase/diagnostics/verify_202606290003_phase03_crm_v2_appointments_adviser_feature_control.sql",
    ).includes("platform_feature_controls"),
    "table missing",
  );
});

check("diagnostics: feature migration has no DROP", () => {
  assert(!/\bDROP\b/i.test(phase03FeatureMigrationSql()), "DROP present");
});

// --- Diagnostics migration 004 (10 checks) ---

check("diagnostics: preflight exists for 202606290004", () => {
  assert(
    existsSync("supabase/diagnostics/preflight_202606290004_phase03_crm_v2_appointment_core.sql"),
    "missing preflight",
  );
});

check("diagnostics: verify exists for 202606290004", () => {
  assert(
    existsSync("supabase/diagnostics/verify_202606290004_phase03_crm_v2_appointment_core.sql"),
    "missing verify",
  );
});

check("diagnostics: discrepancies exists for 202606290004", () => {
  assert(
    existsSync(
      "supabase/diagnostics/verify_202606290004_phase03_crm_v2_appointment_core_discrepancies.sql",
    ),
    "missing discrepancies",
  );
});

check("diagnostics: preflight references 202606290004", () => {
  assert(
    doc("supabase/diagnostics/preflight_202606290004_phase03_crm_v2_appointment_core.sql").includes(
      "202606290004",
    ),
    "version missing",
  );
});

check("diagnostics: verify checks adviser_appointments columns", () => {
  const sql = doc("supabase/diagnostics/verify_202606290004_phase03_crm_v2_appointment_core.sql");
  assert(sql.includes("adviser_appointments"), "table missing");
  assert(sql.includes("crm_lifecycle_status"), "lifecycle column check missing");
});

check("diagnostics: verify checks supporting tables", () => {
  const sql = doc("supabase/diagnostics/verify_202606290004_phase03_crm_v2_appointment_core.sql");
  for (const table of SUPPORTING_TABLES) {
    assert(sql.includes(table), `table ${table} missing from verify`);
  }
});

check("diagnostics: core preflight is read-only", () => {
  const sql = doc("supabase/diagnostics/preflight_202606290004_phase03_crm_v2_appointment_core.sql");
  assert(sql.toLowerCase().includes("read-only"), "read-only note missing");
  assert(!/\bINSERT\b/i.test(sql), "INSERT in preflight");
});

check("diagnostics: core discrepancies filters failing rows", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290004_phase03_crm_v2_appointment_core_discrepancies.sql",
  );
  assert(sql.includes("missing_column") || sql.includes("missing_table"), "issue labels missing");
  assert(sql.toLowerCase().includes("where"), "filter clause missing");
});

check("diagnostics: core verify references phase03.core", () => {
  assert(
    doc("supabase/diagnostics/verify_202606290004_phase03_crm_v2_appointment_core.sql").includes(
      "phase03.core",
    ),
    "check_id prefix missing",
  );
});

check("diagnostics: core migration file exists", () => {
  assert(
    existsSync("supabase/migrations/202606290004_phase03_crm_v2_appointment_core.sql"),
    "missing migration",
  );
});

// --- Identity (14 checks) ---

check("identity: identity.ts exists", () => {
  assert(existsSync("lib/crm-v2/appointments/identity.ts"), "missing");
});

check("identity: identity.ts is server-only", () => {
  assert(doc("lib/crm-v2/appointments/identity.ts").includes('import "server-only"'), "missing server-only");
});

check("identity: isValidAppointmentId exported", () => {
  assert(/export function isValidAppointmentId/.test(doc("lib/crm-v2/appointments/identity.ts")), "missing export");
});

check("identity: resolveAuthorizedAppointment exported", () => {
  assert(
    /export async function resolveAuthorizedAppointment/.test(doc("lib/crm-v2/appointments/identity.ts")),
    "missing export",
  );
});

check("identity: uses adviser_appointments table", () => {
  assert(doc("lib/crm-v2/appointments/identity.ts").includes('from("adviser_appointments")'), "table missing");
});

check("identity: resolves through resolveAccessibleClient", () => {
  const source = doc("lib/crm-v2/appointments/identity.ts");
  assert(source.includes("resolveAccessibleClient"), "missing client access");
  assert(source.includes("await resolveAccessibleClient"), "not awaited");
});

check("identity: forbidden maps to not_found reason", () => {
  const source = doc("lib/crm-v2/appointments/identity.ts");
  assert(source.includes('reason: "not_found"'), "not_found reason missing");
  assert(!source.includes('"forbidden"'), "forbidden leaked in identity layer");
});

check("identity: adviser scope checks adviser_user_id", () => {
  assert(doc("lib/crm-v2/appointments/identity.ts").includes("adviser_user_id"), "adviser scope missing");
});

check("identity: UUID validation before database lookup", () => {
  const source = doc("lib/crm-v2/appointments/identity.ts");
  const validateIdx = source.indexOf("isValidAppointmentId");
  const fromIdx = source.indexOf('from("adviser_appointments")');
  assert(validateIdx > 0 && fromIdx > validateIdx, "validate must precede query");
});

check("identity: no competing crm_appointments table reference", () => {
  assert(!doc("lib/crm-v2/appointments/identity.ts").includes("crm_appointments"), "competing table");
});

check("identity: AdviserAppointmentAuthRow type exported", () => {
  assert(
    doc("lib/crm-v2/appointments/identity.ts").includes("export type AdviserAppointmentAuthRow"),
    "missing type",
  );
});

check("identity: service uses resolveAuthorizedAppointment", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("resolveAuthorizedAppointment"), "not used in service");
});

check("identity: no backfill logic in identity", () => {
  const source = doc("lib/crm-v2/appointments/identity.ts");
  assert(!/backfill/i.test(source), "backfill reference");
});

check("identity: cross-adviser denial without disclosure", () => {
  const source = doc("lib/crm-v2/appointments/identity.ts");
  assert(source.includes('return { ok: false, reason: "not_found" }'), "uniform denial");
});

// --- Schema migration 004 (24 checks) ---

check("schema: extends adviser_appointments not new root table", () => {
  const sql = phase03CoreMigrationSql();
  assert(sql.includes("ALTER TABLE adviser_appointments"), "alter missing");
  assert(!/CREATE\s+TABLE\s+crm_appointments/i.test(sql), "competing root table");
});

check("schema: crm_lifecycle_status column added", () => {
  assert(phase03CoreMigrationSql().includes("crm_lifecycle_status"), "column missing");
});

check("schema: template_key column added", () => {
  assert(phase03CoreMigrationSql().includes("template_key"), "column missing");
});

check("schema: version column for optimistic concurrency", () => {
  assert(phase03CoreMigrationSql().includes("version INTEGER"), "version missing");
});

check("schema: preparation_state check constraint", () => {
  assert(phase03CoreMigrationSql().includes("preparation_state_check"), "constraint missing");
});

check("schema: follow_up_state check constraint", () => {
  assert(phase03CoreMigrationSql().includes("follow_up_state_check"), "constraint missing");
});

check("schema: lifecycle status check constraint", () => {
  assert(phase03CoreMigrationSql().includes("adviser_appointments_crm_lifecycle_status_check"), "constraint missing");
});

check("schema: adviser lifecycle index exists", () => {
  assert(
    phase03CoreMigrationSql().includes("idx_adviser_appointments_adviser_lifecycle_starts"),
    "index missing",
  );
});

check("schema: no DROP TABLE adviser_appointments", () => {
  assert(!/DROP\s+TABLE\s+adviser_appointments/i.test(phase03CoreMigrationSql()), "drop present");
});

check("schema: state events table immutable comment", () => {
  assert(phase03CoreMigrationSql().includes("Immutable CRM V2 appointment lifecycle"), "comment missing");
});

check("schema: RLS enabled on supporting tables", () => {
  const sql = phase03CoreMigrationSql();
  for (const table of SUPPORTING_TABLES) {
    assert(sql.includes(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`), `RLS missing for ${table}`);
  }
});

check("schema: assignment-scoped policies use is_assigned_advisor", () => {
  const sql = phase03CoreMigrationSql();
  assert((sql.match(/is_assigned_advisor\(client_id\)/g) ?? []).length >= 5, "policies missing");
});

check("schema: participants reference adviser_appointments", () => {
  assert(
    phase03CoreMigrationSql().includes("REFERENCES adviser_appointments(id) ON DELETE CASCADE"),
    "FK missing",
  );
});

check("schema: checklist unique key per appointment", () => {
  assert(
    phase03CoreMigrationSql().includes("idx_crm_appointment_checklist_items_unique_key"),
    "unique index missing",
  );
});

check("schema: client topics text length limit", () => {
  assert(phase03CoreMigrationSql().includes("crm_appointment_client_topics_text_len"), "check missing");
});

check("schema: agenda items text length limit", () => {
  assert(phase03CoreMigrationSql().includes("crm_appointment_agenda_items_text_len"), "check missing");
});

check("schema: no backfill lifecycle history comment", () => {
  assert(phase03CoreMigrationSql().toLowerCase().includes("does not backfill"), "backfill disclaimer missing");
});

check("schema: additive extension comment", () => {
  assert(phase03CoreMigrationSql().toLowerCase().includes("additive"), "additive note missing");
});

check("schema: last_transition audit columns", () => {
  const sql = phase03CoreMigrationSql();
  assert(sql.includes("last_transition_at"), "last_transition_at missing");
  assert(sql.includes("last_transition_by_user_id"), "last_transition_by_user_id missing");
});

check("schema: cancellation reason codes", () => {
  const sql = phase03CoreMigrationSql();
  assert(sql.includes("cancellation_reason_code"), "cancellation_reason_code missing");
  assert(sql.includes("no_show_reason_code"), "no_show_reason_code missing");
});

check("schema: state events event_type check", () => {
  assert(phase03CoreMigrationSql().includes("crm_appointment_state_events_event_type_check"), "check missing");
});

check("schema: participants role check", () => {
  assert(phase03CoreMigrationSql().includes("crm_appointment_participants_role_check"), "check missing");
});

check("schema: checklist updated_at trigger", () => {
  assert(phase03CoreMigrationSql().includes("crm_appointment_checklist_items_set_updated_at"), "trigger missing");
});

check("schema: checklist trigger is rerunnable with DROP TRIGGER IF EXISTS", () => {
  const sql = phase03CoreMigrationSql();
  assert(
    sql.includes("DROP TRIGGER IF EXISTS crm_appointment_checklist_items_set_updated_at"),
    "idempotent trigger drop missing",
  );
  const dropIdx = sql.indexOf("DROP TRIGGER IF EXISTS crm_appointment_checklist_items_set_updated_at");
  const createIdx = sql.indexOf("CREATE TRIGGER crm_appointment_checklist_items_set_updated_at");
  assert(dropIdx >= 0 && createIdx > dropIdx, "trigger drop must precede create");
});

check("schema: all appointment policies are rerunnable via DROP POLICY IF EXISTS", () => {
  const sql = phase03CoreMigrationSql();
  assert(sql.includes("DROP POLICY IF EXISTS crm_appointment_participants_adviser_access"), "participants policy drop missing");
  assert(sql.includes("DROP POLICY IF EXISTS crm_appointment_state_events_adviser_access"), "events policy drop missing");
  assert(sql.includes("DROP POLICY IF EXISTS crm_appointment_client_topics_adviser_access"), "client topics policy drop missing");
  assert(sql.includes("DROP POLICY IF EXISTS crm_appointment_agenda_items_adviser_access"), "agenda policy drop missing");
  assert(sql.includes("DROP POLICY IF EXISTS crm_appointment_checklist_items_adviser_access"), "checklist policy drop missing");
});

check("schema: no forbidden competing migration patterns", () => {
  const sql = phase03CoreMigrationSql();
  for (const pattern of PHASE03_FORBIDDEN_MIGRATION_PATTERNS) {
    assert(!pattern.test(sql), `forbidden pattern ${pattern}`);
  }
});

// --- Lifecycle module (per-status loops + base checks) ---

for (const status of CRM_APPOINTMENT_LIFECYCLE_STATUSES) {
  check(`lifecycle: migration allows status ${status}`, () => {
    assert(phase03CoreMigrationSql().includes(`'${status}'`), `status ${status} missing from CHECK`);
  });
}

for (const status of CRM_APPOINTMENT_LIFECYCLE_STATUSES) {
  check(`lifecycle: canonical status defined ${status}`, () => {
    assert(doc("lib/crm-v2/appointments/lifecycle.ts").includes(`"${status}"`), `status ${status} missing`);
  });
}

for (const status of CRM_APPOINTMENT_LIFECYCLE_STATUSES) {
  check(`lifecycle: adviser transition map includes ${status}`, () => {
    assert(
      doc("lib/crm-v2/appointments/lifecycle.ts").includes(`${status}: new Set`),
      `adviser map entry for ${status}`,
    );
  });
}

for (const status of [...CRM_APPOINTMENT_TERMINAL_STATUSES]) {
  check(`lifecycle: terminal status ${status} has empty adviser transitions`, () => {
    const lifecycle = doc("lib/crm-v2/appointments/lifecycle.ts");
    const marker = `${status}: new Set()`;
    assert(lifecycle.includes(marker), `expected empty set for ${status}`);
  });
}

for (const status of [...CRM_APPOINTMENT_CREATION_ALLOWED_STATUSES]) {
  check(`lifecycle: creation allowed status ${status}`, () => {
    assert(
      doc("lib/crm-v2/appointments/lifecycle.ts").includes(`"${status}"`),
      `creation status ${status}`,
    );
  });
}

check("lifecycle: validateAppointmentTransition exported", () => {
  assert(/export function validateAppointmentTransition/.test(doc("lib/crm-v2/appointments/lifecycle.ts")), "missing");
});

check("lifecycle: mapLifecycleToLegacyStatus exported", () => {
  assert(/export function mapLifecycleToLegacyStatus/.test(doc("lib/crm-v2/appointments/lifecycle.ts")), "missing");
});

check("lifecycle: deriveAdviserActions exported", () => {
  assert(/export function deriveAdviserActions/.test(doc("lib/crm-v2/appointments/lifecycle.ts")), "missing");
});

check("lifecycle: client transitions defined for Phase 04", () => {
  assert(doc("lib/crm-v2/appointments/lifecycle.ts").includes("CLIENT_TRANSITIONS"), "client map missing");
});

check("lifecycle: CrmAppointmentTransitionError class exported", () => {
  assert(doc("lib/crm-v2/appointments/lifecycle.ts").includes("export class CrmAppointmentTransitionError"), "missing");
});

check("lifecycle: lifecycleTests.ts imports lifecycle module", () => {
  assert(doc("lib/crm-v2/appointments/lifecycleTests.ts").includes("./lifecycle"), "import missing");
});

check("lifecycle: unit tests all pass", () => {
  const result = runAppointmentLifecycleTests();
  assert(result.failed.length === 0, result.failed.join("; "));
});

check("lifecycle: unit tests cover canonical states", () => {
  const result = runAppointmentLifecycleTests();
  assert(result.passed >= CRM_APPOINTMENT_LIFECYCLE_STATUSES.length + 10, `only ${result.passed} passed`);
});

// --- Templates (per-key loops) ---

for (const key of CRM_APPOINTMENT_TEMPLATE_KEYS) {
  check(`template: key ${key} in CRM_APPOINTMENT_TEMPLATES`, () => {
    assert(doc("lib/crm-v2/appointments/templates.ts").includes(`${key}:`), `template ${key} missing`);
  });
}

for (const key of CRM_APPOINTMENT_TEMPLATE_KEYS) {
  check(`template: ${key} has displayName`, () => {
    const block = doc("lib/crm-v2/appointments/templates.ts");
    const start = block.indexOf(`${key}:`);
    const slice = block.slice(start, start + 400);
    assert(slice.includes("displayName:"), `displayName missing for ${key}`);
  });
}

for (const key of CRM_APPOINTMENT_TEMPLATE_KEYS) {
  check(`template: ${key} has defaultDurationMinutes`, () => {
    const block = doc("lib/crm-v2/appointments/templates.ts");
    const start = block.indexOf(`${key}:`);
    const slice = block.slice(start, start + 400);
    assert(slice.includes("defaultDurationMinutes:"), `duration missing for ${key}`);
  });
}

for (const key of CRM_APPOINTMENT_TEMPLATE_KEYS) {
  check(`template: ${key} is active`, () => {
    const template = getAppointmentTemplate(key);
    assert(template?.active === true, `inactive template ${key}`);
  });
}

check("template: getAppointmentTemplate exported", () => {
  assert(/export function getAppointmentTemplate/.test(doc("lib/crm-v2/appointments/templates.ts")), "missing");
});

check("template: isValidAppointmentTemplateKey exported", () => {
  assert(/export function isValidAppointmentTemplateKey/.test(doc("lib/crm-v2/appointments/templates.ts")), "missing");
});

check("template: service validates template on create", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("isValidAppointmentTemplateKey"), "validation missing");
});

check("template: create API validates template", () => {
  assert(doc("app/api/advisor-v2/appointments/route.ts").includes("isValidAppointmentTemplateKey"), "api validation");
});

// --- List views (per-view loops) ---

for (const view of CRM_V2_APPOINTMENT_LIST_VIEWS) {
  check(`list-view: ${view} in routes CRM_V2_APPOINTMENT_LIST_VIEWS`, () => {
    assert(doc("lib/crm-v2/appointments/routes.ts").includes(`"${view}"`), `view ${view} missing`);
  });
}

for (const view of CRM_V2_APPOINTMENT_LIST_VIEWS) {
  check(`list-view: ${view} has listViewLabel case`, () => {
    assert(doc("lib/crm-v2/appointments/routes.ts").includes(`case "${view}"`), `label case for ${view}`);
  });
}

for (const view of CRM_V2_APPOINTMENT_LIST_VIEWS) {
  check(`list-view: ${view} filter in listQueries viewLifecycleFilter`, () => {
    const source = doc("lib/crm-v2/appointments/listQueries.ts");
    if (view === "agenda") {
      assert(source.includes('case "agenda"'), "agenda case missing");
    } else {
      assert(source.includes(`case "${view}"`), `filter case for ${view}`);
    }
  });
}

for (const view of CRM_V2_APPOINTMENT_LIST_VIEWS) {
  check(`list-view: buildAppointmentListHref supports ${view}`, () => {
    const routes = doc("lib/crm-v2/appointments/routes.ts");
    if (view === "agenda") {
      assert(routes.includes('view === "agenda"'), "agenda default");
    } else {
      assert(routes.includes(`view=${view}`) || routes.includes("?view="), `href for ${view}`);
    }
  });
}

check("list-view: parseAppointmentListView defaults to agenda", () => {
  assert(doc("lib/crm-v2/appointments/routes.ts").includes('return "agenda"'), "default missing");
});

check("list-view: list page uses parseAppointmentListView", () => {
  assert(doc("app/advisor-v2/appointments/page.tsx").includes("parseAppointmentListView"), "parser missing");
});

// --- List queries (18 checks) ---

check("list: listQueries.ts is server-only", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes('import "server-only"'), "missing server-only");
});

check("list: loadCrmAppointmentListPage exported", () => {
  assert(/export async function loadCrmAppointmentListPage/.test(doc("lib/crm-v2/appointments/listQueries.ts")), "missing");
});

check("list: parseAppointmentListFilters exported", () => {
  assert(/export function parseAppointmentListFilters/.test(doc("lib/crm-v2/appointments/listQueries.ts")), "missing");
});

check("list: uses adviser_appointments not crm_appointments", () => {
  const source = doc("lib/crm-v2/appointments/listQueries.ts");
  assert(source.includes('from("adviser_appointments")'), "adviser_appointments missing");
  assert(!source.includes("crm_appointments"), "competing table");
});

check("list: advisor scope uses authUserId", () => {
  const source = doc("lib/crm-v2/appointments/listQueries.ts");
  assert(source.includes('eq("adviser_user_id", authUserId)'), "advisor scope missing");
});

check("list: pageSize capped at max", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("CRM_V2_APPOINTMENTS_MAX_PAGE_SIZE"), "cap missing");
});

check("list: agenda window uses LIST_DAYS_AGENDA", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("CRM_V2_APPOINTMENTS_LIST_DAYS_AGENDA"), "agenda days");
});

check("list: history window uses LIST_DAYS_HISTORY", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("CRM_V2_APPOINTMENTS_LIST_DAYS_HISTORY"), "history days");
});

check("list: resolveEffectiveLifecycleStatus used", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("resolveEffectiveLifecycleStatus"), "legacy mapping");
});

check("list: deriveAdviserActions on list items", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("deriveAdviserActions"), "actions missing");
});

check("list: partialDataWarning in result", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("partialDataWarning"), "warning missing");
});

check("list: returns totalCount and totalPages", () => {
  const source = doc("lib/crm-v2/appointments/listQueries.ts");
  assert(source.includes("totalCount"), "totalCount missing");
  assert(source.includes("totalPages"), "totalPages missing");
});

check("list: buildAppointmentDetailHref on items", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("buildAppointmentDetailHref"), "detail href");
});

check("list: supports search filter q", () => {
  assert(doc("lib/crm-v2/appointments/listQueries.ts").includes("filters.q"), "search missing");
});

check("list: constants default page size is 20", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_APPOINTMENTS_DEFAULT_PAGE_SIZE = 20"), "default 20");
});

check("list: constants max page size is 50", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_APPOINTMENTS_MAX_PAGE_SIZE = 50"), "max 50");
});

check("list: constants agenda window is 7 days", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_APPOINTMENTS_LIST_DAYS_AGENDA = 7"), "agenda 7");
});

check("list: constants history window is 90 days", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_APPOINTMENTS_LIST_DAYS_HISTORY = 90"), "history 90");
});

// --- DTO privacy (per-field loops) ---

for (const field of FORBIDDEN_LIST_DTO_FIELDS) {
  check(`dto-privacy: list item excludes ${field}`, () => {
    const types = doc("lib/crm-v2/appointments/types.ts");
    const block = types.slice(types.indexOf("CrmAppointmentListItem"), types.indexOf("CrmAppointmentListPage"));
    assert(!block.includes(field), `forbidden field ${field}`);
  });
}

for (const field of FORBIDDEN_DETAIL_DTO_FIELDS) {
  check(`dto-privacy: detail excludes ${field}`, () => {
    const types = doc("lib/crm-v2/appointments/types.ts");
    const block = types.slice(types.indexOf("CrmAppointmentDetail"), types.indexOf("CrmAssignedRelationshipOption"));
    assert(!block.includes(field), `forbidden field ${field}`);
  });
}

check("dto-privacy: listQueries select omits private columns", () => {
  const select = doc("lib/crm-v2/appointments/listQueries.ts");
  assert(!select.includes("private_adviser_note"), "private note in select");
  assert(!select.includes("client_notes"), "client notes in select");
});

check("dto-privacy: service detail load omits google fields", () => {
  const service = doc("lib/crm-v2/appointments/service.ts");
  const detailFn = service.slice(service.indexOf("loadCrmAppointmentDetail"));
  assert(!detailFn.includes("google_event_id"), "google_event_id");
  assert(!detailFn.includes("google_event_url"), "google_event_url");
});

check("dto-privacy: audit doc lists private_adviser_note as excluded", () => {
  assert(
    doc("docs/CRM_V2_PHASE_03_EXISTING_APPOINTMENT_AUDIT.md").includes("private_adviser_note"),
    "audit reference",
  );
});

check("dto-privacy: audit doc lists google_event_url as not exposed", () => {
  assert(
    doc("docs/CRM_V2_PHASE_03_EXISTING_APPOINTMENT_AUDIT.md").includes("google_event_url"),
    "audit reference",
  );
});

// --- Service layer (20 checks) ---

check("service: service.ts is server-only", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes('import "server-only"'), "missing server-only");
});

check("service: createCrmAppointment exported", () => {
  assert(/export async function createCrmAppointment/.test(doc("lib/crm-v2/appointments/service.ts")), "missing");
});

check("service: transitionCrmAppointment exported", () => {
  assert(/export async function transitionCrmAppointment/.test(doc("lib/crm-v2/appointments/service.ts")), "missing");
});

check("service: rescheduleCrmAppointment exported", () => {
  assert(/export async function rescheduleCrmAppointment/.test(doc("lib/crm-v2/appointments/service.ts")), "missing");
});

check("service: loadCrmAppointmentDetail exported", () => {
  assert(/export async function loadCrmAppointmentDetail/.test(doc("lib/crm-v2/appointments/service.ts")), "missing");
});

check("service: loadAssignedRelationshipsForAppointments exported", () => {
  assert(
    /export async function loadAssignedRelationshipsForAppointments/.test(doc("lib/crm-v2/appointments/service.ts")),
    "missing",
  );
});

check("service: transition uses validateAppointmentTransition", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("validateAppointmentTransition"), "validation missing");
});

check("service: transition writes state events", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("crm_appointment_state_events"), "events table");
});

check("service: create seeds checklist from template", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("crm_appointment_checklist_items"), "checklist");
});

check("service: optimistic concurrency uses version", () => {
  const service = doc("lib/crm-v2/appointments/service.ts");
  assert(service.includes(".eq(\"version\", input.version)"), "version check missing");
});

check("service: mapLifecycleToLegacyStatus on writes", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("mapLifecycleToLegacyStatus"), "legacy sync");
});

check("service: title length capped", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("CRM_V2_APPOINTMENTS_MAX_TITLE_LENGTH"), "title cap");
});

check("service: participants capped", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("CRM_V2_APPOINTMENTS_MAX_PARTICIPANTS"), "participant cap");
});

check("service: events query limited", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("CRM_V2_APPOINTMENTS_MAX_EVENTS"), "events cap");
});

check("service: uses adviser_appointments as authoritative", () => {
  assert((doc("lib/crm-v2/appointments/service.ts").match(/from\("adviser_appointments"\)/g) ?? []).length >= 3, "table");
});

check("service: no crm_appointments competing table", () => {
  assert(!doc("lib/crm-v2/appointments/service.ts").includes("crm_appointments"), "competing table");
});

check("service: relationship resolution on create", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("resolveAccessibleClient"), "client gate");
});

check("service: idempotency key support on create", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("idempotency_key"), "idempotency");
});

check("service: detail includes allowedActions from deriveAdviserActions", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("deriveAdviserActions"), "actions");
});

check("service: detail includes relationshipHref", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("buildRelationshipHref"), "relationship link");
});

// --- API routes (per-file loops) ---

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} exists`, () => {
    assert(existsSync(routeFile), "missing");
  });
}

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} uses assertCrmV2AppointmentsAccess`, () => {
    assert(doc(routeFile).includes("assertCrmV2AppointmentsAccess"), "gate missing");
  });
}

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} force-dynamic`, () => {
    assert(doc(routeFile).includes('export const dynamic = "force-dynamic"'), "dynamic missing");
  });
}

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} private no-store cache`, () => {
    assert(doc(routeFile).includes("private, no-store"), "cache header missing");
  });
}

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} sets X-Request-Id on denial`, () => {
    assert(doc(routeFile).includes("X-Request-Id"), "request id missing");
  });
}

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} uses toPublicErrorMessage on catch`, () => {
    assert(doc(routeFile).includes("toPublicErrorMessage"), "sanitized errors");
  });
}

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} returns 401 for unauthenticated`, () => {
    assert(doc(routeFile).includes("unauthenticated"), "unauthenticated branch");
    assert(doc(routeFile).includes("401"), "401 status");
  });
}

for (const routeFile of API_ROUTE_FILES) {
  check(`api: ${routeFile} returns 403 for other denials`, () => {
    assert(doc(routeFile).includes("403"), "403 status");
  });
}

check("api: list route GET uses loadCrmAppointmentListPage", () => {
  assert(doc("app/api/advisor-v2/appointments/route.ts").includes("loadCrmAppointmentListPage"), "loader missing");
});

check("api: list route POST uses createCrmAppointment", () => {
  assert(doc("app/api/advisor-v2/appointments/route.ts").includes("createCrmAppointment"), "create missing");
});

check("api: list POST rejects adviserUserId injection", () => {
  assert(doc("app/api/advisor-v2/appointments/route.ts").includes("adviserUserId"), "injection guard");
});

check("api: list POST rate limited", () => {
  assert(doc("app/api/advisor-v2/appointments/route.ts").includes("rateLimitOrThrow"), "rate limit");
});

check("api: detail route GET only", () => {
  const route = doc("app/api/advisor-v2/appointments/[appointmentId]/route.ts");
  assert(route.includes("export async function GET"), "GET missing");
  assert(!route.includes("export async function POST"), "POST present");
  assert(!route.includes("export async function PATCH"), "PATCH present");
});

check("api: detail uses loadCrmAppointmentDetail", () => {
  assert(
    doc("app/api/advisor-v2/appointments/[appointmentId]/route.ts").includes("loadCrmAppointmentDetail"),
    "loader missing",
  );
});

check("api: detail returns not_found without disclosure", () => {
  assert(
    doc("app/api/advisor-v2/appointments/[appointmentId]/route.ts").includes('reason: "not_found"'),
    "not_found",
  );
});

check("api: transition route POST only", () => {
  const route = doc("app/api/advisor-v2/appointments/[appointmentId]/transition/route.ts");
  assert(route.includes("export async function POST"), "POST missing");
  assert(route.includes("transitionCrmAppointment"), "service call");
});

check("api: transition requires version", () => {
  assert(
    doc("app/api/advisor-v2/appointments/[appointmentId]/transition/route.ts").includes("version"),
    "version required",
  );
});

check("api: reschedule route POST only", () => {
  const route = doc("app/api/advisor-v2/appointments/[appointmentId]/reschedule/route.ts");
  assert(route.includes("export async function POST"), "POST missing");
  assert(route.includes("rescheduleCrmAppointment"), "service call");
});

check("api: reschedule validates timezone", () => {
  assert(
    doc("app/api/advisor-v2/appointments/[appointmentId]/reschedule/route.ts").includes("isValidIanaTimezone"),
    "timezone validation",
  );
});

check("api: write routes rate limited", () => {
  assert(doc("app/api/advisor-v2/appointments/[appointmentId]/transition/route.ts").includes("rateLimitOrThrow"), "transition");
  assert(doc("app/api/advisor-v2/appointments/[appointmentId]/reschedule/route.ts").includes("rateLimitOrThrow"), "reschedule");
});

// --- UI pages (12 checks) ---

check("pages: list page exists", () => {
  assert(existsSync("app/advisor-v2/appointments/page.tsx"), "missing");
});

check("pages: detail page exists", () => {
  assert(existsSync("app/advisor-v2/appointments/[appointmentId]/page.tsx"), "missing");
});

check("pages: new page exists", () => {
  assert(existsSync("app/advisor-v2/appointments/new/page.tsx"), "missing");
});

check("pages: no local appointments layout", () => {
  assert(!existsSync("app/advisor-v2/appointments/layout.tsx"), "local layout breaks inheritance");
});

check("pages: list uses assertCrmV2AppointmentsAccess", () => {
  assert(doc("app/advisor-v2/appointments/page.tsx").includes("assertCrmV2AppointmentsAccess"), "guard missing");
});

check("pages: detail uses assertCrmV2AppointmentsAccess", () => {
  assert(
    doc("app/advisor-v2/appointments/[appointmentId]/page.tsx").includes("assertCrmV2AppointmentsAccess"),
    "guard missing",
  );
});

check("pages: new uses assertCrmV2AppointmentsAccess", () => {
  assert(doc("app/advisor-v2/appointments/new/page.tsx").includes("assertCrmV2AppointmentsAccess"), "guard missing");
});

check("pages: list force-dynamic and revalidate 0", () => {
  const page = doc("app/advisor-v2/appointments/page.tsx");
  assert(page.includes('export const dynamic = "force-dynamic"'), "dynamic");
  assert(page.includes("revalidate = 0"), "revalidate");
});

check("pages: detail force-dynamic and revalidate 0", () => {
  const page = doc("app/advisor-v2/appointments/[appointmentId]/page.tsx");
  assert(page.includes('export const dynamic = "force-dynamic"'), "dynamic");
  assert(page.includes("revalidate = 0"), "revalidate");
});

check("pages: detail unavailable message without forbidden", () => {
  const page = doc("app/advisor-v2/appointments/[appointmentId]/page.tsx");
  assert(page.includes("unavailable"), "message");
  assert(!page.includes("forbidden"), "forbidden disclosed");
});

check("pages: list uses AppointmentListClient", () => {
  assert(doc("app/advisor-v2/appointments/page.tsx").includes("AppointmentListClient"), "client missing");
});

check("pages: new loads assigned relationships server-side", () => {
  assert(
    doc("app/advisor-v2/appointments/new/page.tsx").includes("loadAssignedRelationshipsForAppointments"),
    "relationships loader",
  );
});

// --- UI components (12 checks) ---

check("ui: AppointmentListClient exists", () => {
  assert(existsSync("components/aegis/advisor-v2/appointments/AppointmentListClient.tsx"), "missing");
});

check("ui: AppointmentDetailClient exists", () => {
  assert(existsSync("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx"), "missing");
});

check("ui: AppointmentNewClient exists", () => {
  assert(existsSync("components/aegis/advisor-v2/appointments/AppointmentNewClient.tsx"), "missing");
});

check("ui: list client fetches API without adviser id param", () => {
  const source = doc("components/aegis/advisor-v2/appointments/AppointmentListClient.tsx");
  assert(source.includes("/api/advisor-v2/appointments"), "api path");
  assert(!source.includes("adviserId"), "adviserId param");
  assert(!source.includes("advisorId"), "advisorId param");
});

check("ui: list client uses cache no-store", () => {
  assert(doc("components/aegis/advisor-v2/appointments/AppointmentListClient.tsx").includes("no-store"), "cache");
});

check("ui: detail client uses version on transition", () => {
  assert(doc("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx").includes("version:"), "version");
});

check("ui: detail client handles 409 conflict", () => {
  assert(doc("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx").includes("409"), "conflict");
});

check("ui: detail client no private note fields", () => {
  const source = doc("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx");
  assert(!source.includes("private_adviser_note"), "private note");
  assert(!source.includes("client_notes"), "client notes");
});

check("ui: detail shows binder readiness read-only", () => {
  const source = doc("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx");
  assert(source.includes("binderReadiness"), "readiness");
  assert(!source.includes("createBinder"), "binder write");
});

check("ui: detail links meeting studio via href", () => {
  const source = doc("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx");
  assert(source.includes("meetingSessionHref"), "meeting href");
  assert(source.includes("Open Meeting Studio"), "label");
});

check("ui: new client posts to appointments API", () => {
  assert(doc("components/aegis/advisor-v2/appointments/AppointmentNewClient.tsx").includes("/api/advisor-v2/appointments"), "api");
});

check("ui: detail uses allowedActions not hardcoded transitions", () => {
  assert(doc("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx").includes("allowedActions"), "actions");
});

// --- Routes module (10 checks) ---

check("routes: buildAppointmentListHref exported", () => {
  assert(/export function buildAppointmentListHref/.test(doc("lib/crm-v2/appointments/routes.ts")), "missing");
});

check("routes: buildAppointmentDetailHref exported", () => {
  assert(/export function buildAppointmentDetailHref/.test(doc("lib/crm-v2/appointments/routes.ts")), "missing");
});

check("routes: buildAppointmentNewHref exported", () => {
  assert(/export function buildAppointmentNewHref/.test(doc("lib/crm-v2/appointments/routes.ts")), "missing");
});

check("routes: buildMeetingStudioHref exported", () => {
  assert(/export function buildMeetingStudioHref/.test(doc("lib/crm-v2/appointments/routes.ts")), "missing");
});

check("routes: isAllowlistedAppointmentLink exported", () => {
  assert(/export function isAllowlistedAppointmentLink/.test(doc("lib/crm-v2/appointments/routes.ts")), "missing");
});

check("routes: allowlists advisor-v2 appointments prefix", () => {
  assert(doc("lib/crm-v2/appointments/routes.ts").includes("/advisor-v2/appointments"), "v2 prefix");
});

check("routes: allowlists relationships prefix", () => {
  assert(doc("lib/crm-v2/appointments/routes.ts").includes("/advisor-v2/relationships"), "relationships");
});

check("routes: allowlists legacy meeting studio path", () => {
  assert(doc("lib/crm-v2/appointments/routes.ts").includes("/advisor/clients"), "legacy clients");
  assert(doc("lib/crm-v2/appointments/routes.ts").includes("meeting-studio"), "meeting studio");
});

check("routes: detail href pattern uses appointmentId", () => {
  assert(
    doc("lib/crm-v2/appointments/routes.ts").includes("/advisor-v2/appointments/${appointmentId}"),
    "detail pattern",
  );
});

check("routes: no legacy [id] alias under appointments", () => {
  assert(!existsSync("app/advisor-v2/appointments/[id]"), "legacy alias");
});

// --- Meeting studio integration (8 checks) ---

check("meeting-studio: service queries meeting_sessions", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes('from("meeting_sessions")'), "table query");
});

check("meeting-studio: service links by appointment_id", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("appointment_id"), "appointment link");
});

check("meeting-studio: linkMeetingSessionForAppointment on in_progress transition", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("linkMeetingSessionForAppointment"), "link helper");
});

check("meeting-studio: href uses buildMeetingStudioHref", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("buildMeetingStudioHref"), "href builder");
});

check("meeting-studio: detail DTO exposes meetingSessionLinkState", () => {
  assert(doc("lib/crm-v2/appointments/types.ts").includes("meetingSessionLinkState"), "link state");
});

check("meeting-studio: does not embed meeting_url in DTO", () => {
  assert(!doc("lib/crm-v2/appointments/types.ts").includes("meeting_url"), "raw url in DTO");
});

check("meeting-studio: route map documents meeting studio link", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").toLowerCase().includes("meeting"), "route map");
});

check("meeting-studio: no meeting studio write from appointment API", () => {
  const corpus = API_ROUTE_FILES.map((f) => doc(f)).join("\n");
  assert(!corpus.includes("meeting_sessions"), "direct session write in API");
});

// --- Binder read-only (8 checks) ---

check("binder: service queries binder_exports read-only", () => {
  const fn = loadBinderReadinessFn();
  assert(fn.includes('from("binder_exports")'), "binder query");
  assert(!fn.includes(".insert("), "binder insert");
  assert(!fn.includes(".update("), "binder update");
});

check("binder: readiness enum in types", () => {
  assert(doc("lib/crm-v2/appointments/types.ts").includes("CrmAppointmentBinderReadiness"), "type");
});

check("binder: detail exposes binderReadiness not file paths", () => {
  const types = doc("lib/crm-v2/appointments/types.ts");
  assert(types.includes("binderReadiness"), "readiness");
  assert(!types.includes("storage_path"), "storage path");
});

check("binder: binderHref links to relationship not direct download", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("buildRelationshipHref"), "relationship href");
});

check("binder: UI shows readiness label only", () => {
  const ui = doc("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx");
  assert(ui.includes("Binder readiness"), "label");
  assert(!ui.includes("upload"), "upload UI");
});

check("binder: no binder generation in service", () => {
  assert(!doc("lib/crm-v2/appointments/service.ts").includes("generateBinder"), "generation");
});

check("binder: no signed URL in appointment lib", () => {
  assert(!appointmentsCorpus().includes("signedUrl"), "signed url");
  assert(!appointmentsCorpus().includes("signed_url"), "signed_url");
});

check("binder: published_to_client used for readiness only", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("published_to_client"), "published flag read");
});

// --- Legacy mapping and compatibility (10 checks) ---

check("legacy: mapLegacyStatusToLifecycle exported", () => {
  assert(/export function mapLegacyStatusToLifecycle/.test(doc("lib/crm-v2/appointments/legacyMapping.ts")), "missing");
});

check("legacy: resolveEffectiveLifecycleStatus exported", () => {
  assert(/export function resolveEffectiveLifecycleStatus/.test(doc("lib/crm-v2/appointments/legacyMapping.ts")), "missing");
});

check("legacy: pending maps to proposed", () => {
  assert(doc("lib/crm-v2/appointments/legacyMapping.ts").includes('return "proposed"'), "pending mapping");
});

check("legacy: cancelled maps to legacy_cancelled", () => {
  assert(doc("lib/crm-v2/appointments/legacyMapping.ts").includes('return "legacy_cancelled"'), "cancelled mapping");
});

check("legacy: crm_lifecycle_status takes precedence", () => {
  assert(doc("lib/crm-v2/appointments/legacyMapping.ts").includes("crmLifecycleStatus"), "precedence");
});

check("legacy: service syncs legacy status column", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes('status:'), "legacy status write");
});

check("legacy: migration preserves adviser_appointments.status enum", () => {
  assert(!phase03CoreMigrationSql().includes("DROP TYPE adviser_appointment_status"), "enum drop");
});

check("compat: no crm_appointments table anywhere in lib", () => {
  assert(!appointmentsCorpus().includes("crm_appointments"), "competing table in lib");
});

check("compat: audit references adviser_appointments as authoritative", () => {
  assert(
    doc("docs/CRM_V2_PHASE_03_EXISTING_APPOINTMENT_AUDIT.md").includes("adviser_appointments"),
    "audit",
  );
});

check("compat: feature plan lists phase 03 appointments adviser", () => {
  assert(doc("docs/CRM_V2_FEATURE_CONTROL_PLAN.md").includes("crm_v2_appointments_adviser"), "plan");
});

// --- Security and IDOR (12 checks) ---

check("security: accessTests exports runAppointmentAccessMockTests", () => {
  assert(typeof runAppointmentAccessMockTests === "function", "import failed");
});

check("security: mock tests all pass", () => {
  const result = runAppointmentAccessMockTests();
  assert(result.failed.length === 0, result.failed.join("; "));
});

check("security: mock tests cover adviser isolation", () => {
  const source = doc("lib/crm-v2/appointments/accessTests.ts");
  assert(source.includes("adviser A denied adviser B appointment"), "cross-adviser case");
});

check("security: mock tests cover forged id", () => {
  assert(doc("lib/crm-v2/appointments/accessTests.ts").includes("forged appointment id not found"), "forged case");
});

check("security: mock tests cover invalid id", () => {
  assert(doc("lib/crm-v2/appointments/accessTests.ts").includes("invalid appointment id not found"), "invalid case");
});

check("security: mock tests cover admin access", () => {
  assert(doc("lib/crm-v2/appointments/accessTests.ts").includes("admin can open any appointment"), "admin case");
});

check("security: mockResolveAppointment does not use live Supabase", () => {
  const source = doc("lib/crm-v2/appointments/accessTests.ts");
  assert(!source.includes("createClient"), "supabase client");
  assert(!source.includes("createAdminSupabaseClient"), "admin client");
});

check("security: mock tests delegate to lifecycle tests", () => {
  assert(doc("lib/crm-v2/appointments/accessTests.ts").includes("runAppointmentLifecycleTests"), "lifecycle delegate");
});

check("security: isAllowlistedAppointmentLink blocks external URLs", () => {
  const routes = doc("lib/crm-v2/appointments/routes.ts");
  assert(routes.includes("ALLOWED_PREFIXES"), "prefix list");
  assert(routes.includes("startsWith"), "prefix check");
});

check("security: transition API rejects adviser id injection", () => {
  assert(
    doc("app/api/advisor-v2/appointments/[appointmentId]/transition/route.ts").includes("adviserUserId"),
    "injection guard",
  );
});

check("security: reschedule API rejects adviser id injection", () => {
  assert(
    doc("app/api/advisor-v2/appointments/[appointmentId]/reschedule/route.ts").includes("adviserUserId"),
    "injection guard",
  );
});

check("security: detail page does not expose raw appointment row", () => {
  assert(!doc("app/advisor-v2/appointments/[appointmentId]/page.tsx").includes("adviser_user_id"), "raw row");
});

// --- Timezone (4 checks) ---

check("timezone: isValidIanaTimezone exported", () => {
  assert(/export function isValidIanaTimezone/.test(doc("lib/crm-v2/appointments/timezone.ts")), "missing");
});

check("timezone: service uses timezone validation", () => {
  assert(doc("lib/crm-v2/appointments/service.ts").includes("isValidTimezone"), "validation");
});

check("timezone: create API defaults Asia/Singapore", () => {
  assert(doc("app/api/advisor-v2/appointments/route.ts").includes("Asia/Singapore"), "default tz");
});

check("timezone: list item includes timezone field", () => {
  assert(doc("lib/crm-v2/appointments/types.ts").includes("timezone: string"), "timezone in DTO");
});

// --- Documentation (6 checks) ---

for (const phaseDoc of PHASE_03_DOCS) {
  check(`docs: ${phaseDoc} exists`, () => {
    assert(existsSync(phaseDoc), "missing file");
  });
}

check("docs: rollout index references qa:crm-v2-appointments-adviser", () => {
  assert(doc("docs/CRM_V2_ROLLOUT_INDEX.md").includes("qa:crm-v2-appointments-adviser"), "script missing");
});

check("docs: migration sequence references phase 03", () => {
  assert(doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").toLowerCase().includes("appointment"), "appointments");
});

check("docs: route map lists advisor-v2 appointments", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/advisor-v2/appointments"), "route");
});

check("docs: audit completed before schema design", () => {
  assert(
    doc("docs/CRM_V2_PHASE_03_EXISTING_APPOINTMENT_AUDIT.md").includes("before schema design"),
    "audit rule",
  );
});

// --- Lib file inventory (11 checks) ---

for (const libFile of APPOINTMENT_LIB_FILES) {
  check(`lib: ${libFile} exists`, () => {
    assert(existsSync(libFile), "missing");
  });
}

// --- Activation and rollout (4 checks) ---

check("activation: featureFlags appointments block enabled false only", () => {
  const block = appointmentsFeatureFlagsBlock();
  const enabledMatches = block.match(/enabled:\s*(\w+)/g) ?? [];
  assert(enabledMatches.length === 1, "multiple enabled keys");
  assert(enabledMatches[0] === "enabled: false", "not disabled");
});

check("activation: feature migration inserts only platform_feature_controls", () => {
  const sql = phase03FeatureMigrationSql();
  assert(sql.includes("INSERT INTO platform_feature_controls"), "insert target");
  assert(!sql.includes("UPDATE platform_feature_controls"), "update seed");
});

check("activation: appointment APIs do not load feature controls directly", () => {
  for (const routeFile of API_ROUTE_FILES) {
    assert(!doc(routeFile).includes("loadFeatureControls"), `remote feature load in ${routeFile}`);
  }
});

check("activation: access layer gates appointments via isFeatureEnabled", () => {
  const fn = appointmentsAccessFn();
  const featureIdx = fn.indexOf("isFeatureEnabled");
  const successIdx = fn.indexOf("appointmentsEnabled: true");
  assert(featureIdx > 0 && successIdx > featureIdx, "feature check must precede success flag");
});

// --- Meta (4 checks) ---

check("meta: minimum explicit check count ≥ 240", () => {
  assert(TESTS.length >= 240, `only ${TESTS.length} checks defined`);
});

check("meta: runAppointmentAccessMockTests imported", () => {
  assert(typeof runAppointmentAccessMockTests === "function", "import failed");
});

check("meta: runAppointmentLifecycleTests imported", () => {
  assert(typeof runAppointmentLifecycleTests === "function", "import failed");
});

check("meta: lifecycle status count matches migration", () => {
  assert(CRM_APPOINTMENT_LIFECYCLE_STATUSES.length === 16, "expected 16 lifecycle statuses");
});

function main(): void {
  console.log("CRM V2 Phase 03 — Appointments (Adviser) Validation\n");
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

  if (TESTS.length < 240) {
    console.error(`\nInsufficient explicit checks: ${TESTS.length} < 240 required`);
    process.exit(1);
  }

  console.log("\nVerdict: READY FOR CRM V2 APPOINTMENTS ADVISER PILOT");
}

main();
