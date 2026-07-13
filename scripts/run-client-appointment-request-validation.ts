/**
 * CRM V2 Phase 18A — Client appointment request reintroduction validation.
 * Run: npm run qa:client-appointment-request
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];
const TESTS: TestCase[] = [];
let nextId = 1;

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const CLIENT_ROUTES = [
  "app/appointments/page.tsx",
  "app/appointments/request/page.tsx",
  "app/appointments/[appointmentId]/page.tsx",
] as const;

const CLIENT_APIS = [
  "app/api/appointments/route.ts",
  "app/api/appointments/[appointmentId]/route.ts",
  "app/api/appointments/[appointmentId]/confirm/route.ts",
  "app/api/appointments/[appointmentId]/decline/route.ts",
  "app/api/appointments/[appointmentId]/reschedule-request/route.ts",
  "app/api/appointments/[appointmentId]/cancel/route.ts",
  "app/api/appointments/[appointmentId]/topics/route.ts",
  "app/api/appointments/[appointmentId]/checklist/[itemId]/route.ts",
] as const;

const ADVISER_CANONICAL = "app/advisor/(crm-v2)/workspace/appointments/page.tsx";

const FROZEN_CLIENT_MODULES = [
  "app/actions/page.tsx",
  "app/requests/page.tsx",
  "app/protection/page.tsx",
  "app/preferences/page.tsx",
  "app/preferences/advocacy/page.tsx",
  "app/messages/page.tsx",
] as const;

const ADVISER_ONLY_IMPORT_PATTERNS = [
  "advisor-v2/appointments",
  "assertCrmV2AppointmentsAccess",
  "assertCrmV2Access",
  "AdviserCrmV2Shell",
  "requireAdvisorAccess",
] as const;

const CLIENT_INTERNAL_PATTERNS = [
  "CRM V2",
  "CRM_V2_DEBUG",
  "crm_v2_pilot",
  "pilot mode",
  "pilot UUID",
  "Marc",
  "fake client",
  "00000000-0000",
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

// --- Routes exist ---

for (const route of CLIENT_ROUTES) {
  check(`client route exists: ${route}`, () => {
    assert(existsSync(join(ROOT, route)), `missing ${route}`);
  });
}

check("adviser canonical appointments route exists", () => {
  assert(existsSync(join(ROOT, ADVISER_CANONICAL)), "missing workspace appointments page");
});

// --- Feature gating ---

check("client access checks crm_v2_master", () => {
  const access = read("lib/crm-v2/access.ts");
  const fn = access.slice(
    access.indexOf("assertCrmV2ClientAppointmentsAccess"),
    access.indexOf("export async function assertCrmV2ServiceAccess"),
  );
  assert(fn.includes("CRM_V2_MASTER_FEATURE_KEY"), "master gate missing");
  assert(fn.includes("CRM_V2_APPOINTMENTS_CLIENT_FEATURE_KEY"), "client flag missing");
  assert(fn.includes("client_visible"), "client_visible check missing");
});

check("client pages use assertCrmV2ClientAppointmentsAccess", () => {
  for (const route of CLIENT_ROUTES) {
    const src = read(route);
    assert(src.includes("assertCrmV2ClientAppointmentsAccess"), route);
  }
});

check("client APIs use assertCrmV2ClientAppointmentsAccess", () => {
  for (const api of CLIENT_APIS) {
    const src = read(api);
    assert(src.includes("assertCrmV2ClientAppointmentsAccess"), api);
  }
});

check("adviser appointments API uses assertCrmV2AppointmentsAccess", () => {
  const src = read("app/api/advisor-v2/appointments/route.ts");
  assert(src.includes("assertCrmV2AppointmentsAccess"), "adviser appointments gate missing");
});

// --- No Google Calendar auto-sync from client request ---

check("client appointment service does not import google calendar", () => {
  const src = read("lib/crm-v2/client-appointments/service.ts");
  assert(!src.includes("google-calendar"), "unexpected google calendar import");
  assert(!src.includes("googleCalendar"), "unexpected google calendar call");
  assert(!src.includes("syncGoogle"), "unexpected google sync");
});

check("client POST route does not trigger google calendar", () => {
  const src = read("app/api/appointments/route.ts");
  assert(!src.includes("google-calendar"), "google calendar in client route");
  assert(!src.includes("googleCalendar"), "google calendar in client route");
});

// --- No external communication send from client request ---

check("client create path has no email/SMS/WhatsApp send", () => {
  const src = read("lib/crm-v2/client-appointments/service.ts");
  const createBlock = src.slice(
    src.indexOf("export async function createClientAppointmentRequest"),
    src.indexOf("export async function transitionClientOwnedAppointment"),
  );
  assert(!createBlock.includes("sendEmail"), "email send in create");
  assert(!createBlock.includes("sendSms"), "sms send in create");
  assert(!createBlock.includes("whatsapp"), "whatsapp in create");
  assert(!createBlock.includes("appointmentNotificationEmail"), "notification email in create");
});

// --- Client route isolation ---

check("client request page does not import adviser-only components", () => {
  const src = read("app/appointments/request/page.tsx");
  for (const pattern of ADVISER_ONLY_IMPORT_PATTERNS) {
    assert(!src.includes(pattern), `adviser import: ${pattern}`);
  }
});

check("client request form does not import adviser-only components", () => {
  const src = read("components/aegis/client/ClientAppointmentRequestForm.tsx");
  for (const pattern of ADVISER_ONLY_IMPORT_PATTERNS) {
    assert(!src.includes(pattern), `adviser import: ${pattern}`);
  }
});

check("client POST rejects forged client/adviser ids", () => {
  const src = read("app/api/appointments/route.ts");
  assert(src.includes("rejectUnexpectedFields"), "unexpected field guard missing");
  assert(src.includes('"clientId"'), "clientId rejection missing");
  assert(src.includes('"adviserId"'), "adviserId rejection missing");
});

check("client service uses session-derived client id", () => {
  const route = read("app/api/appointments/route.ts");
  assert(route.includes("access.client.id"), "session client id not used");
  assert(route.includes("access.client.advisor_user_id"), "assigned adviser from client row");
});

// --- Client copy safety ---

check("client request page has no pilot/internal wording", () => {
  const combined = [
    read("app/appointments/request/page.tsx"),
    read("components/aegis/client/ClientAppointmentRequestForm.tsx"),
  ].join("\n");
  for (const pattern of CLIENT_INTERNAL_PATTERNS) {
    assert(!combined.toLowerCase().includes(pattern.toLowerCase()), `found: ${pattern}`);
  }
});

check("client confirmation does not expose appointment UUID", () => {
  const src = read("components/aegis/client/ClientAppointmentRequestForm.tsx");
  assert(!src.includes("payload.appointmentId"), "appointment id shown in UI");
  assert(!src.includes("{saved}"), "raw id in confirmation");
  assert(src.includes("Request received"), "confirmation heading missing");
  assert(src.includes("not a confirmed appointment"), "expectation copy missing");
});

check("client unavailable states are user-friendly", () => {
  for (const route of CLIENT_ROUTES) {
    const src = read(route);
    assert(src.includes("unavailable"), route);
    assert(!src.includes("feature_disabled"), "raw reason in page");
    assert(!src.includes("JSON.stringify"), "raw json in page");
  }
});

// --- Idempotency and lifecycle ---

check("client service supports idempotency key", () => {
  const src = read("lib/crm-v2/client-appointments/service.ts");
  assert(src.includes("idempotency_key"), "idempotency missing");
  assert(src.includes('crm_lifecycle_status: "requested"'), "requested lifecycle missing");
});

check("client service scopes by client_id", () => {
  const src = read("lib/crm-v2/client-appointments/service.ts");
  assert(src.includes('.eq("client_id", clientId)'), "client scope missing");
});

check("client checklist loads client/shared visibility only", () => {
  const src = read("lib/crm-v2/client-appointments/service.ts");
  assert(src.includes('.in("visibility", ["client", "shared"])'), "visibility filter missing");
});

// --- Adviser handling ---

check("adviser list has client requests view", () => {
  const routes = read("lib/crm-v2/appointments/routes.ts");
  assert(routes.includes('"requests"'), "requests view missing");
  const list = read("lib/crm-v2/appointments/listQueries.ts");
  assert(list.includes('"requested"'), "requested filter missing");
});

check("adviser detail shows client request callout", () => {
  const src = read("components/aegis/advisor-v2/appointments/AppointmentDetailClient.tsx");
  assert(src.includes('lifecycleStatus === "requested"'), "requested callout missing");
});

// --- Frozen client modules untouched (existence only — no Phase 18A edits expected) ---

for (const route of FROZEN_CLIENT_MODULES) {
  check(`frozen client module still present: ${route}`, () => {
    assert(existsSync(join(ROOT, route)), `missing ${route}`);
  });
}

// --- No fake client IDs in client appointment flow ---

check("client appointment flow has no hardcoded UUIDs", () => {
  const paths = [
    "components/aegis/client/ClientAppointmentRequestForm.tsx",
    "components/aegis/client/ClientAppointmentsDashboard.tsx",
    "components/aegis/client/ClientAppointmentDetail.tsx",
    "lib/crm-v2/client-appointments/service.ts",
    ...CLIENT_ROUTES,
    ...CLIENT_APIS,
  ];
  for (const path of paths) {
    const src = read(path);
    const matches = src.match(new RegExp(UUID_RE, "g"));
    if (matches) {
      throw new Error(`hardcoded UUID in ${path}`);
    }
  }
});

// --- Phase 18A docs ---

check("Phase 18A audit doc exists", () => {
  assert(
    existsSync(join(ROOT, "docs/CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_AUDIT.md")),
    "audit doc missing",
  );
});

check("Phase 18A reintroduction doc exists", () => {
  assert(
    existsSync(
      join(ROOT, "docs/CRM_V2_PHASE_18A_CLIENT_APPOINTMENT_REQUEST_REINTRODUCTION.md"),
    ),
    "reintroduction doc missing",
  );
});

check("rollout index references Phase 18A", () => {
  const index = read("docs/CRM_V2_ROLLOUT_INDEX.md");
  assert(index.includes("18A") || index.includes("Phase 18A"), "rollout index not updated");
});

function main(): void {
  console.log("CRM V2 Phase 18A — Client appointment request validation\n");
  console.log(`Defined checks: ${TESTS.length}\n`);

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
