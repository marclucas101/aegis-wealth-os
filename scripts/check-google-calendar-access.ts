/**
 * Phase 6D Google Calendar booking access control checks (static analysis).
 * Run: npm run qa:calendar
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Calendar booking validation failed: ${message}`);
  }
}

function main(): void {
  let passed = 0;

  assert(
    existsSync(
      join(ROOT, "supabase/migrations/202606100020_google_calendar_booking.sql"),
    ),
    "calendar booking migration missing",
  );
  passed += 1;

  const migration = read(
    join(ROOT, "supabase/migrations/202606100020_google_calendar_booking.sql"),
  );
  assert(
    migration.includes("adviser_calendar_connections"),
    "migration creates adviser_calendar_connections",
  );
  assert(
    migration.includes("encrypted_refresh_token"),
    "refresh tokens stored encrypted",
  );
  assert(
    migration.includes("adviser_appointments"),
    "migration creates adviser_appointments",
  );
  assert(
    migration.includes("adviser_appointments_no_overlap"),
    "overlap constraint present",
  );
  assert(
    migration.includes("adviser_calendar_connections_no_client_access"),
    "tokens blocked from authenticated RLS",
  );
  passed += 1;

  const tokenEncryption = read(join(ROOT, "lib/security/tokenEncryption.ts"));
  assert(tokenEncryption.includes("encryptSecret"), "encryption helper exists");
  assert(
    tokenEncryption.includes("GOOGLE_TOKEN_ENCRYPTION_KEY"),
    "encryption key env referenced",
  );
  passed += 1;

  const calendarClient = read(join(ROOT, "lib/google/calendarClient.ts"));
  assert(
    !calendarClient.includes("localStorage"),
    "no localStorage token storage",
  );
  assert(
    calendarClient.includes("encryptGoogleToken"),
    "tokens encrypted before persistence",
  );
  passed += 1;

  const oauthCallback = read(
    join(ROOT, "app/api/google-calendar/callback/route.ts"),
  );
  assert(oauthCallback.includes("verifyOAuthState"), "OAuth state validated");
  assert(
    !oauthCallback.includes("encrypted_refresh_token"),
    "callback does not expose tokens",
  );
  passed += 1;

  const bookApi = read(join(ROOT, "app/api/my-adviser/book/route.ts"));
  assert(
    bookApi.includes("ensureUserClientProfile"),
    "booking uses authenticated client session",
  );
  assert(
    bookApi.includes("bookAppointmentForAssignedAdviser"),
    "booking derives adviser from assignment",
  );
  assert(
    bookApi.includes("idempotencyKey"),
    "idempotency key supported",
  );
  assert(
    !bookApi.includes("adviserUserId") && !bookApi.includes("advisor_user_id"),
    "client cannot supply adviser ID",
  );
  passed += 1;

  const persistence = read(
    join(ROOT, "lib/supabase/appointmentsPersistence.ts"),
  );
  assert(
    persistence.includes("session.client.advisor_user_id"),
    "assignment derived from client record",
  );
  assert(
    persistence.includes("isSlotStillAvailable"),
    "server rechecks availability before booking",
  );
  assert(
    persistence.includes("cancelGoogleCalendarEvent"),
    "compensating cleanup on DB failure",
  );
  passed += 1;

  const connectApi = read(
    join(ROOT, "app/api/advisor/calendar/connect/route.ts"),
  );
  assert(
    connectApi.includes("requireAdvisorAccess"),
    "OAuth connect gated to advisers",
  );
  passed += 1;

  const navigation = read(join(ROOT, "lib/navigation.ts"));
  assert(
    navigation.includes('href: "/advisor/my-profile"') &&
      navigation.includes("advisorOnly: true"),
    "My Profile (calendar & booking setup) hidden from clients",
  );
  assert(
    navigation.includes('href: "/advisor/appointments"'),
    "Appointments nav present",
  );
  passed += 1;

  const calendarRedirect = read(join(ROOT, "app/advisor/calendar/page.tsx"));
  assert(
    calendarRedirect.includes("redirect(") &&
      calendarRedirect.includes("/advisor/my-profile"),
    "legacy /advisor/calendar redirects to My Profile",
  );
  passed += 1;

  const envDocs = read(join(ROOT, "docs/ENVIRONMENT_VARIABLES.md"));
  assert(envDocs.includes("GOOGLE_CLIENT_ID"), "Google env vars documented");
  assert(envDocs.includes("GOOGLE_TOKEN_ENCRYPTION_KEY"), "encryption key documented");
  passed += 1;

  console.log(`Calendar booking validations passed (${passed} assertion groups).`);
}

main();
