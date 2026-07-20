/**
 * CRM V2 Phase 18B — Client appointment pilot readiness (repository-safe).
 * Run: npm run qa:client-appointment-pilot-readiness
 *
 * Does NOT claim staging, production, remote SQL, or real-user pilot execution.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];
const TESTS: TestCase[] = [];
let nextId = 1;

const FROZEN_CLIENT = [
  "app/actions/page.tsx",
  "app/requests/page.tsx",
  "app/protection/page.tsx",
  "app/preferences/page.tsx",
  "app/preferences/advocacy/page.tsx",
  "app/messages/page.tsx",
] as const;

const PHASE_18B_DOCS = [
  "docs/CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_BASELINE_AUDIT.md",
  "docs/CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_RUNBOOK.md",
  "docs/CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_EVIDENCE_TEMPLATE.md",
  "docs/CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_READINESS.md",
] as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function check(name: string, fn: () => void): void {
  TESTS.push({ id: nextId++, name, run: fn });
}

// --- Docs ---

for (const doc of PHASE_18B_DOCS) {
  check(`Phase 18B doc exists: ${doc}`, () => {
    assert(existsSync(join(ROOT, doc)), `missing ${doc}`);
    assert(read(doc).trim().length > 200, "too short");
  });
}

check("Phase 18A docs remain intact", () => {
  assert(
    existsSync(join(ROOT, "docs/CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_AUDIT.md")),
    "18A audit missing",
  );
  assert(
    existsSync(
      join(ROOT, "docs/CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_REINTRODUCTION.md"),
    ),
    "18A reintroduction missing",
  );
});

check("rollout index references Phase 18B", () => {
  const index = read("docs/CRM_V2_ROLLOUT_INDEX.md");
  assert(index.includes("18B") || index.includes("Phase 18B"), "18B missing from index");
});

check("readiness report does not claim staging passed", () => {
  const report = read("docs/CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_READINESS.md");
  assert(!/staging pilot (passed|complete)/i.test(report), "false staging claim");
  assert(
    report.includes("READY FOR OPERATOR STAGING PILOT") ||
      report.includes("CONDITIONAL READY FOR OPERATOR STAGING PILOT") ||
      report.includes("NOT READY FOR OPERATOR STAGING PILOT"),
    "missing readiness decision",
  );
  assert(
    report.includes("INCOMPLETE") || report.includes("outstanding") || report.includes("Outstanding"),
    "must mark manual checks incomplete",
  );
});

check("runbook marks operator/staging steps", () => {
  const runbook = read("docs/CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_RUNBOOK.md");
  assert(runbook.includes("Operator"), "operator label missing");
  assert(runbook.includes("Staging"), "staging label missing");
  assert(runbook.includes("No-go") || runbook.includes("no-go"), "no-go missing");
});

check("evidence template forbids unredacted secrets", () => {
  const tpl = read("docs/CRM_V2_PHASE_18B_CLIENT_APPOINTMENT_PILOT_EVIDENCE_TEMPLATE.md");
  assert(/redact/i.test(tpl), "redaction guidance missing");
  assert(!/NRIC|access token|password/i.test(tpl) || /do not|never|forbid|prohibited|must not/i.test(tpl), "safety language weak");
});

// --- Flow invariants (static) ---

check("canonical authority remains adviser_appointments", () => {
  const service = read("lib/crm-v2/client-appointments/service.ts");
  assert(service.includes('from("adviser_appointments")'), "authority missing");
  assert(service.includes('source: "client_booking"'), "source missing");
  assert(service.includes('crm_lifecycle_status: "requested"'), "lifecycle missing");
});

check("client POST rejects forged identity fields", () => {
  const route = read("app/api/appointments/route.ts");
  assert(route.includes("rejectUnexpectedFields"), "guard missing");
  assert(route.includes('"clientId"'), "clientId reject missing");
  assert(route.includes('"adviserId"') || route.includes('"adviser_user_id"'), "adviser reject missing");
  assert(route.includes("access.client.id"), "session client missing");
  assert(route.includes("access.client.advisor_user_id"), "session adviser missing");
  assert(route.includes("Assigned adviser required"), "orphan guard missing");
});

check("client access requires master + appointments_client", () => {
  const access = read("lib/crm-v2/access.ts");
  const fn = access.slice(
    access.indexOf("assertCrmV2ClientAppointmentsAccess"),
    access.indexOf("export async function assertCrmV2ServiceAccess"),
  );
  assert(fn.includes("CRM_V2_MASTER_FEATURE_KEY"), "master missing");
  assert(fn.includes("CRM_V2_APPOINTMENTS_CLIENT_FEATURE_KEY"), "client flag missing");
  assert(fn.includes("client_visible"), "client_visible missing");
});

check("adviser appointment resolve blocks cross-adviser", () => {
  const identity = read("lib/crm-v2/appointments/identity.ts");
  assert(identity.includes("resolveAuthorizedAppointment"), "resolver missing");
  assert(identity.includes("adviser_user_id !== authUserId"), "cross-adviser check missing");
  assert(identity.includes('reason: "not_found"'), "not_found pattern missing");
});

check("client ownership scoped by client_id", () => {
  const service = read("lib/crm-v2/client-appointments/service.ts");
  assert(service.includes('.eq("client_id", clientId)'), "client scope missing");
  assert(service.includes('.in("visibility", ["client", "shared"])'), "visibility filter missing");
});

check("idempotency key handled on create", () => {
  const service = read("lib/crm-v2/client-appointments/service.ts");
  assert(service.includes("idempotency_key"), "idempotency missing");
  assert(service.includes("idempotencyKey"), "input key missing");
});

check("adviser requests view includes requested lifecycle", () => {
  const list = read("lib/crm-v2/appointments/listQueries.ts");
  assert(list.includes('"requested"'), "requested filter missing");
  const routes = read("lib/crm-v2/appointments/routes.ts");
  assert(routes.includes('"requests"'), "requests view missing");
});

check("requested allows adviser confirm transition", () => {
  const lifecycle = read("lib/crm-v2/appointments/lifecycle.ts");
  const block = lifecycle.slice(
    lifecycle.indexOf("requested: new Set(["),
    lifecycle.indexOf("proposed: new Set(["),
  );
  assert(block.includes('"confirmed"'), "confirm path missing");
  assert(block.includes('"cancelled_by_adviser"'), "cancel path missing");
});

check("client lifecycle labels are user-safe", () => {
  const labels = read("lib/crm-v2/client-appointments/labels.ts");
  assert(labels.includes("clientLifecycleDisplayLabel"), "label helper missing");
  assert(labels.includes("awaiting adviser"), "requested label missing");
  assert(!labels.includes("CRM V2"), "internal wording in client labels");
});

// --- Notification / audit ---

check("create path writes audit and in-app notification only", () => {
  const service = read("lib/crm-v2/client-appointments/service.ts");
  const create = service.slice(
    service.indexOf("export async function createClientAppointmentRequest"),
    service.indexOf("export async function transitionClientOwnedAppointment"),
  );
  assert(create.includes("crm_client_appointment_requested"), "audit action missing");
  assert(create.includes("dbCreateClientNotification"), "notification missing");
  assert(create.includes("appointment_changed"), "notification type missing");
  assert(!create.includes("sendEmail"), "email send present");
  assert(!create.includes("sendSms"), "sms present");
  assert(!create.includes("whatsapp"), "whatsapp present");
  assert(!create.includes("google-calendar"), "google calendar present");
  assert(!create.includes("googleCalendar"), "google calendar present");
});

check("notification failure does not block appointment return", () => {
  const service = read("lib/crm-v2/client-appointments/service.ts");
  assert(
    service.includes("dbCreateClientNotification(") &&
      service.includes(".catch(() => undefined)"),
    "notification must be non-blocking",
  );
});

check("notification persistence has reference idempotency", () => {
  const persistence = read("lib/supabase/clientNotificationsPersistence.ts");
  assert(persistence.includes("reference_type"), "reference_type missing");
  assert(persistence.includes("reference_id"), "reference_id missing");
  assert(persistence.includes("maybeSingle"), "dedupe lookup missing");
});

// --- Calendar / external ---

check("client appointment API has no google calendar imports", () => {
  const route = read("app/api/appointments/route.ts");
  assert(!route.includes("google-calendar"), "google in client API");
  assert(!route.includes("googleCalendar"), "google in client API");
});

check("google calendar sync remains explicit adviser route", () => {
  assert(
    existsSync(
      join(ROOT, "app/api/advisor-v2/appointments/[appointmentId]/google-calendar/sync/route.ts"),
    ),
    "manual sync route missing",
  );
});

// --- Frozen modules + 9F.4 ---

for (const route of FROZEN_CLIENT) {
  check(`frozen client module present: ${route}`, () => {
    assert(existsSync(join(ROOT, route)), `missing ${route}`);
  });
}

check("Phase 9F.4 observation restriction remains in rollout index", () => {
  const index = read("docs/CRM_V2_ROLLOUT_INDEX.md");
  assert(index.includes("9F.4"), "9F.4 missing");
  assert(/Promotions Stage 6|no Promotions/i.test(index), "promotions restriction missing");
});

check("package registers Phase 18B QA script", () => {
  const pkg = read("package.json");
  assert(pkg.includes("qa:client-appointment-pilot-readiness"), "npm script missing");
});

function main(): void {
  console.log("CRM V2 Phase 18B — Client appointment pilot readiness validation\n");
  console.log(`Defined checks: ${TESTS.length}\n`);
  console.log("NOTE: Repository-safe only. Does not execute staging or real-user pilot.\n");

  for (const test of TESTS) {
    try {
      test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  PASS [${test.id}] ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  FAIL [${test.id}] ${test.name}: ${message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (results.some((r) => !r.passed)) process.exit(1);
}

main();
