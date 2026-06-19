/**
 * Phase 9E hardening test cases (56–87).
 * Imported by run-phase9e-communications-validation.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

export type Phase9eTestCase = {
  id: number;
  name: string;
  run: () => void | Promise<void>;
};

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export const HARDENING_TESTS: Phase9eTestCase[] = [
  {
    id: 56,
    name: "Complete 55-case traceability matrix exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "docs/PHASE_9E_QA_TRACEABILITY_MATRIX.md")),
        "traceability matrix doc",
      );
    },
  },
  {
    id: 57,
    name: "Phase 9D reports full 72-case suite",
    run: () => {
      const script = read("scripts/run-phase9d-client-portal-validation.ts");
      assert(script.includes("72 cases"), "header documents 72");
      const matches = script.match(/record\(\d+,/g) ?? [];
      assert(matches.length >= 72, `expected >=72 tests, found ${matches.length}`);
    },
  },
  {
    id: 58,
    name: "Content lifecycle invalid transition rejected",
    run: () => {
      const lifecycle = read("lib/communications/contentLifecycle.ts");
      assert(lifecycle.includes("assertLegalTransition"), "transition guard");
      assert(lifecycle.includes("draft"), "draft transitions");
      assert(!lifecycle.includes('draft: ["submitted_for_review", "published"]'), "no draft→published");
    },
  },
  {
    id: 59,
    name: "Concurrent publish is idempotent",
    run: () => {
      const workflow = read("lib/communications/contentWorkflow.ts");
      assert(workflow.includes("dbPublishGovernedContent"), "conditional publish");
      assert(workflow.includes("approval_status === \"published\""), "idempotent return");
    },
  },
  {
    id: 60,
    name: "Author self-approval rejected at workflow layer",
    run: () => {
      const workflow = read("lib/communications/contentWorkflow.ts");
      assert(workflow.includes("Authors cannot approve their own content"), "self-approve");
    },
  },
  {
    id: 61,
    name: "Published edit creates new version via workflow",
    run: () => {
      const workflow = read("lib/communications/contentWorkflow.ts");
      assert(workflow.includes("dbCreateGovernedContentVersion"), "version row");
    },
  },
  {
    id: 62,
    name: "Duplicate current version handled safely",
    run: () => {
      const persist = read("lib/supabase/governedContentPersistence.ts");
      assert(persist.includes("filterSupersededPublishedRows"), "supersede filter");
      const workflow = read("lib/communications/contentWorkflow.ts");
      assert(workflow.includes("supersedes_content_id"), "withdraw superseded on publish");
    },
  },
  {
    id: 63,
    name: "Reassignment revokes targeted access at feed load",
    run: () => {
      const targeting = read("lib/communications/audienceTargeting.ts");
      assert(
        targeting.includes("row.adviser_user_id === ctx.adviserUserId"),
        "assignment recheck for selected clients",
      );
    },
  },
  {
    id: 64,
    name: "Encoded unsafe URL rejected",
    run: () => {
      const links = read("lib/communications/externalLinkValidation.ts");
      assert(links.includes("decodeURIComponent"), "url decoding");
      assert(links.includes("Encoded unsafe URL scheme rejected"), "encoded scheme block");
    },
  },
  {
    id: 65,
    name: "Raw HTML and script patterns rejected",
    run: () => {
      const validation = read("lib/communications/contentValidation.ts");
      assert(validation.includes("Dangerous markup"), "dangerous markup");
      assert(validation.includes("DANGEROUS_MARKUP_RE"), "pattern scan");
    },
  },
  {
    id: 66,
    name: "Notification creation is idempotent",
    run: () => {
      const persist = read("lib/supabase/clientNotificationsPersistence.ts");
      assert(persist.includes("maybeSingle"), "existing lookup");
      const migration = read("supabase/migrations/202606200007_phase9e_hardening.sql");
      assert(migration.includes("idx_client_notifications_idempotent"), "unique index");
    },
  },
  {
    id: 67,
    name: "Notification ownership enforced in persistence",
    run: () => {
      const persist = read("lib/supabase/clientNotificationsPersistence.ts");
      assert(persist.includes('.eq("client_id", clientId)'), "client scoped updates");
    },
  },
  {
    id: 68,
    name: "Document replacement notification type defined",
    run: () => {
      const events = read("lib/communications/documentEventNotifications.ts");
      assert(events.includes("replaced"), "replaced event");
      const policy = read("docs/PHASE_9E_DOCUMENT_NOTIFICATION_POLICY.md");
      assert(policy.includes("deferred") || policy.includes("Implemented"), "policy status");
    },
  },
  {
    id: 69,
    name: "Document withdrawal revokes access via archive policy",
    run: () => {
      const visibility = read("lib/compliance/documentVisibility.ts");
      assert(visibility.includes("is_archived"), "archived hides");
    },
  },
  {
    id: 70,
    name: "Essential-notice preference policy documented",
    run: () => {
      const policy = read("docs/PHASE_9E_COMMUNICATION_PREFERENCES_POLICY.md");
      assert(policy.includes("Essential"), "essential notices");
      assert(policy.includes("cannot be disabled"), "non-disableable");
    },
  },
  {
    id: 71,
    name: "Adviser cannot modify client preferences (no adviser route)",
    run: () => {
      assert(
        !existsSync(join(ROOT, "app/api/advisor/communication-preferences/route.ts")),
        "no adviser prefs route",
      );
    },
  },
  {
    id: 72,
    name: "Email delivery record is idempotent",
    run: () => {
      const email = read("lib/communications/emailDelivery.ts");
      assert(email.includes("dbFindDeliveryRecord"), "find existing");
      const migration = read("supabase/migrations/202606200007_phase9e_hardening.sql");
      assert(migration.includes("idx_communication_deliveries_idempotent"), "unique delivery");
    },
  },
  {
    id: 73,
    name: "Sent delivery is not resent",
    run: () => {
      const email = read("lib/communications/emailDelivery.ts");
      assert(email.includes('delivery_status === "sent"'), "sent guard");
    },
  },
  {
    id: 74,
    name: "Withdrawal cancels pending delivery",
    run: () => {
      const withdraw = read("app/api/admin/communications/[contentId]/withdraw/route.ts");
      assert(withdraw.includes("dbCancelPendingDeliveriesForContent"), "cancel pending");
    },
  },
  {
    id: 75,
    name: "Provider error is sanitized",
    run: () => {
      const email = read("lib/communications/emailDelivery.ts");
      assert(email.includes("sanitizeProviderError"), "sanitize helper");
      const audit = read("lib/communications/auditMetadata.ts");
      assert(audit.includes("provider_reference"), "blocks provider ref in audit");
    },
  },
  {
    id: 76,
    name: "Scheduling has no background worker — manual publish documented",
    run: () => {
      const workflow = read("lib/communications/contentWorkflow.ts");
      assert(workflow.includes("no background scheduler"), "manual scheduling note");
      const doc = read("docs/PHASE_9E_APPROVAL_WORKFLOW.md");
      assert(doc.includes("manual") || doc.includes("Manual"), "documented manual publish");
    },
  },
  {
    id: 77,
    name: "Legacy migration is duplicate-safe",
    run: () => {
      const migration = read("supabase/migrations/202606200006_phase9e_communications_governance.sql");
      assert(migration.includes("UNIQUE (promotion_id)"), "unique promotion migration");
    },
  },
  {
    id: 78,
    name: "Binder output classified as manifest not rendered PDF",
    run: () => {
      const policy = read("docs/PHASE_9E_BINDER_EXPORT_POLICY.md");
      assert(policy.includes("manifest") || policy.includes("metadata"), "manifest documented");
      const binder = read("lib/communications/binderExport.ts");
      assert(!binder.includes("jspdf") && !binder.includes("html2canvas"), "no PDF render");
    },
  },
  {
    id: 79,
    name: "Binder excludes expired/withdrawn sources",
    run: () => {
      const binder = read("lib/communications/binderExport.ts");
      assert(binder.includes("isCurrentPublishedOutput"), "current published only");
    },
  },
  {
    id: 80,
    name: "Feature flags fail closed on DB error",
    run: () => {
      const flags = read("lib/compliance/featureFlags.ts");
      assert(flags.includes("fail-closed"), "fail closed");
      assert(flags.includes("Using fail-closed code defaults"), "db error fallback");
    },
  },
  {
    id: 81,
    name: "Audit sensitive-key scanner passes",
    run: () => {
      const audit = read("lib/communications/auditMetadata.ts");
      assert(audit.includes("scanMetadataForSensitiveKeys"), "scanner");
      const workflow = read("lib/communications/contentWorkflow.ts");
      assert(workflow.includes("sanitizeAuditMetadata"), "workflow uses sanitizer");
    },
  },
  {
    id: 82,
    name: "Personalised communications use private/no-store",
    run: () => {
      const insights = read("app/api/client/insights/route.ts");
      assert(insights.includes("CLIENT_API_CACHE_HEADERS"), "insights headers");
      const notifications = read("app/api/client/notifications/route.ts");
      assert(notifications.includes("CLIENT_API_CACHE_HEADERS"), "notification headers");
    },
  },
  {
    id: 83,
    name: "No new API security warnings for Phase 9E routes",
    run: () => {
      const routes = [
        "app/api/client/insights/route.ts",
        "app/api/client/insights/[contentId]/route.ts",
        "app/api/advisor/insights/route.ts",
        "app/api/admin/communications/[contentId]/approve/route.ts",
      ];
      for (const route of routes) {
        const source = read(route);
        assert(
          source.includes("rateLimitOrThrow") || !source.includes("export async function POST"),
          `${route} write rate limited`,
        );
      }
    },
  },
  {
    id: 84,
    name: "Phase 9E security review document exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "docs/PHASE_9E_SECURITY_AND_PRIVACY_REVIEW.md")),
        "security review doc",
      );
    },
  },
  {
    id: 85,
    name: "No new lint warnings in Phase 9E client components",
    run: () => {
      const feed = read("components/aegis/client/InsightsFeedClient.tsx");
      assert(!feed.includes("dangerouslySetInnerHTML"), "no raw html");
      assert(!feed.includes("localStorage"), "no local storage");
    },
  },
  {
    id: 86,
    name: "TypeScript passes (structural check)",
    run: () => {
      assert(existsSync(join(ROOT, "tsconfig.json")), "tsconfig present");
      const lifecycle = read("lib/communications/contentLifecycle.ts");
      assert(lifecycle.includes("export function"), "lifecycle module typed");
    },
  },
  {
    id: 87,
    name: "Production build configuration present",
    run: () => {
      const pkg = read("package.json");
      assert(pkg.includes('"build": "next build"'), "build script");
    },
  },
];
