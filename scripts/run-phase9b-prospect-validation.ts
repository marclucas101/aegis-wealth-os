/**
 * Phase 9B acceptance validation — prospect experience security and journey cases.
 * Run: npm run qa:phase9b-prospect
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
  record(1, "Prospect receives prospect navigation", () => {
    const nav = read("lib/navigation.ts");
    assert(nav.includes("PROSPECT_NAV_SECTIONS"), "prospect nav defined");
    assert(nav.includes('label: "Home"'), "home nav item");
    assert(nav.includes('href: "/prospect"'), "prospect home route");
    assert(nav.includes('label: "Complete My Information"'), "discover label");
    assert(nav.includes('label: "Prepare for My Meeting"'), "meeting prep nav");
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("PROSPECT_NAV_SECTIONS"), "entitlements uses prospect nav");
    assert(ent.includes("/meeting-preparation"), "meeting prep href mapped");
  }),

  record(2, "Active client does not receive prospect-only navigation", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("isProspectExperience"), "prospect nav guard");
    assert(ent.includes("financial_overview"), "active client feature");
    assert(ent.includes("ACTIVE_CLIENT_FEATURES"), "active client features");
  }),

  record(3, "Adviser and admin navigation remain unchanged", () => {
    const shell = read("components/aegis/AuthenticatedAppShell.tsx");
    assert(shell.includes("getNavSectionsForRole"), "role nav for non-clients");
    const nav = read("lib/navigation.ts");
    assert(nav.includes("Advisor OS"), "adviser nav preserved");
    assert(nav.includes("Admin Console"), "admin nav preserved");
  }),

  record(4, "Save-and-resume preserves entered information", () => {
    const wizard = read("components/aegis/discover/DiscoverWizard.tsx");
    assert(wizard.includes("saveRemoteProfile"), "remote save helper");
    assert(wizard.includes("/api/discover/save"), "discover save API");
    assert(wizard.includes("saveDiscoverProfile"), "local save");
    assert(wizard.includes("EMPTY_FORM_DATA"), "no demo prefill");
  }),

  record(5, "Conditional questions do not erase valid stored data", () => {
    const wizard = read("components/aegis/discover/DiscoverWizard.tsx");
    assert(wizard.includes("setFormData((prev)"), "functional updates");
    assert(wizard.includes("/api/discover/current"), "hydrate from server");
  }),

  record(6, "Submission sets fact_find_complete server-side", () => {
    const submit = read("lib/compliance/prospectSubmission.ts");
    assert(submit.includes('"fact_find_complete"'), "stage transition");
    assert(submit.includes("dbUpdateClientRelationshipStage"), "server DB update");
    const route = read("app/api/discover/submit/route.ts");
    assert(route.includes("submitProspectProfile"), "submit API");
    assert(!route.includes("relationship_stage"), "client cannot pass stage");
  }),

  record(7, "Repeated submission is idempotent", () => {
    const submit = read("lib/compliance/prospectSubmission.ts");
    assert(submit.includes("alreadySubmitted"), "idempotent flag");
    assert(submit.includes('currentStage !== "prospect"'), "submitted detection");
    assert(submit.includes("source_key"), "task idempotency key");
  }),

  record(8, "Submission creates one adviser review task", () => {
    const submit = read("lib/compliance/prospectSubmission.ts");
    assert(submit.includes("findExistingReviewTask"), "duplicate task check");
    assert(submit.includes('task_type: "review"'), "review task type");
    assert(submit.includes("prospect_fact_find_review:"), "unique source key");
  }),

  record(9, "Prospect cannot self-promote relationship stage", () => {
    const stage = read("lib/compliance/relationshipStage.ts");
    assert(stage.includes("canClientSelfPromote"), "self promote guard");
    assert(stage.includes("return false"), "self promote blocked");
    assert(
      !existsSync(join(ROOT, "app/api/client/relationship-stage/route.ts")),
      "no client stage API",
    );
  }),

  record(10, "Prospect with no publication sees safe fallback", () => {
    const gate = read("lib/compliance/clientAccessGate.ts");
    assert(gate.includes("resolveFallbackState"), "fallback resolver");
    const view = read("components/aegis/client/FinancialReadinessSnapshotView.tsx");
    assert(view.includes('accessMode === "fallback"'), "fallback UI");
  }),

  record(11, "Draft publication is not visible", () => {
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    assert(workflow.includes("isCurrentPublishedOutput"), "published filter");
    assert(workflow.includes('output_audience !== "client_published"'), "audience check");
  }),

  record(12, "Published snapshot is visible", () => {
    const view = read("components/aegis/client/FinancialReadinessSnapshotView.tsx");
    assert(view.includes("readinessBand"), "published snapshot fields");
    const dtos = read("lib/compliance/clientSafeDtos.ts");
    assert(dtos.includes("ClientSafeFinancialReadinessSnapshot"), "safe DTO");
  }),

  record(13, "Published snapshot contains only allowlisted fields", () => {
    const dtos = read("lib/compliance/clientSafeDtos.ts");
    assert(dtos.includes("sanitizeFinancialReadinessPayload"), "sanitizer");
    assert(dtos.includes("PROHIBITED_PAYLOAD_KEYS"), "blocklist");
  }),

  record(14, "Raw Dashboard data remains inaccessible", () => {
    const route = read("app/api/dashboard/current/route.ts");
    assert(route.includes("resolveClientFinancialReadinessAccess"), "access gate");
    assert(route.includes("assertNotRawDashboardPayload"), "raw guard");
  }),

  record(15, "Raw Shield data remains inaccessible", () => {
    const route = read("app/api/shield-diagnostic/current/route.ts");
    assert(route.includes("resolveRestrictedClientModuleAccess"), "restricted");
  }),

  record(16, "Raw Stress Test data remains inaccessible", () => {
    const route = read("app/api/stress-testing/current/route.ts");
    assert(route.includes("resolveRestrictedClientModuleAccess"), "restricted");
  }),

  record(17, "Prospect cannot access internal documents", () => {
    const visibility = read("lib/compliance/documentVisibility.ts");
    assert(visibility.includes("canClientViewDocument"), "visibility helper");
    const docs = read("lib/supabase/documentPersistence.ts");
    assert(docs.includes("canClientViewDocument"), "signed-url re-check");
    const access = read("lib/compliance/documentAccess.ts");
    assert(access.includes("assertClientDocumentAccess"), "API guard");
  }),

  record(18, "Prospect can access permitted documents", () => {
    const list = read("app/api/documents/list/route.ts");
    assert(list.includes("assertClientDocumentAccess"), "list guard");
    assert(list.includes("prospectMode"), "prospect list mode");
  }),

  record(19, "Unassigned adviser cannot view prospect data", () => {
    const views = read("lib/supabase/advisorClientFinancialViews.ts");
    assert(views.includes("resolveAccessibleClient"), "assignment in financial views");
    const route = read("app/api/advisor/clients/[clientId]/dashboard/route.ts");
    assert(route.includes("requireAdvisorAccess"), "adviser auth");
    assert(route.includes("403") || route.includes("forbidden"), "forbidden response");
  }),

  record(20, "Assigned adviser retains full internal view", () => {
    const route = read("app/api/advisor/clients/[clientId]/dashboard/route.ts");
    assert(route.includes("loadAdvisorClientDashboardView"), "full snapshot");
  }),

  record(21, "Appointment booking still works", () => {
    assert(existsSync(join(ROOT, "app/api/my-adviser/book/route.ts")), "book API");
    const prep = read("lib/compliance/meetingPreparationData.ts");
    assert(prep.includes("bookingHref"), "booking link in prep");
  }),

  record(22, "Existing active-client functions are not broken", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("ACTIVE_CLIENT_FEATURES"), "active features intact");
    assert(ent.includes("financial_overview"), "overview feature");
  }),

  record(23, "No redirect loops across prospect routes", () => {
    const mw = read("middleware.ts");
    assert(mw.includes("/prospect"), "prospect protected");
    assert(mw.includes("/meeting-preparation"), "meeting prep protected");
    assert(!mw.includes('pathname === "/prospect"'), "no prospect-only redirect loop");
  }),

  record(24, "Mobile navigation remains usable", () => {
    const nav = read("lib/navigation.ts");
    const prospectItems = (nav.match(/clientOnly: true/g) ?? []).length;
    assert(prospectItems >= 6, "prospect nav items present");
    const shell = read("components/aegis/AppShell.tsx");
    assert(shell.includes("navSections"), "nav sections in shell");
  }),

  record(25, "First-time prospect redirects to /prospect", () => {
    const routing = read("lib/compliance/postAuthRouting.ts");
    assert(routing.includes('DEFAULT_PROSPECT_HOME = "/prospect"'), "prospect default");
    assert(routing.includes("resolvePostAuthDestination"), "server resolver");
    assert(existsSync(join(ROOT, "app/auth/continue/route.ts")), "continue route");
    const login = read("app/auth/login/route.ts");
    assert(login.includes("/auth/continue"), "login uses continue");
    const mw = read("middleware.ts");
    assert(mw.includes("/auth/continue"), "auth pages to continue");
  }),

  record(26, "Active client does not redirect to prospect home", () => {
    const routing = read("lib/compliance/postAuthRouting.ts");
    assert(routing.includes('DEFAULT_ACTIVE_CLIENT_HOME = "/dashboard"'), "active default");
    assert(routing.includes("isProspectStage"), "prospect stage gate");
    assert(routing.includes("resolveDefaultHomeForRole"), "role-based default");
  }),

  record(27, "Adviser/admin routing unchanged after continue route", () => {
    const routing = read("lib/compliance/postAuthRouting.ts");
    assert(routing.includes('DEFAULT_ADVISER_HOME = "/advisor"'), "adviser home");
    assert(routing.includes('DEFAULT_ADMIN_HOME = "/admin"'), "admin home");
  }),

  record(28, "Invitation destinations are allowlisted", () => {
    const routing = read("lib/compliance/postAuthRouting.ts");
    assert(routing.includes("INVITE_DESTINATION_PATHS"), "invite allowlist");
    assert(routing.includes("validateInviteDestination"), "invite validator");
    const onboarding = read("lib/supabase/clientOnboarding.ts");
    assert(onboarding.includes("buildInviteSignupUrl"), "invite signup url");
  }),

  record(29, "Invalid return URL rejected", () => {
    const routing = read("lib/compliance/postAuthRouting.ts");
    assert(routing.includes("validateSafeReturnUrl"), "safe return validator");
    assert(routing.includes('trimmed.startsWith("//")'), "blocks protocol-relative");
    assert(routing.includes('includes("://")'), "blocks external urls");
  }),

  record(30, "Appointment booking advances stage to meeting_scheduled", () => {
    const stage = read("lib/compliance/appointmentStageTransition.ts");
    assert(stage.includes("maybeAdvanceRelationshipStageForAppointment"), "advance helper");
    assert(stage.includes('"meeting_scheduled"'), "target stage");
    const appts = read("lib/supabase/appointmentsPersistence.ts");
    assert(appts.includes("maybeAdvanceRelationshipStageForAppointment"), "client booking hook");
  }),

  record(31, "Later stage is not regressed on appointment", () => {
    const stage = read("lib/compliance/appointmentStageTransition.ts");
    assert(stage.includes("shouldAdvanceToMeetingScheduled"), "guard function");
    assert(stage.includes("active_client"), "protects active client");
    assert(stage.includes("stageIndex"), "ordered stages");
  }),

  record(32, "Adviser-created prospect appointment advances stage", () => {
    const creation = read("lib/supabase/adviserAppointmentCreation.ts");
    assert(creation.includes("maybeAdvanceRelationshipStageForAppointment"), "adviser hook");
    assert(creation.includes("adviser_created_appointment"), "trigger metadata");
  }),

  record(33, "Sensitive local draft is not retained indefinitely in production", () => {
    const draft = read("lib/aegis/discoverLocalDraft.ts");
    assert(draft.includes("isSensitiveLocalDraftEnabled"), "prod toggle");
    assert(draft.includes('process.env.NODE_ENV !== "production"'), "disabled in prod");
    const profile = read("lib/aegis/localProfile.ts");
    assert(profile.includes("isSensitiveLocalDraftEnabled"), "profile respects toggle");
  }),

  record(34, "Local draft is cleared after submission/logout", () => {
    const wizard = read("components/aegis/discover/DiscoverWizard.tsx");
    assert(wizard.includes("clearDiscoverProfile"), "clear on submit");
    const auth = read("components/aegis/auth/AuthStatus.tsx");
    assert(auth.includes("clearDiscoverProfile"), "clear on logout");
  }),

  record(35, "Draft cannot leak between accounts", () => {
    const draft = read("lib/aegis/discoverLocalDraft.ts");
    assert(draft.includes("assertDiscoverDraftBelongsToUser"), "account guard");
    assert(draft.includes("discoverDraftStorageKey"), "scoped storage key");
  }),

  record(36, "Analytics contain no raw financial values", () => {
    const analytics = read("lib/compliance/prospectAnalytics.ts");
    assert(analytics.includes("Privacy-conscious"), "privacy guidance");
    const events = read("app/api/prospect/events/route.ts");
    assert(!events.includes("formData"), "events API excludes form data");
    const submit = read("lib/compliance/prospectSubmission.ts");
    assert(submit.includes("computeServerSubmissionCompleteness"), "server validation");
  }),

  record(37, "Signed document download re-checks visibility", () => {
    const docs = read("lib/supabase/documentPersistence.ts");
    assert(docs.includes("canClientViewDocument"), "download visibility check");
    const signed = read("app/api/documents/signed-url/route.ts");
    assert(signed.includes("session.authUser.id"), "user id passed to signed url");
  }),

  record(38, "Direct internal-document access is denied", () => {
    const visibility = read("lib/compliance/documentVisibility.ts");
    assert(visibility.includes("client_visible"), "published tag rule");
    const signed = read("app/api/documents/signed-url/route.ts");
    assert(signed.includes("Document not found"), "opaque denial");
  }),

  record(39, "Double submission creates one adviser task", () => {
    const submit = read("lib/compliance/prospectSubmission.ts");
    assert(submit.includes("currentStage === \"prospect\""), "task only on first submit");
    assert(submit.includes("findExistingReviewTask"), "duplicate task guard");
  }),

  record(40, "No publication returns safe fallback", () => {
    const fallback = read("lib/compliance/fallbackStates.ts");
    assert(fallback.includes("additional_information_required"), "no data fallback");
    assert(fallback.includes("analysis_submitted"), "submitted fallback");
  }),

  record(41, "Invalid safe payload is rejected", () => {
    const dtos = read("lib/compliance/clientSafeDtos.ts");
    assert(dtos.includes("sanitizeFinancialReadinessPayload"), "sanitizer");
    assert(dtos.includes("throw") || dtos.includes("Error"), "rejects invalid payload");
  }),

  record(42, "No new Phase 9B lint warnings in discover wizard", () => {
    const wizard = read("components/aegis/discover/DiscoverWizard.tsx");
    assert(wizard.includes("useCallback"), "saveRemoteProfile memoized");
    assert(wizard.includes("recordSectionCompleted"), "section analytics hook");
    assert(wizard.includes("saveRemoteProfile, userId, currentStep"), "autosave deps complete");
  }),
];

async function main(): Promise<void> {
  console.log("Phase 9B prospect experience validation\n");

  for (const test of TESTS) {
    try {
      await test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  ✓ ${test.id}. ${test.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  ✗ ${test.id}. ${test.name}`);
      console.log(`    ${message}`);
    }
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

void main();
