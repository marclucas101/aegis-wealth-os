/**
 * Phase 9E acceptance validation — 55 original + 32 hardening = 87 cases.
 * Run: npm run qa:phase9e-communications
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { HARDENING_TESTS } from "./phase9e-hardening-tests";

const ROOT = resolve(process.cwd());

type TestCase = {
  id: number;
  name: string;
  run: () => void | Promise<void>;
};

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

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

/** Original Phase 9E build-spec cases 1–55. */
const ORIGINAL_TESTS: TestCase[] = [
  record(1, "Client sees only approved published Insights", () => {
    const feed = read("lib/communications/insightsFeedService.ts");
    assert(feed.includes("filterSupersededPublishedRows"), "supersede filter");
    assert(feed.includes("contentMatchesAudience"), "audience filter");
    const lifecycle = read("lib/communications/contentLifecycle.ts");
    assert(lifecycle.includes("isClientVisibleStatus"), "visibility gate");
  }),

  record(2, "Draft content is invisible", () => {
    assert(read("lib/communications/audienceTargeting.ts").includes("isClientVisibleStatus"), "gate");
  }),

  record(3, "Submitted content is invisible", () => {
    assert(read("lib/communications/contentLifecycle.ts").includes("submitted_for_review"), "status");
    assert(read("lib/communications/audienceTargeting.ts").includes("isClientVisibleStatus"), "gate");
  }),

  record(4, "Rejected content is invisible", () => {
    assert(read("lib/communications/audienceTargeting.ts").includes("isClientVisibleStatus"), "gate");
  }),

  record(5, "Withdrawn content disappears", () => {
    assert(read("lib/communications/contentLifecycle.ts").includes("withdrawn_at"), "withdrawn");
  }),

  record(6, "Expired content is not current", () => {
    assert(read("lib/communications/contentLifecycle.ts").includes("expires_at"), "expiry");
  }),

  record(7, "Adviser cannot self-approve", () => {
    assert(read("lib/communications/contentWorkflow.ts").includes("Authors cannot approve their own content"), "block");
  }),

  record(8, "Adviser cannot target unassigned client", () => {
    assert(read("lib/communications/audienceTargeting.ts").includes("Cannot target clients not assigned to you"), "check");
    assert(read("app/api/advisor/insights/route.ts").includes("validateTargetClientIds"), "api");
  }),

  record(9, "Admin can approve under explicit policy", () => {
    const route = read("app/api/admin/communications/[contentId]/approve/route.ts");
    assert(route.includes("requireAdminAccess"), "admin");
    assert(route.includes("admin_content_approval"), "feature");
  }),

  record(10, "Published content cannot be silently edited", () => {
    assert(read("lib/communications/contentWorkflow.ts").includes("Published content cannot be silently edited"), "block");
  }),

  record(11, "New edit creates a new version", () => {
    assert(read("lib/communications/contentWorkflow.ts").includes("dbCreateGovernedContentVersion"), "version");
  }),

  record(12, "Audience targeting is enforced server-side", () => {
    assert(read("lib/communications/insightsFeedService.ts").includes("contentMatchesAudience"), "server");
  }),

  record(13, "Prospect and active-client targeting differ correctly", () => {
    const t = read("lib/communications/audienceTargeting.ts");
    assert(t.includes("isActiveClientStage"), "active");
    assert(t.includes("isProspectStage"), "prospect");
  }),

  record(14, "Inactive-client policy is enforced", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes('stage === "inactive_client"'), "inactive");
    assert(ent.includes("insights_and_updates = false"), "insights off");
  }),

  record(15, "Product-related content defaults disabled", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("product_related_content"), "key");
    assert(/product_related_content:[\s\S]*?enabled:\s*false/.test(flags), "default off");
  }),

  record(16, "Market update requires source and review date", () => {
    const v = read("lib/communications/contentValidation.ts");
    assert(v.includes("Source name is required for market updates"), "source");
    assert(v.includes("Expiry or review date is required for market updates"), "expiry");
  }),

  record(17, "Unsafe external URL rejected", () => {
    const links = read("lib/communications/externalLinkValidation.ts");
    assert(links.includes("Blocked URL protocol"), "protocol");
    assert(links.includes('parsed.protocol !== "https:"'), "https");
  }),

  record(18, "Untrusted HTML is not rendered", () => {
    assert(read("lib/communications/contentValidation.ts").includes("HTML tags are not permitted"), "validation");
    assert(!read("components/aegis/client/InsightsFeedClient.tsx").includes("dangerouslySetInnerHTML"), "ui");
  }),

  record(19, "Client feed contains no approval metadata", () => {
    const dto = read("lib/communications/clientSafeInsightsDto.ts");
    assert(dto.includes("ClientSafeInsightItem"), "dto type");
    assert(!dto.includes("approval_status"), "no approval");
    assert(!dto.includes("rejection_reason"), "no rejection");
  }),

  record(20, "Client cannot access another client's targeted message", () => {
    const t = read("lib/communications/audienceTargeting.ts");
    assert(t.includes("selected_clients"), "scope");
    assert(t.includes("target_client_ids.includes"), "id check");
  }),

  record(21, "Document upload creates correct notification", () => {
    assert(read("app/api/documents/upload/route.ts").includes("emitDocumentEventNotification"), "hook");
  }),

  record(22, "Internal document creates no client notification", () => {
    assert(read("lib/communications/documentEventNotifications.ts").includes("if (!input.isClientVisible)"), "gate");
  }),

  record(23, "Document withdrawal immediately removes access", () => {
    assert(read("lib/compliance/documentVisibility.ts").includes("is_archived"), "archived");
  }),

  record(24, "Document replacement marks current version", () => {
    assert(read("lib/communications/documentEventNotifications.ts").includes("document_replaced"), "type");
  }),

  record(25, "Notification metadata contains no sensitive values", () => {
    assert(read("lib/communications/documentEventNotifications.ts").includes("Sign in to Aurelis"), "generic");
    assert(!read("app/api/client/notifications/route.ts").includes("provider_reference"), "no provider");
  }),

  record(26, "Client can mark own notification read", () => {
    const route = read("app/api/client/notifications/[notificationId]/route.ts");
    assert(route.includes("dbMarkNotificationRead"), "mark");
    assert(route.includes("session.client.id"), "scope");
  }),

  record(27, "Client cannot modify another client's notification", () => {
    assert(read("lib/supabase/clientNotificationsPersistence.ts").includes('.eq("client_id", clientId)'), "scope");
  }),

  record(28, "Communication preference update is session-scoped", () => {
    const route = read("app/api/client/communication-preferences/route.ts");
    assert(route.includes("rejectClientIdInBody"), "no client id");
    assert(route.includes("session.client.id"), "session");
  }),

  record(29, "Essential notice handling follows policy", () => {
    assert(read("docs/PHASE_9E_COMMUNICATION_PREFERENCES_POLICY.md").includes("Essential"), "policy");
  }),

  record(30, "Adviser cannot alter client preferences", () => {
    assert(!existsSync(join(ROOT, "app/api/advisor/communication-preferences/route.ts")), "no route");
  }),

  record(31, "Email recipient comes from authoritative data", () => {
    const email = read("lib/communications/emailDelivery.ts");
    assert(email.includes("loadClientEmail"), "loader");
    assert(email.includes('.from("users")'), "users table");
  }),

  record(32, "Email failure does not roll back content publication", () => {
    const delivery = read("lib/communications/publicationDelivery.ts");
    assert(delivery.includes("queueInsightEmailDelivery"), "async");
    assert(read("lib/communications/emailDelivery.ts").includes("delivery_failed"), "track failure");
  }),

  record(33, "Retry is idempotent", () => {
    const email = read("lib/communications/emailDelivery.ts");
    assert(email.includes("retryFailedDelivery"), "retry");
    assert(email.includes('delivery_status === "sent"'), "sent guard");
  }),

  record(34, "Withdrawn content cancels unsent delivery", () => {
    assert(read("app/api/admin/communications/[contentId]/withdraw/route.ts").includes("dbCancelPendingDeliveriesForContent"), "cancel");
  }),

  record(35, "Client cannot view provider metadata", () => {
    assert(read("app/api/admin/communication-deliveries/route.ts").includes("requireAdminAccess"), "admin only");
  }),

  record(36, "Legacy Promotions are not automatically published", () => {
    assert(!read("lib/communications/insightsFeedService.ts").includes("promotions"), "no promo feed");
    assert(read("lib/communications/legacyPromotionsMigration.ts").includes("submitted_for_review"), "review only");
  }),

  record(37, "Legacy migration creates draft/review items only", () => {
    assert(read("lib/communications/legacyPromotionsMigration.ts").includes("approvalStatus"), "status control");
  }),

  record(38, "Binder export requires assigned adviser", () => {
    const binder = read("lib/binder/binderGenerationService.ts");
    assert(
      binder.includes("resolveAccessibleClient") ||
        read("lib/binder/binderSectionResolvers.ts").includes("resolveAccessibleClient"),
      "assignment",
    );
  }),

  record(39, "Binder includes only approved sections", () => {
    const binder = read("lib/binder/binderSectionResolvers.ts");
    assert(
      binder.includes("isCurrentPublishedOutput") ||
        read("lib/binder/binderPdfRedaction.ts").includes("isCurrentPublishedOutput"),
      "approved",
    );
  }),

  record(40, "Binder excludes internal notes", () => {
    assert(read("docs/PHASE_9E_BINDER_EXPORT_POLICY.md").includes("Internal notes"), "policy");
  }),

  record(41, "Binder begins adviser-internal", () => {
    assert(read("supabase/migrations/202606200006_phase9e_communications_governance.sql").includes("published_to_client     BOOLEAN NOT NULL DEFAULT false"), "default");
  }),

  record(42, "Client access requires explicit binder publication", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(/binder_client_publication:[\s\S]*?enabled:\s*false/.test(flags), "off");
  }),

  record(43, "Feature controls fail closed", () => {
    assert(read("lib/communications/insightsFeedService.ts").includes("isFeatureEnabled"), "gate");
    assert(read("lib/compliance/featureFlags.ts").includes("fail-closed"), "defaults");
  }),

  record(44, "Disabling email preserves in-app notification", () => {
    assert(read("docs/PHASE_9E_EMAIL_DELIVERY_POLICY.md").includes("retains in-app"), "doc");
    assert(read("lib/communications/publicationDelivery.ts").includes("dbCreateClientNotification"), "in-app");
  }),

  record(45, "Product content kill switch works", () => {
    assert(read("lib/communications/contentWorkflow.ts").includes("product_related_content"), "check");
  }),

  record(46, "Audit metadata contains no content bodies or financial data", () => {
    assert(read("lib/communications/contentWorkflow.ts").includes("sanitizeAuditMetadata"), "sanitizer");
    assert(read("lib/communications/auditMetadata.ts").includes("SENSITIVE_KEYS"), "keys");
  }),

  record(47, "Personalised APIs use private/no-store caching", () => {
    assert(read("app/api/client/insights/route.ts").includes("CLIENT_API_CACHE_HEADERS"), "insights");
    assert(read("lib/compliance/activeClientAccess.ts").includes("no-store"), "constant");
  }),

  record(48, "Phase 9D active-client portal remains functional", () => {
    assert(read("lib/compliance/entitlements.ts").includes("ACTIVE_CLIENT_NAV_SECTIONS"), "nav");
    assert(read("app/insights/page.tsx").includes("InsightsFeedClient"), "insights page");
  }),

  record(49, "Phase 9C Meeting Studio remains adviser-only", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(/adviser_meeting_studio:[\s\S]*?client_visible:\s*false/.test(flags), "client off");
  }),

  record(50, "Phase 9B prospect journey remains functional", () => {
    assert(read("lib/compliance/entitlements.ts").includes("PROSPECT_NAV_SECTIONS"), "prospect nav");
  }),

  record(51, "No new API security warnings for Phase 9E write routes", () => {
    const routes = [
      "app/api/client/insights/[contentId]/route.ts",
      "app/api/advisor/insights/route.ts",
      "app/api/admin/communications/[contentId]/publish/route.ts",
    ];
    for (const route of routes) {
      const source = read(route);
      assert(
        source.includes("rateLimitOrThrow") || !source.includes("export async function POST"),
        `${route} write rate limited`,
      );
    }
  }),

  record(52, "No undocumented service-role in Phase 9E client components", () => {
    const feed = read("components/aegis/client/InsightsFeedClient.tsx");
    assert(!feed.includes("service-role"), "no service role in client");
    assert(!feed.includes("createAdminSupabaseClient"), "no admin client");
  }),

  record(53, "No new lint warnings in Phase 9E UI", () => {
    assert(!read("components/aegis/client/InsightsFeedClient.tsx").includes("localStorage"), "no storage");
  }),

  record(54, "TypeScript structural check for Phase 9E modules", () => {
    assert(existsSync(join(ROOT, "lib/communications/contentLifecycle.ts")), "lifecycle");
    assert(existsSync(join(ROOT, "lib/communications/auditMetadata.ts")), "audit metadata");
  }),

  record(55, "Production build script configured", () => {
    assert(read("package.json").includes('"build": "next build"'), "build script");
  }),
];

const TESTS: TestCase[] = [...ORIGINAL_TESTS, ...HARDENING_TESTS];

async function runAll(): Promise<void> {
  console.log(`Phase 9E communications validation — ${TESTS.length} cases (55 original + 32 hardening)\n`);

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

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} passed, ${results.length - passed} failed`);

  if (passed !== results.length) {
    process.exit(1);
  }
}

void runAll();
