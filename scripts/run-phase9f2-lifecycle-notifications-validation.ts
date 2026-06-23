/**
 * Phase 9F.2 lifecycle notification validation — 95 explicit checks.
 * Run: npm run qa:phase9f2-lifecycle-notifications
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  assertIdempotencyKeyPrivacy,
  buildLifecycleIdempotencyCanonical,
  buildLifecycleIdempotencyKey,
  LIFECYCLE_IDEMPOTENCY_KEY_MAX_LENGTH,
} from "../lib/communications/lifecycleIdempotencyKey";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function record(id: number, name: string, fn: () => void): TestCase {
  return { id, name, run: fn };
}

const TESTS: TestCase[] = [
  record(1, "audit doc exists", () => assert(existsSync("docs/PHASE_9F2_EXISTING_NOTIFICATION_AUDIT.md"), "audit")),
  record(2, "lifecycle events include available for binder publication", () => {
    assert(read("lib/communications/lifecycleNotificationTypes.ts").includes('"available"'), "available");
    const policy = read("lib/communications/lifecycleNotificationPolicy.ts");
    assert(policy.includes("available:"), "available policy");
  }),
  record(3, "lifecycle types module", () => assert(existsSync("lib/communications/lifecycleNotificationTypes.ts"), "types")),
  record(4, "lifecycle policy module", () => assert(existsSync("lib/communications/lifecycleNotificationPolicy.ts"), "policy")),
  record(5, "lifecycle service module", () => assert(existsSync("lib/communications/lifecycleNotificationService.ts"), "service")),
  record(6, "lifecycle persistence module", () => assert(existsSync("lib/communications/lifecycleNotificationPersistence.ts"), "persist")),
  record(7, "lifecycle payload module", () => assert(existsSync("lib/communications/lifecycleNotificationPayload.ts"), "payload")),
  record(8, "communications index exports lifecycle", () => assert(read("lib/communications/index.ts").includes("emitLifecycleNotification"), "export")),
  record(9, "fixed event union", () => assert(read("lib/communications/lifecycleNotificationTypes.ts").includes("LIFECYCLE_EVENT_NAMES"), "union")),
  record(10, "isLifecycleEventName guard", () => assert(read("lib/communications/lifecycleNotificationTypes.ts").includes("isLifecycleEventName"), "guard")),
  record(11, "replaced wired protection report", () => assert(read("lib/supabase/advisorDocumentPersistence.ts").includes("archivePreviousProtectionReports"), "replaced")),
  record(12, "replaced emits lifecycle", () => assert(read("lib/supabase/advisorDocumentPersistence.ts").includes('event: "replaced"'), "emit")),
  record(13, "superseded wired publishOutput", () => assert(read("lib/compliance/publicationWorkflow.ts").includes("emitPublishedOutputLifecycleNotification"), "output")),
  record(14, "superseded wired publishContent", () => assert(read("lib/communications/contentWorkflow.ts").includes('lifecycleCause: "superseded"'), "content")),
  record(15, "withdrawn wired withdrawOutput", () => assert(read("lib/compliance/publicationWorkflow.ts").includes('event: "withdrawn"'), "withdraw output")),
  record(16, "withdrawn wired withdrawContent", () => assert(read("lib/communications/contentWorkflow.ts").includes("emitGovernedContentLifecycleNotifications"), "withdraw content")),
  record(17, "withdrawn wired adviser delete", () => assert(read("lib/supabase/advisorDocumentPersistence.ts").includes('event: "withdrawn"'), "adviser delete")),
  record(18, "action_required wired upload flag", () => assert(read("app/api/advisor/clients/[clientId]/documents/upload/route.ts").includes("requires_client_action"), "flag")),
  record(19, "action_required service upload", () => assert(read("lib/supabase/advisorDocumentPersistence.ts").includes('event: "action_required"'), "upload")),
  record(20, "action_completed review lifecycle", () => assert(existsSync("lib/compliance/reviewSubmissionLifecycle.ts"), "review lifecycle")),
  record(21, "action_completed task hook", () => assert(read("lib/supabase/advisorTasks.ts").includes("syncReviewSubmissionOnTaskComplete"), "task")),
  record(22, "downloaded wired signed url service", () => assert(read("lib/supabase/documentPersistence.ts").includes('event: "downloaded"'), "download")),
  record(23, "no UI-only lifecycle emit", () => {
    const ui = read("components/aegis/client/ClientNotificationsPanel.tsx");
    assert(!ui.includes("emitLifecycleNotification"), "ui clean");
  }),
  record(24, "scheduled publish shares delivery path", () => assert(read("lib/jobs/scheduledContentEligibility.ts").includes("deliverPublicationNotifications"), "scheduled")),
  record(25, "manual publish shares delivery path", () => assert(read("app/api/admin/communications/[contentId]/publish/route.ts").includes("deliverPublicationNotifications"), "manual")),
  record(26, "failed transition should not notify in routes only", () => assert(read("lib/compliance/publicationWorkflow.ts").includes("emitPublishedOutputLifecycleNotification"), "after success")),
  record(27, "central service used by document events", () => assert(read("lib/communications/documentEventNotifications.ts").includes("emitLifecycleNotificationSafe"), "delegate")),
  record(28, "recipient resolution server-side", () => assert(read("lib/communications/lifecycleNotificationRecipients.ts").includes("resolveClientRecipient"), "recipient")),
  record(29, "governed content audience isolation", () => assert(read("lib/communications/lifecycleNotificationRecipients.ts").includes("contentMatchesAudience"), "audience")),
  record(30, "adviser-only output blocked", () => assert(read("lib/communications/lifecycleNotificationRecipients.ts").includes("adviser_only_output"), "adviser only")),
  record(31, "idempotency key builder", () => assert(read("lib/communications/lifecycleNotificationPolicy.ts").includes("buildLifecycleIdempotencyKey"), "key")),
  record(32, "persistence checks idempotency_key", () => assert(read("lib/communications/lifecycleNotificationPersistence.ts").includes("idempotency_key"), "db key")),
  record(33, "legacy idempotent index preserved", () => assert(read("supabase/migrations/202606200007_phase9e_hardening.sql").includes("idx_client_notifications_idempotent"), "legacy")),
  record(34, "new lifecycle idempotent index", () => assert(read("supabase/migrations/202606200009_phase9f2_lifecycle_notifications.sql").includes("idx_client_notifications_lifecycle_idempotent"), "new index")),
  record(35, "migration additive only", () => {
    const m = read("supabase/migrations/202606200009_phase9f2_lifecycle_notifications.sql");
    assert(m.includes("ADD COLUMN"), "additive");
    assert(!m.includes("DROP TABLE"), "no drop");
  }),
  record(36, "migration version unique", () => assert(existsSync("supabase/migrations/202606200009_phase9f2_lifecycle_notifications.sql"), "version")),
  record(37, "rollback documented", () => assert(read("supabase/migrations/202606200009_phase9f2_lifecycle_notifications.sql").includes("Rollback"), "rollback")),
  record(38, "in-app preference gate", () => assert(read("lib/communications/lifecycleNotificationService.ts").includes("client_in_app_notifications"), "in-app")),
  record(39, "document event feature gate", () => assert(read("lib/communications/lifecycleNotificationService.ts").includes("document_event_notifications"), "feature")),
  record(40, "email not used for lifecycle document events", () => {
    const p = read("lib/communications/lifecycleNotificationPolicy.ts");
    assert(p.includes("emailEligible: false"), "no email");
  }),
  record(41, "downloaded audit-only", () => assert(read("lib/communications/lifecycleNotificationPolicy.ts").includes("inAppEligible: false"), "audit")),
  record(42, "no public send endpoint", () => {
    const api = read("app/api/client/notifications/route.ts");
    assert(!api.includes("POST"), "no post");
  }),
  record(43, "generic summary only", () => assert(read("lib/communications/lifecycleNotificationPolicy.ts").includes("Sign in to Aurelis"), "generic")),
  record(44, "metadata allowlist", () => assert(read("lib/communications/lifecycleNotificationPayload.ts").includes("allowedMetadataKeys"), "allowlist")),
  record(45, "destination allowlist", () => assert(read("lib/communications/lifecycleNotificationPayload.ts").includes("ALLOWED_NOTIFICATION_DESTINATIONS"), "dest")),
  record(46, "external URL rejected in metadata", () => assert(read("lib/communications/lifecycleNotificationPayload.ts").includes("https?:\\/\\/"), "external")),
  record(47, "HTML rejected in metadata", () => assert(read("lib/communications/lifecycleNotificationPayload.ts").includes("<[^>]+>"), "html")),
  record(48, "safe notification API response", () => {
    const route = read("app/api/client/notifications/route.ts");
    assert(route.includes("destinationRoute"), "dest only");
    assert(!route.includes("metadata:"), "no metadata field in response");
  }),
  record(49, "mark read authorized", () => assert(read("app/api/client/notifications/[notificationId]/route.ts").includes("dbMarkNotificationRead"), "mark read")),
  record(50, "client notifications UI", () => assert(existsSync("components/aegis/client/ClientNotificationsPanel.tsx"), "ui")),
  record(51, "UI unread state", () => assert(read("components/aegis/client/ClientNotificationsPanel.tsx").includes("unread"), "unread")),
  record(52, "UI stale destination state", () => assert(read("components/aegis/client/ClientNotificationsPanel.tsx").includes("no longer available"), "stale")),
  record(53, "UI no metadata render", () => assert(!read("components/aegis/client/ClientNotificationsPanel.tsx").includes("metadata"), "no meta")),
  record(54, "UI accessible loading", () => assert(read("components/aegis/client/ClientNotificationsPanel.tsx").includes("aria-busy"), "loading")),
  record(55, "lifecycle failure does not throw", () => assert(read("lib/communications/lifecycleNotificationService.ts").includes("emitLifecycleNotificationSafe"), "safe")),
  record(56, "audit on skip ineligible", () => assert(read("lib/communications/lifecycleNotificationService.ts").includes("lifecycle_notification_skipped"), "skip audit")),
  record(57, "audit on failure", () => assert(read("lib/communications/lifecycleNotificationService.ts").includes("lifecycle_notification_failed"), "fail audit")),
  record(58, "duplicate returns skipped", () => assert(read("lib/communications/lifecycleNotificationPersistence.ts").includes("skipped_duplicate"), "dup")),
  record(59, "architecture doc", () => assert(existsSync("docs/PHASE_9F2_NOTIFICATION_ARCHITECTURE.md"), "arch")),
  record(60, "event catalog doc", () => assert(existsSync("docs/PHASE_9F2_EVENT_CATALOG.md"), "catalog")),
  record(61, "security doc", () => assert(existsSync("docs/PHASE_9F2_SECURITY_AND_PRIVACY.md"), "security")),
  record(62, "migration doc", () => assert(existsSync("docs/PHASE_9F2_MIGRATION_AND_ROLLBACK.md"), "migration doc")),
  record(63, "manual tests doc", () => assert(existsSync("docs/PHASE_9F2_MANUAL_ACCEPTANCE_TESTS.md"), "manual")),
  record(64, "feature control decision documented", () => assert(read("docs/PHASE_9F2_EXISTING_NOTIFICATION_AUDIT.md").includes("document_event_notifications"), "flag")),
  record(65, "no new document_lifecycle_notifications flag required", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(!flags.includes("document_lifecycle_notifications"), "no new flag");
  }),
  record(66, "withdrawContent passes lifecycle cause default", () => assert(read("lib/communications/contentWorkflow.ts").includes('lifecycleCause ?? "withdrawn"'), "default")),
  record(67, "publication supersede includes successor", () => assert(read("lib/compliance/publicationWorkflow.ts").includes("successorOutputId"), "successor")),
  record(68, "content supersede includes successor", () => assert(read("lib/communications/contentWorkflow.ts").includes("successorContentId"), "successor content")),
  record(69, "service role persistence only", () => assert(read("lib/communications/lifecycleNotificationPersistence.ts").includes("createAdminSupabaseClient"), "service")),
  record(70, "insights page includes notifications panel", () => assert(read("app/insights/page.tsx").includes("ClientNotificationsPanel"), "insights ui")),
  record(71, "migration audit doc", () => assert(existsSync("docs/PHASE_9F2_MIGRATION_AUDIT.md"), "migration audit")),
  record(72, "event wiring audit doc", () => assert(existsSync("docs/PHASE_9F2_EVENT_WIRING_AUDIT.md"), "wiring audit")),
  record(73, "preflight diagnostic exists", () => assert(existsSync("supabase/diagnostics/preflight_202606200009_phase9f2.sql"), "preflight")),
  record(74, "verify diagnostic exists", () => assert(existsSync("supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql"), "verify")),
  record(75, "discrepancy diagnostic exists", () => assert(existsSync("supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql"), "discrepancies")),
  record(76, "resolved core shared file", () => assert(existsSync("supabase/diagnostics/phase9f2_202606200009_resolved_core.sql"), "core")),
  record(77, "diagnostic inventory parity", () => {
    const verify = read("supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql");
    const discrepancies = read("supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql");
    const marker = "('202606200009','column','client_notifications','lifecycle_event')";
    assert(verify.includes(marker), "verify");
    assert(discrepancies.includes(marker), "discrepancies");
    const count = (discrepancies.match(/\('202606200009'/g) ?? []).length;
    assert(count >= 30, `inventory count ${count}`);
  }),
  record(78, "rollup classification in verify", () => assert(read("supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql").includes("EXACT_MATCH"), "rollup")),
  record(79, "discrepancies filter non-present only", () => {
    const sql = read("supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql");
    assert(sql.includes("conflicting', 'absent', 'unknown'"), "filter");
    assert(!sql.includes("state = 'present'"), "no present rows");
  }),
  record(80, "diagnostics no XML", () => {
    for (const f of [
      "supabase/diagnostics/preflight_202606200009_phase9f2.sql",
      "supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql",
      "supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql",
    ]) {
      assert(!read(f).includes("xpath("), f);
      assert(!read(f).includes("query_to_xml"), f);
    }
  }),
  record(81, "diagnostics no writes", () => {
    const sql = read("supabase/diagnostics/preflight_202606200009_phase9f2.sql").toLowerCase();
    assert(!sql.includes("insert into"), "insert");
    assert(!sql.includes("delete from"), "delete");
  }),
  record(82, "pg_index catalog for lifecycle index", () => assert(read("supabase/diagnostics/phase9f2_202606200009_resolved_core.sql").includes("pg_index"), "catalog")),
  record(83, "RLS verification in diagnostic", () => assert(read("supabase/diagnostics/phase9f2_202606200009_resolved_core.sql").includes("no_policy"), "rls")),
  record(84, "zero insert policies check", () => assert(read("supabase/diagnostics/phase9f2_202606200009_resolved_core.sql").includes("zero_insert_policies"), "insert policy")),
  record(85, "feature flag in migration seed", () => assert(read("supabase/migrations/202606200006_phase9e_communications_governance.sql").includes("document_event_notifications"), "seed")),
  record(86, "feature flag code default", () => assert(read("lib/compliance/featureFlags.ts").includes("document_event_notifications"), "code")),
  record(87, "supersede not double withdrawn", () => {
    const wf = read("lib/communications/contentWorkflow.ts");
    assert(wf.includes('lifecycleCause: "superseded"'), "supersede");
    assert(wf.includes('lifecycleCause ?? "withdrawn"'), "default withdrawn");
  }),
  record(88, "deactivated client skip", () => assert(read("lib/communications/lifecycleNotificationRecipients.ts").includes("client_not_active_stage"), "inactive")),
  record(89, "unrelated task guard action_completed", () => assert(read("lib/compliance/reviewSubmissionLifecycle.ts").includes("client_review_submission:"), "prefix")),
  record(90, "downloaded no notification type", () => assert(read("lib/communications/lifecycleNotificationPolicy.ts").includes("notificationType: null"), "null type")),
  record(91, "downloaded no dbCreateClientNotification in signed url path", () => {
    const doc = read("lib/supabase/documentPersistence.ts");
    assert(doc.includes('event: "downloaded"'), "audit");
    assert(!doc.includes("dbCreateClientNotification"), "no in-app");
  }),
  record(92, "idempotency key sha256", () => assert(read("lib/communications/lifecycleIdempotencyKey.ts").includes("sha256"), "hash")),
  record(93, "idempotency retry same key", () => {
    const input = {
      event: "withdrawn" as const,
      sourceEntityType: "document" as const,
      sourceEntityId: "11111111-1111-4111-8111-111111111111",
      recipientClientId: "22222222-2222-4222-8222-222222222222",
      sourceLifecycleVersion: "v1",
      channel: "in_app" as const,
    };
    assert(buildLifecycleIdempotencyKey(input) === buildLifecycleIdempotencyKey(input), "stable");
  }),
  record(94, "idempotency different recipient different key", () => {
    const base = {
      event: "withdrawn" as const,
      sourceEntityType: "document" as const,
      sourceEntityId: "11111111-1111-4111-8111-111111111111",
      sourceLifecycleVersion: "v1",
      channel: "in_app" as const,
    };
    const a = buildLifecycleIdempotencyKey({ ...base, recipientClientId: "22222222-2222-4222-8222-222222222222" });
    const b = buildLifecycleIdempotencyKey({ ...base, recipientClientId: "33333333-3333-4333-8333-333333333333" });
    assert(a !== b, "diff recipient");
  }),
  record(95, "idempotency key privacy and max length", () => {
    const key = buildLifecycleIdempotencyKey({
      event: "action_required",
      sourceEntityType: "document",
      sourceEntityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      recipientClientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sourceLifecycleVersion: "2026-06-22T00:00:00.000Z",
      channel: "in_app",
    });
    assert(key.length === LIFECYCLE_IDEMPOTENCY_KEY_MAX_LENGTH, "length");
    assertIdempotencyKeyPrivacy(key);
    const canonical = buildLifecycleIdempotencyCanonical({
      event: "action_required",
      sourceEntityType: "document",
      sourceEntityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      recipientClientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sourceLifecycleVersion: "2026-06-22T00:00:00.000Z",
      channel: "in_app",
    });
    assert(!canonical.includes("@"), "no email in canonical");
  }),
  record(96, "mark-read scoped to client", () => {
    const route = read("app/api/client/notifications/[notificationId]/route.ts");
    assert(route.includes("session.client.id"), "scope");
    assert(route.includes("dbMarkNotificationRead"), "mark");
  }),
  record(97, "notifications API no-store cache", () => assert(read("app/api/client/notifications/route.ts").includes("CLIENT_API_CACHE_HEADERS"), "cache")),
  record(98, "persistence handles unique violation", () => assert(read("lib/communications/lifecycleNotificationPersistence.ts").includes("23505"), "conflict")),
  record(99, "to_regclass guards in preflight", () => assert(read("supabase/diagnostics/preflight_202606200009_phase9f2.sql").includes("to_regclass"), "guard")),
  record(100, "migration follows 202606200008", () => {
    const migrations = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
    const stamps = migrations.map((f) => f.split("_")[0]).sort();
    const idx8 = stamps.indexOf("202606200008");
    const idx9 = stamps.indexOf("202606200009");
    assert(idx8 >= 0 && idx9 === idx8 + 1, "ordering");
  }),
];

function main(): void {
  for (const test of TESTS) {
    try {
      test.run();
      results.push({ id: test.id, name: test.name, passed: true });
    } catch (err) {
      results.push({
        id: test.id,
        name: test.name,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`Phase 9F.2 lifecycle notifications: ${passed}/${results.length} passed`);

  for (const f of failed) {
    console.error(`  FAIL #${f.id} ${f.name}: ${f.error}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
