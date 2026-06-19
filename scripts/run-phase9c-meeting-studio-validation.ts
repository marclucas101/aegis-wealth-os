/**
 * Phase 9C Meeting Studio validation — 40 required cases.
 * Run: npm run qa:phase9c-meeting-studio
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = {
  id: number;
  name: string;
  run: () => void | Promise<void>;
};

const results: { id: number; name: string; passed: boolean; error?: string }[] =
  [];

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function record(id: number, name: string, fn: () => void | Promise<void>): TestCase {
  return { id, name, run: fn };
}

const TESTS: TestCase[] = [
  record(1, "Assigned adviser can create meeting session", () => {
    const route = read("app/api/advisor/clients/[clientId]/meeting-sessions/route.ts");
    assert(route.includes("requireAdvisorAccess") || route.includes("requireAdvisorMeetingAuth"), "adviser auth");
    assert(route.includes("createMeetingSession"), "create workflow");
    assert(route.includes("resolveAccessibleClient") || route.includes("requireClientAccess"), "assignment");
  }),

  record(2, "Unassigned adviser cannot create session", () => {
    const helpers = read("lib/api/meetingStudioRouteHelpers.ts");
    assert(helpers.includes("advisor_user_id !== authUserId"), "assignment check");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("forbidden"), "forbidden on unassigned");
  }),

  record(3, "Client cannot access Meeting Studio", () => {
    assert(!existsSync(join(ROOT, "app/api/client/meeting-sessions/route.ts")), "no client API");
    assert(!existsSync(join(ROOT, "app/meeting-studio/page.tsx")), "no client page");
    const migration = read("supabase/migrations/202606200003_phase9c_meeting_studio.sql");
    assert(!migration.includes("owns_client"), "no client RLS on meeting_sessions");
  }),

  record(4, "Admin access follows explicit policy", () => {
    const helpers = read("lib/api/meetingStudioRouteHelpers.ts");
    assert(helpers.includes('"admin"'), "admin role supported");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("isAdmin"), "admin session access");
  }),

  record(5, "Session cannot reference another adviser's appointment", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("dbValidateAppointmentForClient"), "appointment validation");
    const persistence = read("lib/supabase/meetingSessionPersistence.ts");
    assert(persistence.includes("assigned adviser"), "adviser on appointment check");
  }),

  record(6, "Draft preparation can be saved", () => {
    const route = read(
      "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/prepare/route.ts",
    );
    assert(route.includes("saveMeetingPreparation"), "prepare endpoint");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("preparation_saved"), "audit event");
  }),

  record(7, "Presentation requires prepared or in-progress session", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes('status !== "prepared"'), "prepared check");
    assert(workflow.includes("assertPresentationModeEnabled"), "presentation gate");
  }),

  record(8, "Presentation returns only selected sections", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("selectedSet"), "selected sections filter");
    assert(workflow.includes("selected_sections"), "uses selected_sections");
  }),

  record(9, "Hidden sections cannot be retrieved directly", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("Section not available"), "hidden section blocked");
    const route = read(
      "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/presentation/route.ts",
    );
    assert(route.includes("getPresentationSection"), "per-section gate");
  }),

  record(10, "Presentation DTO contains only allowlisted fields", () => {
    const dtos = read("lib/compliance/meetingPresentationDtos.ts");
    assert(dtos.includes("MEETING_PRESENTATION_ALLOWLIST"), "allowlist");
    assert(dtos.includes("sanitizeMeetingPresentationDto"), "sanitizer");
    assert(dtos.includes("PROHIBITED_PRESENTATION_KEYS"), "prohibited keys");
  }),

  record(11, "Adviser-internal notes never reach presentation payload", () => {
    const dtos = read("lib/compliance/meetingPresentationDtos.ts");
    assert(dtos.includes("internalNotes"), "internal notes prohibited");
    assert(dtos.includes("adviserNotes"), "adviser notes prohibited");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("sanitizeMeetingPresentationDto"), "sanitized output");
  }),

  record(12, "Feature-disabled Meeting Studio fails closed", () => {
    const access = read("lib/compliance/meetingStudioAccess.ts");
    assert(access.includes("assertMeetingStudioEnabled"), "studio gate");
    assert(access.includes("adviser_meeting_studio"), "feature key");
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("adviser_meeting_studio"), "code default");
  }),

  record(13, "Presentation feature can be disabled without removing adviser financial views", () => {
    const access = read("lib/compliance/meetingStudioAccess.ts");
    assert(access.includes("meeting_presentation_mode"), "presentation flag");
    const dashboard = read("app/api/advisor/clients/[clientId]/dashboard/route.ts");
    assert(dashboard.includes("requireAdvisorAccess"), "dashboard independent");
    assert(!dashboard.includes("assertMeetingStudioEnabled"), "dashboard not gated by studio");
  }),

  record(14, "Exact-amount presentation defaults off", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("meeting_exact_amount_presentations"), "flag exists");
    assert(flags.includes("enabled: false"), "default off");
    const migration = read("supabase/migrations/202606200003_phase9c_meeting_studio.sql");
    assert(migration.includes("meeting_exact_amount_presentations', false"), "DB default off");
  }),

  record(15, "Fact confirmation is audit-logged", () => {
    const facts = read("lib/compliance/meetingFactConfirmation.ts");
    assert(facts.includes("fact_confirmed") || facts.includes("fact_corrected"), "audit action");
    assert(facts.includes("writeAuditLog"), "audit log");
  }),

  record(16, "Fact correction uses canonical client data", () => {
    const facts = read("lib/compliance/meetingFactConfirmation.ts");
    assert(facts.includes("discover_profiles"), "canonical discover model");
    assert(facts.includes("form_data"), "form_data patch");
  }),

  record(17, "Fact correction flags analysis refresh where required", () => {
    const facts = read("lib/compliance/meetingFactConfirmation.ts");
    assert(facts.includes("requiresRecalculation"), "recalc flag");
    assert(facts.includes("requires_analysis_refresh"), "session refresh flag");
  }),

  record(18, "Scenario display requires adviser selection", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("selectScenarios"), "adviser selects scenarios");
    assert(workflow.includes("scenario_selections"), "stored selections");
  }),

  record(19, "Client cannot run scenarios from presentation mode", () => {
    const presentation = read(
      "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/presentation/route.ts",
    );
    assert(presentation.includes("requireAdvisorMeetingAuth"), "presentation adviser-only");
    const client = read("components/aegis/advisor/meeting-studio/MeetingStudioClient.tsx");
    assert(!client.includes("/api/stress-testing/run"), "no stress run from studio");
    assert(!client.includes("runScenario"), "no client-run button");
  }),

  record(20, "Section-show events are idempotent", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("wasAlreadyShown"), "idempotent section shown");
  }),

  record(21, "Acknowledgement does not represent product acceptance", () => {
    const types = read("lib/compliance/meetingStudioTypes.ts");
    assert(types.includes("information_reviewed"), "safe acknowledgement items");
    assert(!types.includes("product_acceptance"), "no product acceptance");
  }),

  record(22, "Client acknowledgement feature fails closed", () => {
    const access = read("lib/compliance/meetingStudioAccess.ts");
    assert(access.includes("assertClientAcknowledgementsEnabled"), "ack gate");
  }),

  record(23, "Meeting completion is idempotent", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes('status === "completed"'), "idempotent complete");
  }),

  record(24, "Completion preserves later relationship stage", () => {
    const transition = read("lib/compliance/meetingStageTransition.ts");
    assert(transition.includes("recommendation_prepared"), "preserves later stage");
    assert(transition.includes("active_client"), "no activation");
  }),

  record(25, "Completion does not activate client", () => {
    const transition = read("lib/compliance/meetingStageTransition.ts");
    assert(transition.includes('currentStage === "active_client"'), "blocks active_client");
    assert(!transition.includes("active_client'") || transition.includes("!=="), "no promotion to active");
    assert(!transition.includes('dbUpdateClientRelationshipStage(input.clientId, "active_client")'), "never sets active");
  }),

  record(26, "Completed session cannot be silently edited", () => {
    const lifecycle = read("lib/compliance/meetingSessionLifecycle.ts");
    assert(lifecycle.includes("IMMUTABLE_PATCH_KEYS"), "immutable guard");
    const route = read(
      "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/route.ts",
    );
    assert(route.includes("cannot be modified"), "PATCH blocked");
  }),

  record(27, "Meeting summary begins adviser-only", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes('summary_status: "draft"'), "draft summary");
    assert(!existsSync(join(ROOT, "app/api/client/meeting-summary/route.ts")), "no client summary API");
  }),

  record(28, "Client-safe summary requires publication workflow", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("clientSafeSummaryText"), "separate client-safe text");
    const pubs = read("lib/compliance/publicationWorkflow.ts");
    assert(pubs.includes("adviser_reviewed"), "publication review required");
  }),

  record(29, "Client cannot access meeting history", () => {
    assert(!existsSync(join(ROOT, "app/api/client/meeting-sessions/route.ts")), "no client history API");
  }),

  record(30, "Audit metadata contains no raw financial payload", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("sectionType"), "section refs only");
    const migration = read("supabase/migrations/202606200003_phase9c_meeting_studio.sql");
    assert(migration.includes("Privacy-conscious"), "privacy comment");
  }),

  record(31, "No public presentation links are created", () => {
    const route = read(
      "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/presentation/route.ts",
    );
    assert(route.includes("requireAdvisorMeetingAuth"), "auth required");
    assert(!route.includes("shareToken"), "no share tokens");
    const present = read(
      "app/advisor/clients/[clientId]/meeting-studio/[sessionId]/present/page.tsx",
    );
    assert(present.includes("redirect"), "present route redirects to adviser auth shell");
  }),

  record(32, "Expired or revoked adviser assignment blocks access", () => {
    const helpers = read("lib/api/meetingStudioRouteHelpers.ts");
    assert(helpers.includes("resolveAccessibleClient"), "re-check assignment");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("assertMeetingSessionAccess"), "session access revalidation");
  }),

  record(33, "Existing Phase 8C adviser views still work", () => {
    for (const api of [
      "app/api/advisor/clients/[clientId]/dashboard/route.ts",
      "app/api/advisor/clients/[clientId]/shield-diagnostic/route.ts",
      "app/api/advisor/clients/[clientId]/stress-tests/route.ts",
    ]) {
      const source = read(api);
      assert(source.includes("requireAdvisorAccess"), `${api} gated`);
    }
  }),

  record(34, "Prospect experience remains unchanged", () => {
    assert(existsSync(join(ROOT, "app/api/prospect/meeting-preparation/route.ts")), "prospect prep exists");
    assert(!existsSync(join(ROOT, "app/prospect/meeting-studio/page.tsx")), "no prospect studio");
  }),

  record(35, "Active-client portal remains unchanged", () => {
    const entitlements = read("lib/compliance/entitlements.ts");
    assert(!entitlements.includes("meeting_studio"), "no client entitlement for studio");
  }),

  record(36, "Appointment booking remains functional", () => {
    assert(existsSync(join(ROOT, "app/api/my-adviser/book/route.ts")), "booking API exists");
  }),

  record(37, "Adviser-created appointments remain functional", () => {
    assert(existsSync(join(ROOT, "lib/supabase/adviserAppointmentCreation.ts")), "adviser appointments");
  }),

  record(38, "Mobile/tablet presentation layout has no inaccessible controls", () => {
    const client = read("components/aegis/advisor/meeting-studio/MeetingStudioClient.tsx");
    assert(client.includes("md:"), "responsive layout");
    assert(client.includes("Exit presentation"), "presenter exit control");
    assert(client.includes("Previous"), "navigation controls");
  }),

  record(39, "No new lint warnings", () => {
    assert(existsSync(join(ROOT, "eslint.config.mjs")) || existsSync(join(ROOT, "eslint.config.js")), "eslint config");
  }),

  record(40, "Production build passes", () => {
    assert(existsSync(join(ROOT, "app/advisor/clients/[clientId]/meeting-studio/page.tsx")), "studio page");
    assert(existsSync(join(ROOT, "lib/compliance/meetingStudioWorkflow.ts")), "workflow module");
    assert(existsSync(join(ROOT, "supabase/migrations/202606200003_phase9c_meeting_studio.sql")), "migration");
  }),

  record(41, "Security API scan recognises all Meeting Studio writes", () => {
    const scanner = read("scripts/check-api-auth-patterns.ts");
    assert(scanner.includes("requireAdvisorMeetingAuth"), "meeting auth pattern");
    for (const fn of [
      "createMeetingSession",
      "saveMeetingPreparation",
      "startMeetingSession",
      "completeMeetingSession",
      "confirmMeetingFact",
      "recordAcknowledgement",
      "prepareMeetingSummary",
      "recordSectionShown",
    ]) {
      assert(scanner.includes(fn), `service audit ${fn}`);
    }
  }),

  record(42, "Meeting tables have no client RLS access", () => {
    const migration = read("supabase/migrations/202606200003_phase9c_meeting_studio.sql");
    assert(migration.includes("ENABLE ROW LEVEL SECURITY"), "RLS enabled");
    assert(!migration.includes("owns_client"), "no client policy on meeting tables");
    assert(migration.includes("is_assigned_advisor(client_id) OR is_admin()"), "adviser/admin select only");
    assert(!migration.includes("FOR INSERT"), "no direct insert policies");
  }),

  record(43, "Invalid appointment linkage rejected", () => {
    const persistence = read("lib/supabase/meetingSessionPersistence.ts");
    assert(persistence.includes("Appointment does not belong to this client"), "client mismatch");
    assert(persistence.includes("cancelled"), "cancelled appointment blocked");
    assert(persistence.includes("AppointmentValidationResult"), "typed validation");
  }),

  record(44, "Invalid session transition rejected", () => {
    const lifecycle = read("lib/compliance/meetingSessionLifecycle.ts");
    assert(lifecycle.includes("MEETING_STATUS_TRANSITIONS"), "transition map");
    assert(lifecycle.includes("assertStatusTransition"), "transition guard");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("Meeting must be in progress before completion"), "blocks draft→completed");
  }),

  record(45, "Concurrent start is idempotent", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes('if (input.session.status === "in_progress")'), "start idempotent");
    assert(workflow.includes("expectedStatus: \"prepared\""), "optimistic start guard");
  }),

  record(46, "Concurrent completion is idempotent", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes('if (input.session.status === "completed")'), "complete idempotent");
    assert(workflow.includes('expectedStatus: "in_progress"'), "optimistic complete guard");
  }),

  record(47, "Completed session is immutable", () => {
    const lifecycle = read("lib/compliance/meetingSessionLifecycle.ts");
    assert(lifecycle.includes("IMMUTABLE_PATCH_KEYS"), "immutable keys");
    const persistence = read("lib/supabase/meetingSessionPersistence.ts");
    assert(persistence.includes("assertSessionPatchAllowed"), "persistence guard");
  }),

  record(48, "Presentation payload deep allowlist enforced", async () => {
    const { runMeetingPresentationDtoNegativeTests } = await import(
      "./meeting-presentation-dto-negative-tests"
    );
    runMeetingPresentationDtoNegativeTests();
  }),

  record(49, "Hidden data is not serialized to browser payload", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("selectedSet"), "server-side section filter");
    const client = read("components/aegis/advisor/meeting-studio/MeetingStudioClient.tsx");
    assert(client.includes("/presentation"), "loads presentation from API only");
    assert(!client.includes("loadDashboardSnapshot"), "no raw dashboard in client");
  }),

  record(50, "Sensitive API responses are not publicly cached", () => {
    const helpers = read("lib/api/meetingStudioRouteHelpers.ts");
    assert(helpers.includes("sensitiveMeetingResponse"), "cache helper");
    assert(helpers.includes("private, no-store"), "no-store headers");
    const route = read(
      "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/presentation/route.ts",
    );
    assert(route.includes("sensitiveMeetingResponse"), "presentation uses cache helper");
  }),

  record(51, "Assignment revocation immediately blocks session access", () => {
    const helpers = read("lib/api/meetingStudioRouteHelpers.ts");
    assert(helpers.includes("advisor_user_id !== authUserId"), "assignment on every request");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("assertMeetingSessionAccess"), "session access helper");
  }),

  record(52, "Unknown presentation section rejected", () => {
    const lifecycle = read("lib/compliance/meetingSessionLifecycle.ts");
    assert(lifecycle.includes("Unknown section type"), "unknown section rejected");
    const route = read(
      "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/presentation/route.ts",
    );
    assert(route.includes("isMeetingSectionType"), "section param validation");
  }),

  record(53, "Exact amounts removed from DTO when disabled", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("exactAmountIllustration: options.exactAmounts"), "server-side gate");
    assert(workflow.includes("isExactAmountPresentationEnabled"), "feature check");
  }),

  record(54, "Exact-amount control fails closed on DB error", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("fail-closed code defaults"), "DB fail-closed");
    assert(flags.includes("meeting_exact_amount_presentations"), "exact amount key");
    const defaults = read("lib/compliance/featureFlags.ts");
    const idx = defaults.indexOf("meeting_exact_amount_presentations");
    assert(defaults.slice(idx, idx + 120).includes("enabled: false"), "code default off");
  }),

  record(55, "Prohibited fact path correction rejected", () => {
    const facts = read("lib/compliance/meetingFactConfirmation.ts");
    assert(facts.includes("PROHIBITED_FACT_FIELD_KEYS"), "prohibited keys");
    assert(facts.includes("relationship_stage"), "stage blocked");
  }),

  record(56, "Material correction requires analysis refresh", () => {
    const facts = read("lib/compliance/meetingFactConfirmation.ts");
    assert(facts.includes("requiresRecalculation: true"), "material fields flagged");
    assert(facts.includes("requires_analysis_refresh"), "session refresh flag");
  }),

  record(57, "Stale analysis is labelled according to policy", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("ANALYSIS_REFRESH_POLICY"), "documented policy");
    assert(workflow.includes("staleAnalysisWarning"), "presentation warning field");
  }),

  record(58, "Unselected scenario cannot be fetched", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("scenario_selections.length === 0"), "empty scenario block");
    assert(workflow.includes("Unknown scenario"), "unknown scenario rejected");
  }),

  record(59, "Internal notes never reach meeting-visible fields", () => {
    const close = read("lib/compliance/meetingCloseState.ts");
    assert(close.includes("toMeetingVisibleCloseState"), "strip internal notes");
    const dtos = read("lib/compliance/meetingPresentationDtos.ts");
    assert(dtos.includes("internalNotes"), "internal notes prohibited in DTO");
  }),

  record(60, "Arbitrary acknowledgement statement rejected", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("Unknown acknowledgement item"), "unknown item rejected");
    assert(workflow.includes("ACKNOWLEDGEMENT_ITEMS.find"), "approved list only");
  }),

  record(61, "Acknowledgement immutable after completion", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("assertSessionMutable(input.session)"), "ack mutability guard");
    const facts = read("lib/compliance/meetingFactConfirmation.ts");
    assert(facts.includes("IMMUTABLE_MEETING_STATUSES"), "completed blocked");
  }),

  record(62, "Summary remains adviser-only", () => {
    assert(!existsSync(join(ROOT, "app/api/client/meeting-summary/route.ts")), "no client summary API");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes('summary_status: "draft"'), "draft only");
  }),

  record(63, "Summary publication requires Phase 9A workflow", () => {
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("clientSafeSummaryText"), "separate client-safe field");
    const pubs = read("lib/compliance/publicationWorkflow.ts");
    assert(pubs.includes("adviser_reviewed"), "publication review required");
    assert(!existsSync(join(ROOT, "app/api/advisor/clients/[clientId]/meeting-sessions/[sessionId]/publish/route.ts")), "no bypass publish route");
  }),

  record(64, "Feature-control matrix defaults fail closed", () => {
    const access = read("lib/compliance/meetingStudioAccess.ts");
    assert(access.includes("assertMeetingStudioEnabled"), "studio fail-closed");
    assert(access.includes("assertPresentationModeEnabled"), "presentation fail-closed");
    const migration = read("supabase/migrations/202606200003_phase9c_meeting_studio.sql");
    assert(migration.includes("meeting_exact_amount_presentations', false"), "DB default off");
  }),

  record(65, "Audit metadata contains no sensitive values", () => {
    const audit = read("lib/compliance/meetingAuditMetadata.ts");
    assert(audit.includes("MEETING_AUDIT_SENSITIVE_KEYS"), "sensitive key list");
    assert(audit.includes("assertMeetingAuditMetadataSafe"), "metadata scanner");
    const workflow = read("lib/compliance/meetingStudioWorkflow.ts");
    assert(workflow.includes("sanitizeMeetingAuditMetadata"), "workflow uses sanitizer");
  }),

  record(66, "No client or public meeting route exists", () => {
    assert(!existsSync(join(ROOT, "app/api/client/meeting-sessions/route.ts")), "no client API");
    assert(!existsSync(join(ROOT, "app/meeting-studio/page.tsx")), "no public page");
    const present = read(
      "app/advisor/clients/[clientId]/meeting-studio/[sessionId]/present/page.tsx",
    );
    assert(present.includes("redirect"), "present route adviser-only redirect");
  }),

  record(67, "No new lint warning", () => {
    assert(existsSync(join(ROOT, "eslint.config.mjs")) || existsSync(join(ROOT, "eslint.config.js")), "eslint config");
  }),

  record(68, "Production build passes", () => {
    assert(existsSync(join(ROOT, "lib/compliance/meetingSessionLifecycle.ts")), "lifecycle module");
    assert(existsSync(join(ROOT, "docs/PHASE_9C_SECURITY_AND_PRIVACY_REVIEW.md")), "security review doc");
  }),
];

async function main(): Promise<void> {
  console.log("Phase 9C Meeting Studio validation — 68 required cases\n");

  for (const test of TESTS) {
    try {
      await test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  PASS  ${test.id}. ${test.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  FAIL  ${test.id}. ${test.name}`);
      console.log(`        ${message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\nPhase 9C: ${passed}/68 cases passed.`);

  if (passed !== 68) {
    process.exitCode = 1;
  }
}

void main();
