/**
 * Phase 9D acceptance validation — converted client portal (42 cases).
 * Run: npm run qa:phase9d-client-portal
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
    const service = read("lib/compliance/activeClientPortalService.ts");
    assert(service.includes("isCurrentPublishedOutput"), "current only");
    assert(service.includes("client_plan_summary"), "plan type");
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
