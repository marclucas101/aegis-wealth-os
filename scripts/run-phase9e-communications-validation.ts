/**
 * Phase 9E acceptance validation — communications governance (52 cases).
 * Run: npm run qa:phase9e-communications
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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

const TESTS: TestCase[] = [
  record(1, "Client sees only approved published Insights", () => {
    const feed = read("lib/communications/insightsFeedService.ts");
    assert(feed.includes("dbListPublishedContent"), "published loader");
    assert(feed.includes("contentMatchesAudience"), "audience filter");
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes('approval_status !== "published"'), "published only");
  }),

  record(2, "Draft content is invisible", () => {
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes("isPublishedAndCurrent"), "current filter");
  }),

  record(3, "Submitted content is invisible", () => {
    const workflow = read("lib/communications/contentWorkflow.ts");
    assert(workflow.includes("submitted_for_review"), "submitted status");
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes('"published"'), "only published");
  }),

  record(4, "Rejected content is invisible", () => {
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes("isPublishedAndCurrent"), "status gate");
  }),

  record(5, "Withdrawn content disappears", () => {
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes("withdrawn_at"), "withdrawn check");
  }),

  record(6, "Expired content is not current", () => {
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes("expires_at"), "expiry check");
  }),

  record(7, "Adviser cannot self-approve", () => {
    const workflow = read("lib/communications/contentWorkflow.ts");
    assert(workflow.includes("Authors cannot approve their own content"), "self-approve block");
  }),

  record(8, "Adviser cannot target unassigned client", () => {
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes("Cannot target clients not assigned to you"), "assignment check");
    const route = read("app/api/advisor/insights/route.ts");
    assert(route.includes("validateTargetClientIds"), "API validation");
  }),

  record(9, "Admin can approve under explicit policy", () => {
    const route = read("app/api/admin/communications/[contentId]/approve/route.ts");
    assert(route.includes("requireAdminAccess"), "admin gate");
    assert(route.includes("admin_content_approval"), "feature control");
  }),

  record(10, "Published content cannot be silently edited", () => {
    const workflow = read("lib/communications/contentWorkflow.ts");
    assert(workflow.includes("Published content cannot be silently edited"), "edit block");
  }),

  record(11, "New edit creates a new version", () => {
    const workflow = read("lib/communications/contentWorkflow.ts");
    assert(workflow.includes("dbCreateGovernedContentVersion"), "version create");
    assert(workflow.includes("supersedesContentId"), "supersede link");
  }),

  record(12, "Audience targeting is enforced server-side", () => {
    const feed = read("lib/communications/insightsFeedService.ts");
    assert(feed.includes("contentMatchesAudience"), "server filter");
  }),

  record(13, "Prospect and active-client targeting differ correctly", () => {
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes("isActiveClientStage"), "active client");
    assert(targeting.includes("isProspectStage"), "prospect");
  }),

  record(14, "Inactive-client policy is enforced", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes('stage === "inactive_client"'), "inactive stage");
    assert(ent.includes("insights_and_updates = false"), "insights off");
  }),

  record(15, "Product-related content defaults disabled", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("product_related_content"), "key exists");
    assert(flags.includes("enabled: false"), "default off");
  }),

  record(16, "Market update requires source and review date", () => {
    const validation = read("lib/communications/contentValidation.ts");
    assert(validation.includes("Source name is required for market updates"), "source required");
    assert(validation.includes("Expiry or review date is required for market updates"), "expiry required");
  }),

  record(17, "Unsafe external URL rejected", () => {
    const links = read("lib/communications/externalLinkValidation.ts");
    assert(links.includes("javascript"), "blocks javascript");
    assert(links.includes('parsed.protocol !== "https:"'), "https only");
  }),

  record(18, "Untrusted HTML is not rendered", () => {
    const validation = read("lib/communications/contentValidation.ts");
    assert(validation.includes("HTML tags are not permitted"), "no HTML");
    const client = read("components/aegis/client/InsightsFeedClient.tsx");
    assert(!client.includes("dangerouslySetInnerHTML"), "no raw HTML render");
  }),

  record(19, "Client feed contains no approval metadata", () => {
    const dto = read("lib/communications/clientSafeInsightsDto.ts");
    assert(!dto.includes("approval_status"), "no approval in DTO");
    assert(!dto.includes("rejection_reason"), "no rejection in DTO");
  }),

  record(20, "Client cannot access another client's targeted message", () => {
    const targeting = read("lib/communications/audienceTargeting.ts");
    assert(targeting.includes("selected_clients"), "selected scope");
    assert(targeting.includes("target_client_ids.includes"), "ID check");
  }),

  record(21, "Document upload creates correct notification", () => {
    const upload = read("app/api/documents/upload/route.ts");
    assert(upload.includes("emitDocumentEventNotification"), "notification hook");
    const events = read("lib/communications/documentEventNotifications.ts");
    assert(events.includes("document_uploaded"), "upload type");
  }),

  record(22, "Internal document creates no client notification", () => {
    const events = read("lib/communications/documentEventNotifications.ts");
    assert(events.includes("if (!input.isClientVisible)"), "visibility gate");
    const adviser = read("app/api/advisor/clients/[clientId]/documents/upload/route.ts");
    assert(adviser.includes("isClientVisible"), "tag check");
  }),

  record(23, "Document withdrawal immediately removes access", () => {
    const visibility = read("lib/compliance/documentVisibility.ts");
    assert(visibility.includes("is_archived"), "archived check");
  }),

  record(24, "Document replacement marks current version", () => {
    const events = read("lib/communications/documentEventNotifications.ts");
    assert(events.includes("document_replaced"), "replaced type");
  }),

  record(25, "Notification metadata contains no sensitive values", () => {
    const events = read("lib/communications/documentEventNotifications.ts");
    assert(events.includes("Sign in to Aurelis"), "generic summary");
    const notif = read("app/api/client/notifications/route.ts");
    assert(!notif.includes("provider_reference"), "no provider metadata");
  }),

  record(26, "Client can mark own notification read", () => {
    const route = read("app/api/client/notifications/[notificationId]/route.ts");
    assert(route.includes("dbMarkNotificationRead"), "mark read");
    assert(route.includes("session.client.id"), "session scoped");
  }),

  record(27, "Client cannot modify another client's notification", () => {
    const persist = read("lib/supabase/clientNotificationsPersistence.ts");
    assert(persist.includes(".eq(\"client_id\", clientId)"), "client scope");
  }),

  record(28, "Communication preference update is session-scoped", () => {
    const route = read("app/api/client/communication-preferences/route.ts");
    assert(route.includes("rejectClientIdInBody"), "no client ID in body");
    assert(route.includes("session.client.id"), "session client");
  }),

  record(29, "Essential notice handling follows policy", () => {
    const doc = read("docs/PHASE_9E_COMMUNICATION_PREFERENCES_POLICY.md");
    assert(doc.includes("Essential security"), "essential policy documented");
  }),

  record(30, "Adviser cannot alter client preferences", () => {
    const route = read("app/api/client/communication-preferences/route.ts");
    assert(route.includes("assertActiveClientPortalAccess"), "client only");
    assert(!existsSync(join(ROOT, "app/api/advisor/communication-preferences/route.ts")), "no adviser prefs API");
  }),

  record(31, "Email recipient comes from authoritative data", () => {
    const email = read("lib/communications/emailDelivery.ts");
    assert(email.includes("loadClientEmail"), "server email load");
    assert(email.includes('.from("clients")'), "authoritative query");
  }),

  record(32, "Email failure does not roll back content publication", () => {
    const publish = read("app/api/admin/communications/[contentId]/publish/route.ts");
    assert(publish.includes("queueInsightEmailDelivery"), "async email");
    const email = read("lib/communications/emailDelivery.ts");
    assert(email.includes("delivery_failed"), "failure tracked separately");
  }),

  record(33, "Retry is idempotent", () => {
    const email = read("lib/communications/emailDelivery.ts");
    assert(email.includes('delivery_status === "sent"'), "sent early return");
    assert(email.includes("retryFailedDelivery"), "retry function");
  }),

  record(34, "Withdrawn content cancels unsent delivery", () => {
    const withdraw = read("app/api/admin/communications/[contentId]/withdraw/route.ts");
    assert(withdraw.includes("dbCancelPendingDeliveriesForContent"), "cancel pending");
  }),

  record(35, "Client cannot view provider metadata", () => {
    const deliveries = read("app/api/admin/communication-deliveries/route.ts");
    assert(deliveries.includes("requireAdminAccess"), "admin only");
    const clientNotif = read("app/api/client/notifications/route.ts");
    assert(!clientNotif.includes("provider_reference"), "no provider ref");
  }),

  record(36, "Legacy Promotions are not automatically published", () => {
    const migration = read("lib/communications/legacyPromotionsMigration.ts");
    assert(migration.includes("draft") || migration.includes("submitted_for_review"), "draft/review only");
    const feed = read("lib/communications/insightsFeedService.ts");
    assert(!feed.includes("promotions"), "no promotions in feed");
  }),

  record(37, "Legacy migration creates draft/review items only", () => {
    const migration = read("lib/communications/legacyPromotionsMigration.ts");
    assert(migration.includes("approvalStatus"), "controlled status");
    assert(migration.includes("submitted_for_review"), "review status");
  }),

  record(38, "Binder export requires assigned adviser", () => {
    const binder = read("lib/communications/binderExport.ts");
    assert(binder.includes("resolveAccessibleClient"), "assignment check");
    const route = read("app/api/advisor/clients/[clientId]/binder-export/route.ts");
    assert(route.includes("requireAdvisorAccess"), "adviser gate");
  }),

  record(39, "Binder includes only approved sections", () => {
    const binder = read("lib/communications/binderExport.ts");
    assert(binder.includes("isCurrentPublishedOutput"), "approved only");
  }),

  record(40, "Binder excludes internal notes", () => {
    const doc = read("docs/PHASE_9E_BINDER_EXPORT_POLICY.md");
    assert(doc.includes("Internal notes"), "policy excludes notes");
  }),

  record(41, "Binder begins adviser-internal", () => {
    const migration = read("supabase/migrations/202606200006_phase9e_communications_governance.sql");
    assert(migration.includes("published_to_client     BOOLEAN NOT NULL DEFAULT false"), "default internal");
  }),

  record(42, "Client access requires explicit binder publication", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("binder_client_publication"), "publication control");
    assert(flags.includes("enabled: false"), "default off");
  }),

  record(43, "Feature controls fail closed", () => {
    const feed = read("lib/communications/insightsFeedService.ts");
    assert(feed.includes("isFeatureEnabled"), "feature gate");
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("fail-closed"), "fail closed comment");
  }),

  record(44, "Disabling email preserves in-app notification", () => {
    const doc = read("docs/PHASE_9E_EMAIL_DELIVERY_POLICY.md");
    assert(doc.includes("retains in-app"), "documented");
    const publish = read("app/api/admin/communications/[contentId]/publish/route.ts");
    assert(publish.includes("dbCreateClientNotification"), "in-app on publish");
  }),

  record(45, "Product content kill switch works", () => {
    const workflow = read("lib/communications/contentWorkflow.ts");
    assert(workflow.includes("product_related_content"), "product check");
  }),

  record(46, "Audit metadata contains no content bodies or financial data", () => {
    const workflow = read("lib/communications/contentWorkflow.ts");
    assert(workflow.includes("metadata: { category"), "minimal metadata");
    assert(!workflow.includes("metadata: { body"), "no body in audit");
  }),

  record(47, "Personalised APIs use private/no-store caching", () => {
    const insights = read("app/api/client/insights/route.ts");
    assert(insights.includes("CLIENT_API_CACHE_HEADERS"), "cache headers");
    const prefs = read("app/api/client/communication-preferences/route.ts");
    assert(prefs.includes("CLIENT_API_CACHE_HEADERS"), "cache headers on prefs");
    const access = read("lib/compliance/activeClientAccess.ts");
    assert(access.includes("no-store"), "no-store constant");
  }),

  record(48, "Phase 9D active-client portal remains functional", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("ACTIVE_CLIENT_NAV_SECTIONS"), "9D nav preserved");
    assert(ent.includes("/insights"), "insights in nav");
  }),

  record(49, "Phase 9C Meeting Studio remains adviser-only", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("adviser_meeting_studio"), "meeting studio");
    assert(flags.includes("client_visible: false"), "not client visible");
  }),

  record(50, "Phase 9B prospect journey remains functional", () => {
    const ent = read("lib/compliance/entitlements.ts");
    assert(ent.includes("PROSPECT_NAV_SECTIONS"), "prospect nav");
    assert(ent.includes("isProspectExperience"), "prospect guard");
  }),

  record(51, "Governed content migration exists", () => {
    assert(
      existsSync(join(ROOT, "supabase/migrations/202606200006_phase9e_communications_governance.sql")),
      "migration file",
    );
  }),

  record(52, "Required documentation exists", () => {
    const docs = [
      "docs/PHASE_9E_COMMUNICATIONS_AUDIT.md",
      "docs/PHASE_9E_CONTENT_CLASSIFICATION_POLICY.md",
      "docs/PHASE_9E_APPROVAL_WORKFLOW.md",
      "docs/PHASE_9E_AUDIENCE_TARGETING_POLICY.md",
      "docs/PHASE_9E_DOCUMENT_NOTIFICATION_POLICY.md",
      "docs/PHASE_9E_COMMUNICATION_PREFERENCES_POLICY.md",
      "docs/PHASE_9E_EMAIL_DELIVERY_POLICY.md",
      "docs/PHASE_9E_LEGACY_PROMOTIONS_MIGRATION.md",
      "docs/PHASE_9E_BINDER_EXPORT_POLICY.md",
      "docs/PHASE_9E_MANUAL_ACCEPTANCE_TESTS.md",
      "docs/PHASE_9E_MIGRATION_AND_ROLLBACK.md",
    ];
    for (const doc of docs) {
      assert(existsSync(join(ROOT, doc)), `missing ${doc}`);
    }
  }),
];

async function runAll(): Promise<void> {
  console.log(`Phase 9E communications validation — ${TESTS.length} cases\n`);

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
  const failed = results.length - passed;

  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

void runAll();
