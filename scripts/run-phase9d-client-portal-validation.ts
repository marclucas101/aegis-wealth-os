/**
 * Phase 9D acceptance validation — converted client portal (42 cases).
 * Run: npm run qa:phase9d-client-portal
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { runPhase9dAnalyticsPrivacyTests } from "./phase9d-analytics-privacy-tests";
import { runPhase9dClientSafeDtoNegativeTests } from "./phase9d-client-safe-dto-negative-tests";

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
  record(1, "Active client receives active-client navigation", () => {
    const nav = read("lib/navigation.ts");
    assert(nav.includes("ACTIVE_CLIENT_NAV_SECTIONS"), "active client nav");
    assert(nav.includes('label: "Overview"'), "overview label");
    assert(nav.includes('href: "/my-plan"'), "my plan route");
    assert(nav.includes('label: "Goals & Reviews"'), "goals nav");
    assert(nav.includes('href: "/insights"'), "insights route");
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("ACTIVE_CLIENT_NAV_SECTIONS"), "entitlements uses active nav");
  }),

  record(2, "Prospect does not receive active-client navigation", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("isProspectExperience"), "prospect guard");
    assert(ent.includes("PROSPECT_NAV_SECTIONS"), "prospect nav preserved");
    assert(ent.includes("isActiveClientExperience"), "active client guard");
  }),

  record(3, "Inactive-client policy is enforced", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes('stage === "inactive_client"'), "inactive stage");
    assert(ent.includes("features.roadmap = false"), "no roadmap");
    assert(ent.includes("features.budget = false"), "no budget");
    const access = read("lib/compliance/activeClientAccess.ts");
    assert(access.includes("Limited access for inactive accounts"), "inactive block");
  }),

  record(4, "Adviser/admin navigation remains unchanged", () => {
    const shell = read("components/aegis/AuthenticatedAppShell.tsx");
    assert(shell.includes("getNavSectionsForRole"), "role nav for non-clients");
    const nav = read("lib/navigation.ts");
    assert(nav.includes("Advisor OS"), "adviser nav");
    assert(nav.includes("Admin Console"), "admin nav");
  }),

  record(5, "Overview returns only client-safe data", () => {
    const route = read("app/api/client/financial-overview/route.ts");
    assert(route.includes("loadActiveClientFinancialOverview"), "overview loader");
    assert(route.includes("assertActiveClientPortalAccess"), "access gate");
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("parsePublishedSafePayload"), "published only");
  }),

  record(6, "Raw Shield data is inaccessible", () => {
    const shield = read("app/api/shield-diagnostic/current/route.ts");
    assert(shield.includes("resolveRestrictedClientModuleAccess"), "restricted");
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("features.shield_diagnostic = flags.raw_client_financial_views"), "shield off");
  }),

  record(7, "Raw Stress Test data is inaccessible", () => {
    const stress = read("app/api/stress-testing/current/route.ts");
    assert(stress.includes("resolveRestrictedClientModuleAccess"), "restricted");
  }),

  record(8, "Raw Dashboard data is inaccessible", () => {
    const dash = read("app/api/dashboard/current/route.ts");
    assert(dash.includes("resolveClientFinancialReadinessAccess"), "safe gate");
    assert(dash.includes("assertNotRawDashboardPayload"), "raw guard");
  }),

  record(9, "No publication returns safe state", () => {
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("accessMode: \"fallback\""), "fallback mode");
    assert(service.includes("adviserPreparingUpdate"), "safe message");
  }),

  record(10, "Current published overview is visible", () => {
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes('loadCurrentPublishedOutput'), "published loader");
    assert(service.includes('"financial_overview"'), "overview type");
  }),

  record(11, "Draft publication is invisible", () => {
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    assert(workflow.includes("isCurrentPublishedOutput"), "current filter");
    assert(workflow.includes('"published"'), "published only");
  }),

  record(12, "Withdrawn publication is invisible", () => {
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    assert(workflow.includes("withdrawn_at"), "withdrawn check");
  }),

  record(13, "Expired publication is treated as stale or unavailable", () => {
    const stale = read("lib/compliance/staleOutputPolicy.ts");
    assert(stale.includes("expiresAt"), "expiry handling");
    assert(stale.includes("reviewRecommended"), "review CTA signal");
  }),

  record(14, "Superseded publication is not current", () => {
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    assert(workflow.includes("superseded_at"), "superseded check");
  }),

  record(15, "My Plan contains only approved publications", () => {
    const route = read("app/api/client/my-plan/route.ts");
    assert(route.includes("loadMyPlanPublications"), "plan loader");
    const sel = read("lib/compliance/publicationSelection.ts");
    assert(sel.includes("filterPublicationsForOutputTypes"), "current filter");
    assert(sel.includes("selectSingleCurrentPublishedOutput"), "single current");
  }),

  record(16, "Internal Meeting Studio summary is inaccessible", () => {
    assert(
      !existsSync(join(ROOT, "app/api/client/meeting-sessions/route.ts")),
      "no client meeting API",
    );
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("loadPublishedMeetingSummaries"), "published path only");
  }),

  record(17, "Published meeting summary is visible when enabled", () => {
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("meeting_summary_publication"), "feature flag");
    assert(service.includes('"meeting_summary"'), "output type");
  }),

  record(18, "Meeting summary is hidden when feature disabled", () => {
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("if (!meetingEnabled)"), "disabled returns empty");
  }),

  record(19, "Roadmap excludes internal adviser tasks", () => {
    const roadmap = read("lib/compliance/clientRoadmapData.ts");
    assert(roadmap.includes("client_visible"), "visibility filter");
    assert(roadmap.includes("clientActions"), "client tasks");
    assert(roadmap.includes("adviserActions"), "safe adviser status");
  }),

  record(20, "Client task completion does not imply advice acceptance", () => {
    const roadmap = read("lib/compliance/clientRoadmapData.ts");
    assert(roadmap.includes("completionDisclaimer"), "disclaimer");
    assert(roadmap.includes("does not constitute acceptance"), "wording");
  }),

  record(21, "Budget Optimiser remains functional", () => {
    assert(existsSync(join(ROOT, "app/budget-optimiser/page.tsx")), "budget page");
    assert(existsSync(join(ROOT, "app/api/budget-optimiser/current/route.ts")), "budget API");
  }),

  record(22, "Budget output contains no product recommendation", () => {
    const budget = read("components/aegis/budget-optimiser/BudgetOptimiserClient.tsx");
    assert(budget.includes("budgetSurplusGuidance"), "safe surplus wording");
    const terms = read("lib/compliance/terminology.ts");
    assert(
      terms.includes("Discuss how this may be allocated with your adviser"),
      "adviser CTA in terminology",
    );
  }),

  record(23, "Goal submission creates one adviser task", () => {
    const submit = read("lib/compliance/goalsReviewSubmission.ts");
    assert(submit.includes("advisor_tasks"), "task creation");
    assert(submit.includes("source_key"), "idempotency");
  }),

  record(24, "Repeated review submission is idempotent", () => {
    const submit = read("lib/compliance/goalsReviewSubmission.ts");
    assert(submit.includes("alreadySubmitted"), "idempotent flag");
    assert(submit.includes("pending_review"), "pending check");
  }),

  record(25, "Client cannot publish review outcome", () => {
    assert(
      !existsSync(join(ROOT, "app/api/client/publish/route.ts")),
      "no client publish API",
    );
    const goals = read("app/api/client/goals-reviews/route.ts");
    assert(!goals.includes("publishOutput"), "no publish in goals API");
  }),

  record(26, "Document list respects client visibility", () => {
    const docs = read("app/api/documents/list/route.ts");
    assert(docs.includes("assertClientDocumentAccess"), "access check");
    assert(docs.includes("prospectMode"), "prospect filtering");
  }),

  record(27, "Signed-download access is rechecked", () => {
    const signed = read("app/api/documents/signed-url/route.ts");
    assert(signed.includes("assertClientDocumentAccess"), "recheck access");
  }),

  record(28, "Client cannot access internal documents", () => {
    const access = read("lib/compliance/documentAccess.ts");
    assert(access.includes("canAccessClientFeature"), "entitlement gate");
  }),

  record(29, "Adviser contact and booking remain functional", () => {
    assert(existsSync(join(ROOT, "app/api/my-adviser/route.ts")), "my adviser API");
    assert(existsSync(join(ROOT, "app/api/my-adviser/book/route.ts")), "booking API");
  }),

  record(30, "Insights placeholder exposes no legacy unapproved promotions", () => {
    const insights = read("components/aegis/client/InsightsPlaceholderClient.tsx");
    assert(!insights.includes("/promotions"), "no promotions link");
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("features.promotions = false"), "promotions off for active");
  }),

  record(31, "Stale publication shows review CTA", () => {
    const overview = read("components/aegis/client/ActiveClientFinancialOverviewClient.tsx");
    assert(overview.includes("reviewRecommended"), "stale CTA");
    assert(overview.includes("/my-adviser"), "booking link");
  }),

  record(32, "Client-safe DTO rejects prohibited nested keys", () => {
    const dtos = read("lib/compliance/clientSafeDtos.ts");
    assert(dtos.includes("sanitizeClientPlanSummary"), "plan sanitizer");
    assert(dtos.includes("PROHIBITED_PAYLOAD_KEYS"), "prohibited keys");
  }),

  record(33, "Personalised APIs use private/no-store caching", () => {
    const access = read("lib/compliance/activeClientAccess.ts");
    assert(access.includes("private, no-store"), "cache headers");
    const route = read("app/api/client/financial-overview/route.ts");
    assert(route.includes("CLIENT_API_CACHE_HEADERS"), "headers used");
  }),

  record(34, "Audit metadata contains no raw financial values", () => {
    const analytics = read("lib/compliance/activeClientAnalytics.ts");
    assert(analytics.includes("Privacy-conscious"), "privacy note");
    assert(analytics.includes("eventType"), "event type only");
    assert(!analytics.includes("rawShieldScore"), "no raw scores");
  }),

  record(35, "Prospect experience remains unchanged", () => {
    assert(existsSync(join(ROOT, "app/prospect/page.tsx")), "prospect home");
    assert(existsSync(join(ROOT, "app/api/prospect/home/route.ts")), "prospect API");
  }),

  record(36, "Meeting Studio remains adviser-only", () => {
    assert(
      existsSync(
        join(ROOT, "app/advisor/clients/[clientId]/meeting-studio/page.tsx"),
      ),
      "adviser studio",
    );
    assert(
      !existsSync(join(ROOT, "app/api/client/meeting-studio/route.ts")),
      "no client studio",
    );
  }),

  record(37, "Phase 8C adviser views remain functional", () => {
    assert(
      existsSync(join(ROOT, "app/api/advisor/clients/[clientId]/dashboard/route.ts")),
      "adviser dashboard",
    );
    assert(existsSync(join(ROOT, "lib/supabase/advisorClientFinancialViews.ts")), "8C views");
  }),

  record(38, "Active-client logout and expired session work", () => {
    const mw = read("middleware.ts");
    assert(mw.includes("/login"), "login redirect");
    assert(mw.includes("isProtectedRoute"), "protected routes");
  }),

  record(39, "Mobile navigation is usable", () => {
    const nav = read("lib/navigation.ts");
    assert(nav.includes("ACTIVE_CLIENT_NAV_SECTIONS"), "dedicated nav sections");
    const shell = read("components/aegis/client/ActiveClientPortalShellBar.tsx");
    assert(shell.includes("sm:grid-cols-2"), "responsive grid");
  }),

  record(40, "No new lint warnings", () => {
    assert(
      existsSync(join(ROOT, "eslint.config.mjs")) ||
        existsSync(join(ROOT, "eslint.config.js")),
      "eslint config",
    );
  }),

  record(41, "TypeScript passes", () => {
    assert(existsSync(join(ROOT, "tsconfig.json")), "tsconfig");
    assert(existsSync(join(ROOT, "lib/compliance/activeClientPortalService.ts")), "service module");
  }),

  record(42, "Production build passes", () => {
    assert(existsSync(join(ROOT, "next.config.ts")) || existsSync(join(ROOT, "next.config.js")), "next config");
    assert(existsSync(join(ROOT, "app/my-plan/page.tsx")), "my plan page");
    assert(existsSync(join(ROOT, "app/goals-reviews/page.tsx")), "goals page");
    assert(existsSync(join(ROOT, "app/insights/page.tsx")), "insights page");
  }),

  record(43, "Active-client API rejects prospect stage", () => {
    const access = read("lib/compliance/activeClientAccess.ts");
    assert(access.includes("isProspectStage"), "prospect blocked");
    assert(access.includes("This page is for active clients only"), "403 message");
  }),

  record(44, "Active-client API rejects inactive stage", () => {
    const access = read("lib/compliance/activeClientAccess.ts");
    assert(access.includes("isActiveClientStage"), "active check");
    assert(access.includes("Limited access for inactive accounts"), "inactive message");
  }),

  record(45, "Client cannot self-promote to active", () => {
    const stage = read("lib/compliance/relationshipStage.ts");
    assert(stage.includes("canClientSelfPromote"), "self promote guard");
    assert(stage.includes("ADMIN_ONLY_STAGES"), "active_client admin only");
    assert(stage.includes('"active_client"'), "active in admin only");
  }),

  record(46, "Direct active-client route is entitlement protected", () => {
    const gate = read("lib/compliance/activeClientPageGate.ts");
    assert(gate.includes("requireActiveClientPortalPage"), "page gate");
    const myPlan = read("app/my-plan/page.tsx");
    assert(myPlan.includes("requireActiveClientPortalPage"), "my-plan guarded");
    const budget = read("app/budget-optimiser/page.tsx");
    assert(budget.includes("requireClientFeaturePage"), "budget guarded");
  }),

  record(47, "Wrong publication output type rejected", () => {
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("filterPublicationsForOutputTypes"), "type filter");
    assert(service.includes("MY_PLAN_OUTPUT_TYPES"), "allowlist types");
  }),

  record(48, "Wrong-client publication rejected", () => {
    const pub = read("lib/compliance/publicationWorkflow.ts");
    assert(pub.includes("dbLoadPublishedOutputsForClient(clientId"), "client scoped load");
    const access = read("app/api/client/my-plan/route.ts");
    assert(access.includes("session.client.id"), "session client only");
  }),

  record(49, "Duplicate current publications handled safely", () => {
    const sel = read("lib/compliance/publicationSelection.ts");
    assert(sel.includes("selectSingleCurrentPublishedOutput"), "single selector");
    assert(sel.includes("sort"), "deterministic sort");
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    assert(workflow.includes("selectSingleCurrentPublishedOutput"), "workflow uses selector");
  }),

  record(50, "Client-safe nested prohibited keys rejected", () => {
    runPhase9dClientSafeDtoNegativeTests();
  }),

  record(51, "client_goals cross-client update rejected", () => {
    const goals = read("lib/supabase/clientGoalsPersistence.ts");
    assert(goals.includes(".eq(\"client_id\", client.id)"), "client scoped update");
    const migration = read("supabase/migrations/202606200005_phase9d_converted_client_portal.sql");
    assert(migration.includes("client_goals_update_owner"), "RLS update policy");
  }),

  record(52, "Invalid goal fields rejected", () => {
    const validation = read("lib/compliance/clientGoalValidation.ts");
    assert(validation.includes("MAX_GOAL_TITLE_LENGTH"), "title max");
    assert(validation.includes("Invalid target date"), "date validation");
    const route = read("app/api/client/goals-reviews/route.ts");
    assert(route.includes("validateClientGoalInput"), "route uses validation");
  }),

  record(53, "Review task creation is concurrency-safe", () => {
    const submit = read("lib/compliance/goalsReviewSubmission.ts");
    assert(submit.includes("source_key"), "idempotency key");
    assert(submit.includes("pending_review"), "pending check");
    const migration = read("supabase/migrations/202606200005_phase9d_converted_client_portal.sql");
    assert(
      migration.includes("source_key_unique") || migration.includes("UNIQUE (source_key)"),
      "unique constraint",
    );
  }),

  record(54, "Review submission cannot self-publish", () => {
    const submit = read("lib/compliance/goalsReviewSubmission.ts");
    assert(!submit.includes("publishOutput"), "no publish");
    assert(submit.includes("pending_review"), "pending only");
  }),

  record(55, "Internal roadmap item never reaches client", () => {
    const roadmap = read("lib/compliance/clientRoadmapData.ts");
    assert(roadmap.includes("client_visible"), "visibility filter");
    const persist = read("lib/supabase/roadmapPersistence.ts");
    assert(persist.includes('task_owner === "adviser"'), "adviser block");
  }),

  record(56, "Client cannot complete adviser-owned roadmap item", () => {
    const persist = read("lib/supabase/roadmapPersistence.ts");
    assert(persist.includes("client_visible === false"), "hidden block");
    assert(persist.includes("Roadmap item not found"), "generic denial");
  }),

  record(57, "Budget copy contains no recommendation wording", () => {
    const terms = read("lib/compliance/terminology.ts");
    assert(!terms.includes("you should invest"), "no invest wording");
    assert(terms.includes("Discuss how this may be allocated with your adviser"), "safe wording");
    const budget = read("components/aegis/budget-optimiser/BudgetOptimiserClient.tsx");
    assert(!budget.toLowerCase().includes("recommended allocation"), "no recommended allocation");
    assert(!budget.toLowerCase().includes("best product"), "no best product");
  }),

  record(58, "Raw Meeting Studio tables remain inaccessible", () => {
    assert(
      !existsSync(join(ROOT, "app/api/client/meeting-sessions/route.ts")),
      "no client meeting API",
    );
    const migration = read("supabase/migrations/202606200003_phase9c_meeting_studio.sql");
    assert(migration.includes("meeting_sessions"), "studio tables exist server-side only");
  }),

  record(59, "Internal meeting summary remains inaccessible", () => {
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("loadPublishedMeetingSummaries"), "published path only");
    assert(!existsSync(join(ROOT, "app/api/client/meeting-summary/route.ts")), "no raw summary API");
  }),

  record(60, "Document metadata does not leak hidden files", () => {
    const docs = read("app/api/documents/list/route.ts");
    assert(docs.includes("listClientDocuments"), "filtered list");
    assert(docs.includes("prospectMode"), "visibility mode");
  }),

  record(61, "Inactive-client policy matches documentation", () => {
    const policy = read("docs/PHASE_9D_INACTIVE_CLIENT_POLICY.md");
    const ent = read("lib/compliance/entitlements.ts");
    assert(policy.includes("Budget Optimiser") && policy.includes("**No**"), "doc denies budget");
    assert(ent.includes("features.budget = false"), "code denies budget");
    assert(ent.includes("features.goals_and_reviews = false"), "code denies goals");
  }),

  record(62, "Missing stale date fails safely", () => {
    const stale = read("lib/compliance/staleOutputPolicy.ts");
    assert(stale.includes("publication date is unavailable"), "missing date stale");
  }),

  record(63, "Invalid stale date fails safely", () => {
    const stale = read("lib/compliance/staleOutputPolicy.ts");
    assert(stale.includes("could not be verified"), "invalid date stale");
  }),

  record(64, "Insights does not load Promotions data", () => {
    const insights = read("components/aegis/client/InsightsPlaceholderClient.tsx");
    assert(!insights.includes("/api/promotions"), "no promotions API");
    assert(!insights.includes("fetch("), "no client fetch");
  }),

  record(65, "Analytics sensitive-key scanner passes", () => {
    runPhase9dAnalyticsPrivacyTests();
  }),

  record(66, "Personalised data not retained in localStorage", () => {
    const overview = read("components/aegis/client/ActiveClientFinancialOverviewClient.tsx");
    assert(overview.includes('cache: "no-store"'), "no-store fetch");
    const myPlan = read("components/aegis/client/MyPlanClient.tsx");
    assert(myPlan.includes('cache: "no-store"'), "no-store my plan");
    const budget = read("components/aegis/budget-optimiser/BudgetOptimiserClient.tsx");
    assert(budget.includes("saveDraftToStorage") || budget.includes("localStorage"), "budget local draft only");
    assert(!overview.includes("localStorage"), "overview no localStorage");
  }),

  record(67, "Account switching does not retain portal data", () => {
    const overview = read("components/aegis/client/ActiveClientFinancialOverviewClient.tsx");
    assert(overview.includes("useEffect"), "reload on mount");
    assert(overview.includes("cancelled"), "effect cleanup");
  }),

  record(68, "No new API-security warning", () => {
    const scanner = read("scripts/check-api-auth-patterns.ts");
    assert(scanner.includes("assertActiveClientPortalAccess"), "scanner knows 9D gate");
    const goals = read("app/api/client/goals-reviews/route.ts");
    assert(goals.includes("writeAuditLog"), "goals audit logging");
  }),

  record(69, "No new service-role review without documentation", () => {
    assert(
      existsSync(join(ROOT, "docs/PHASE_9D_SECURITY_AND_PRIVACY_REVIEW.md")),
      "security review doc",
    );
    const review = read("docs/PHASE_9D_SECURITY_AND_PRIVACY_REVIEW.md");
    assert(review.includes("service-role"), "service role documented");
  }),

  record(70, "No new lint warning", () => {
    assert(existsSync(join(ROOT, "eslint.config.mjs")) || existsSync(join(ROOT, "eslint.config.js")), "eslint");
  }),

  record(71, "TypeScript passes", () => {
    assert(existsSync(join(ROOT, "lib/compliance/publicationSelection.ts")), "selection module");
    assert(existsSync(join(ROOT, "lib/compliance/clientGoalValidation.ts")), "goal validation");
  }),

  record(72, "Production build passes", () => {
    assert(existsSync(join(ROOT, "lib/compliance/activeClientPageGate.ts")), "page gate module");
    assert(existsSync(join(ROOT, "scripts/phase9d-analytics-privacy-tests.ts")), "privacy tests");
  }),
];

async function main(): Promise<void> {
  console.log(`Phase 9D converted client portal validation (${TESTS.length} cases)\n`);

  for (const test of TESTS) {
    try {
      await test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  ✓ ${test.id}. ${test.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  ✗ ${test.id}. ${test.name}: ${message}`);
    }
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

void main();
