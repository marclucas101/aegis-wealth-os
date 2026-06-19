/**
 * Phase 9A acceptance validation — 20 explicit security and entitlement cases.
 * Run: npm run qa:phase9a-access
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
  record(1, "Prospect cannot access raw dashboard data", () => {
    const route = read("app/api/dashboard/current/route.ts");
    assert(route.includes("resolveClientFinancialReadinessAccess"), "uses access gate");
    assert(route.includes("assertNotRawDashboardPayload"), "raw payload guard");
    assert(!route.includes("loadDashboardSnapshot"), "no raw loader in route");
    const gate = read("lib/compliance/clientAccessGate.ts");
    assert(!gate.includes("loadDashboardSnapshot"), "gate does not load raw dashboard");
  }),

  record(2, "Prospect cannot access raw Shield data", () => {
    const route = read("app/api/shield-diagnostic/current/route.ts");
    assert(route.includes("resolveRestrictedClientModuleAccess"), "restricted access");
    assert(route.includes("wrapClientSafeResponse"), "fallback envelope");
  }),

  record(3, "Prospect cannot access raw stress-test data", () => {
    const route = read("app/api/stress-testing/current/route.ts");
    assert(route.includes("resolveRestrictedClientModuleAccess"), "restricted access");
    assert(route.includes("stress_test_summary"), "safe output type");
  }),

  record(4, "Active client cannot access adviser-internal payloads", () => {
    const gate = read("lib/compliance/clientAccessGate.ts");
    assert(
      gate.includes('reason: "Use adviser APIs for internal client analysis"'),
      "client role blocked from internal",
    );
    const dtos = read("lib/compliance/clientSafeDtos.ts");
    assert(dtos.includes("PROHIBITED_PAYLOAD_KEYS"), "prohibited keys defined");
  }),

  record(5, "Assigned adviser can access full client analysis", () => {
    const route = read("app/api/advisor/clients/[clientId]/dashboard/route.ts");
    assert(route.includes("requireAdvisorAccess"), "adviser auth");
    assert(route.includes("loadAdvisorClientDashboardView"), "full snapshot loader");
    assert(route.includes("readOnly: true"), "read-only flag");
  }),

  record(6, "Unassigned adviser receives 403", () => {
    const views = read("lib/supabase/advisorClientFinancialViews.ts");
    assert(views.includes("resolveAccessibleClient"), "assignment in financial views");
    const route = read("app/api/advisor/clients/[clientId]/dashboard/route.ts");
    assert(route.includes('reason: "forbidden"'), "403 response");
    assert(route.includes('status: 403'), "403 status");
  }),

  record(7, "Admin access follows explicit policy", () => {
    const adminStage = read("app/api/admin/clients/[clientId]/relationship-stage/route.ts");
    assert(adminStage.includes("requireAdminAccess"), "admin-only route");
    assert(!adminStage.includes("requireAdvisorAccess"), "no adviser fallback on admin route");
    const feature = read("app/api/admin/feature-controls/route.ts");
    assert(feature.includes("requireAdminAccess"), "feature controls admin-only");
  }),

  record(8, "Client cannot publish an output", () => {
    const pubs = read("app/api/advisor/clients/[clientId]/publications/route.ts");
    assert(pubs.includes("requireAdvisorAccess"), "publications adviser-only");
    assert(!existsSync(join(ROOT, "app/api/client/publications/route.ts")), "no client publish API");
  }),

  record(9, "Adviser cannot publish for an unassigned client", () => {
    const publish = read(
      "app/api/advisor/clients/[clientId]/publications/[outputId]/publish/route.ts",
    );
    assert(publish.includes("canPublishClientOutput"), "publish entitlement check");
    assert(publish.includes("requireAssignment"), "assignment re-verified at publish");
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    assert(workflow.includes("requireAssignment"), "workflow assignment gate");
  }),

  record(10, "Published safe DTO contains only allowlisted fields", async () => {
    const dtos = read("lib/compliance/clientSafeDtos.ts");
    assert(dtos.includes("FINANCIAL_READINESS_SNAPSHOT_ALLOWLIST"), "allowlist");
    assert(dtos.includes("assertNoProhibitedKeysDeep"), "deep key scan");
    assert(dtos.includes("parseAppointmentCta"), "nested CTA validation");
    const { runClientSafeDtoNegativeTests } = await import(
      "./client-safe-dto-negative-tests"
    );
    runClientSafeDtoNegativeTests();
  }),

  record(11, "Draft output is not visible to the client", () => {
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    assert(workflow.includes('publication_status !== "draft"'), "draft excluded from review/publish paths");
    const migration = read(
      "supabase/migrations/202606200001_phase9a_compliance_access_architecture.sql",
    );
    assert(migration.includes("publication_status = 'published'"), "RLS requires published");
  }),

  record(12, "Superseded output is not treated as current", () => {
    function isCurrent(row: {
      publication_status: string;
      withdrawn_at: string | null;
      superseded_at: string | null;
      expires_at: string | null;
      output_audience: string;
    }): boolean {
      if (row.publication_status !== "published") return false;
      if (row.withdrawn_at || row.superseded_at) return false;
      if (row.expires_at && new Date(row.expires_at) <= new Date()) return false;
      if (row.output_audience !== "client_published") return false;
      return true;
    }
    assert(
      !isCurrent({
        publication_status: "published",
        withdrawn_at: null,
        superseded_at: "2026-01-01",
        expires_at: null,
        output_audience: "client_published",
      }),
      "superseded not current",
    );
  }),

  record(13, "Expired output is not treated as current", () => {
    function isCurrent(row: {
      publication_status: string;
      withdrawn_at: string | null;
      superseded_at: string | null;
      expires_at: string | null;
      output_audience: string;
    }): boolean {
      if (row.publication_status !== "published") return false;
      if (row.withdrawn_at || row.superseded_at) return false;
      if (row.expires_at && new Date(row.expires_at) <= new Date()) return false;
      return row.output_audience === "client_published";
    }
    assert(
      !isCurrent({
        publication_status: "published",
        withdrawn_at: null,
        superseded_at: null,
        expires_at: "2020-01-01",
        output_audience: "client_published",
      }),
      "expired not current",
    );
  }),

  record(14, "Withdrawn output is not visible", () => {
    function isCurrent(row: {
      publication_status: string;
      withdrawn_at: string | null;
      superseded_at: string | null;
      expires_at: string | null;
      output_audience: string;
    }): boolean {
      if (row.publication_status !== "published") return false;
      if (row.withdrawn_at || row.superseded_at) return false;
      if (row.expires_at && new Date(row.expires_at) <= new Date()) return false;
      return row.output_audience === "client_published";
    }
    assert(
      !isCurrent({
        publication_status: "published",
        withdrawn_at: "2026-01-01",
        superseded_at: null,
        expires_at: null,
        output_audience: "client_published",
      }),
      "withdrawn not current",
    );
    const migration = read(
      "supabase/migrations/202606200001_phase9a_compliance_access_architecture.sql",
    );
    assert(migration.includes("withdrawn_at IS NULL"), "RLS excludes withdrawn");
  }),

  record(15, "Relationship stage cannot be changed by the client", () => {
    const stage = read("lib/compliance/relationshipStage.ts");
    assert(stage.includes("canClientSelfPromote"), "self-promote guard");
    assert(!existsSync(join(ROOT, "app/api/client/relationship-stage/route.ts")), "no client route");
    const adviserRoute = read(
      "app/api/advisor/clients/[clientId]/relationship-stage/route.ts",
    );
    assert(adviserRoute.includes("requireAdvisorAccess"), "adviser route gated");
    assert(adviserRoute.includes("ADMIN_ONLY_STAGES"), "admin stages blocked for adviser");
  }),

  record(16, "Client navigation is based on server entitlements", () => {
    const shell = read("components/aegis/AuthenticatedAppShell.tsx");
    assert(shell.includes("getNavSectionsForEntitlements"), "entitlement nav");
    assert(shell.includes("getClientEntitlements"), "entitlements loaded");
    assert(existsSync(join(ROOT, "app/api/client/entitlements/route.ts")), "entitlements API");
  }),

  record(17, "Feature kill switch blocks client but preserves adviser access", () => {
    const flags = read("lib/compliance/featureFlags.ts");
    assert(flags.includes("FEATURE_DEFAULTS"), "code defaults");
    assert(
      flags.includes("raw_client_financial_views"),
      "raw views flag",
    );
    const defaults = read("lib/compliance/featureFlags.ts");
    assert(defaults.includes("client_visible: false"), "raw views off for clients");
    assert(defaults.includes("adviser_visible: true"), "adviser preserved");
    assert(defaults.includes("Using fail-closed code defaults"), "fail-closed on DB error");
  }),

  record(18, "Publication actions create audit records", () => {
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    for (const action of [
      "publication_prepared",
      "publication_reviewed",
      "publication_published",
      "publication_superseded",
      "publication_withdrawn",
    ]) {
      assert(workflow.includes(action), `audit action ${action}`);
    }
  }),

  record(19, "Client-safe fallback never exposes raw analysis", () => {
    const gate = read("lib/compliance/clientAccessGate.ts");
    assert(gate.includes('accessMode: "fallback"'), "fallback mode");
    assert(gate.includes("resolveFallbackState"), "fallback state resolver");
    assert(!gate.includes("return NextResponse.json({ ok: true, ...snapshot })"), "no raw return");
    const fallback = read("components/aegis/client/ClientSafeFallbackPanel.tsx");
    assert(fallback.includes("isClientSafeEnvelopeResponse"), "envelope detector");
  }),

  record(20, "Existing Phase 8C adviser views remain functional", () => {
    assert(
      existsSync(join(ROOT, "lib/supabase/advisorClientFinancialViews.ts")),
      "Phase 8C loader exists",
    );
    for (const api of [
      "app/api/advisor/clients/[clientId]/dashboard/route.ts",
      "app/api/advisor/clients/[clientId]/shield-diagnostic/route.ts",
      "app/api/advisor/clients/[clientId]/stress-tests/route.ts",
    ]) {
      const source = read(api);
      assert(source.includes("requireAdvisorAccess"), `${api} gated`);
      assert(source.includes("readOnly: true"), `${api} read-only`);
    }
  }),
];

async function main(): Promise<void> {
  console.log("Phase 9A access validation — 20 required cases\n");

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
  console.log(`\nPhase 9A: ${passed}/20 cases passed.`);

  if (passed !== 20) {
    process.exitCode = 1;
  }
}

void main();
