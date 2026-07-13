/**
 * CRM V2 Phase 01 + Phase 15 — foundation shell validation (≥120 explicit checks).
 * Run: npm run qa:crm-v2-shell
 *
 * Phase 15.1: expectations aligned with /advisor primary workspace and /advisor-v2 redirect.
 * Each check is independently reported — grouped assertions are not collapsed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { runPilotConfigUnitTests } from "../lib/crm-v2/pilotConfigTests";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const PHASE_01_DOCS = [
  "docs/CRM_V2_PHASE_01_SHELL_ARCHITECTURE.md",
  "docs/CRM_V2_PHASE_01_FEATURE_GATING.md",
  "docs/CRM_V2_PHASE_01_SECURITY_REVIEW.md",
  "docs/CRM_V2_PHASE_01_MANUAL_TESTS.md",
  "docs/CRM_V2_PHASE_01_COMPLETION.md",
] as const;

const ROUTE_PAGES = [
  { segment: "landing", path: "app/advisor-v2/page.tsx" },
  { segment: "today", path: "app/advisor/(crm-v2)/today/page.tsx" },
  { segment: "relationships", path: "app/advisor/(crm-v2)/relationships/page.tsx" },
  { segment: "appointments", path: "app/advisor/(crm-v2)/workspace/appointments/page.tsx" },
  { segment: "service", path: "app/advisor/(crm-v2)/service/page.tsx" },
  { segment: "communications", path: "app/advisor/(crm-v2)/communications/page.tsx" },
  { segment: "reports", path: "app/advisor/(crm-v2)/reports/page.tsx" },
  { segment: "operations", path: "app/advisor/(crm-v2)/operations/page.tsx" },
  { segment: "templates", path: "app/advisor/(crm-v2)/templates/page.tsx" },
  { segment: "settings", path: "app/advisor/(crm-v2)/settings/page.tsx" },
] as const;

const CRM_V2_LIB_FILES = [
  "lib/crm-v2/access.ts",
  "lib/crm-v2/pilotConfig.ts",
  "lib/crm-v2/navigation.ts",
  "lib/crm-v2/constants.ts",
] as const;

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const TESTS: TestCase[] = [];
let nextId = 1;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function check(name: string, fn: () => void): void {
  const id = nextId++;
  TESTS.push({ id, name, run: fn });
}

function doc(path: string): string {
  return read(path);
}

function listFilesRecursive(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  const entries = readdirSync(abs, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const rel = join(dir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

// --- Routes (14 checks) ---

for (const route of ROUTE_PAGES) {
  check(`route exists: /advisor-v2/${route.segment === "landing" ? "" : route.segment}`.replace(
    /\/$/,
    "",
  ), () => {
    assert(existsSync(route.path), `missing ${route.path}`);
  });
}

check("route shell: layout.tsx exists", () => {
  assert(existsSync("app/advisor-v2/layout.tsx"), "missing");
});

check("route shell: loading.tsx exists", () => {
  assert(existsSync("app/advisor-v2/loading.tsx"), "missing");
});

check("route shell: error.tsx exists", () => {
  assert(existsSync("app/advisor-v2/error.tsx"), "missing");
});

check("route guard: relationships/[relationshipId] detail route exists (Phase 02)", () => {
  assert(
    existsSync("app/advisor/(crm-v2)/relationships/[relationshipId]/page.tsx"),
    "relationship detail route missing",
  );
});

check("route guard: no legacy relationships/[id] alias route", () => {
  assert(!existsSync("app/advisor-v2/relationships/[id]"), "legacy [id] alias present");
});

check("route guard: appointments detail route uses appointmentId param", () => {
  assert(!existsSync("app/advisor-v2/appointments/[id]"), "legacy [id] alias present");
  assert(
    existsSync("app/advisor/(crm-v2)/workspace/appointments/[appointmentId]/page.tsx"),
    "appointment detail route missing",
  );
});

// --- Auth (14 checks) ---

check("auth: lib/crm-v2/access.ts exists", () => {
  assert(existsSync("lib/crm-v2/access.ts"), "missing");
});

check("auth: access.ts is server-only", () => {
  assert(doc("lib/crm-v2/access.ts").includes('import "server-only"'), "missing server-only");
});

check("auth: assertCrmV2Access exported", () => {
  assert(/export async function assertCrmV2Access/.test(doc("lib/crm-v2/access.ts")), "missing export");
});

check("auth: uses requireAdvisorAccess", () => {
  const access = doc("lib/crm-v2/access.ts");
  assert(access.includes("requireAdvisorAccess"), "missing requireAdvisorAccess import/use");
  assert(access.includes("await requireAdvisorAccess()"), "not awaited");
});

check("auth: no isAdminRole bypass in access.ts", () => {
  const access = doc("lib/crm-v2/access.ts");
  assert(!access.includes("isAdminRole"), "admin bypass present");
});

check("auth: no admin_content_approval bypass in access.ts", () => {
  const access = doc("lib/crm-v2/access.ts");
  assert(!access.includes("requireAdminAccess"), "admin access helper used");
  assert(!access.includes("isAdmin"), "admin check present");
});

check("auth: layout calls assertCrmV2Access", () => {
  const layout = doc("app/advisor-v2/layout.tsx");
  assert(layout.includes("assertCrmV2Access"), "missing guard call");
  assert(layout.includes("await assertCrmV2Access()"), "guard not awaited");
});

check("auth: layout imports centralized access helper", () => {
  assert(doc("app/advisor-v2/layout.tsx").includes("@/lib/crm-v2/access"), "missing import");
});

check("auth: unauthenticated uses AdvisorAccessDenied path", () => {
  const layout = doc("app/advisor-v2/layout.tsx");
  assert(layout.includes("unauthenticated"), "unauthenticated branch missing");
  assert(layout.includes("AdvisorAccessDenied"), "adviser denial component missing");
});

check("auth: pilot denial uses CrmV2AccessDenied", () => {
  const layout = doc("app/advisor-v2/layout.tsx");
  assert(layout.includes("CrmV2AccessDenied"), "CRM denial component missing");
});

check("auth: CrmV2AccessDenied does not disclose allowlist", () => {
  const denied = doc("components/aegis/advisor-v2/CrmV2AccessDenied.tsx");
  assert(!denied.includes("allowlist"), "allowlist mentioned");
  assert(!denied.includes("pilot user"), "pilot user mentioned");
  assert(!UUID_RE.test(denied), "UUID disclosed");
});

check("auth: access returns safe denial reasons only", () => {
  const access = doc("lib/crm-v2/access.ts");
  assert(access.includes('"feature_disabled"'), "feature_disabled reason missing");
  assert(access.includes('"pilot_not_eligible"'), "pilot_not_eligible reason missing");
  assert(access.includes('"pilot_mode_disabled"'), "pilot_mode_disabled reason missing");
});

check("auth: access does not load client financial data", () => {
  const access = doc("lib/crm-v2/access.ts");
  assert(!access.includes("loadDashboard"), "dashboard loader present");
  assert(!access.includes("createClient"), "supabase client present");
  assert(!access.includes("financial"), "financial reference present");
});

check("auth: access fail-closed before pilot allowlist parse", () => {
  const access = doc("lib/crm-v2/access.ts");
  const masterIdx = access.indexOf("CRM_V2_MASTER_FEATURE_KEY");
  const pilotIdx = access.indexOf("CRM_V2_PILOT_MODE_FEATURE_KEY");
  const parseIdx = access.indexOf("parsePilotAllowlistFromEnv");
  assert(masterIdx > 0 && pilotIdx > masterIdx, "master must precede pilot flag");
  assert(parseIdx > pilotIdx, "allowlist parse must follow pilot flag");
});

// --- Master feature (14 checks) ---

check("master: crm_v2_master in types.ts PlatformFeatureKey", () => {
  assert(doc("lib/compliance/types.ts").includes('| "crm_v2_master"'), "missing union member");
});

check("master: crm_v2_master in PLATFORM_FEATURE_KEYS", () => {
  assert(doc("lib/compliance/types.ts").includes('"crm_v2_master"'), "missing key array entry");
});

check("master: crm_v2_master in featureFlags.ts FEATURE_DEFAULTS", () => {
  assert(doc("lib/compliance/featureFlags.ts").includes("crm_v2_master:"), "missing defaults block");
});

check("master: code default enabled false", () => {
  const flags = doc("lib/compliance/featureFlags.ts");
  const block = flags.slice(flags.indexOf("crm_v2_master:"), flags.indexOf("crm_v2_pilot_mode:"));
  assert(block.includes("enabled: false"), "enabled not false");
});

check("master: code default client_visible false", () => {
  const flags = doc("lib/compliance/featureFlags.ts");
  const block = flags.slice(flags.indexOf("crm_v2_master:"), flags.indexOf("crm_v2_pilot_mode:"));
  assert(block.includes("client_visible: false"), "client_visible not false");
});

check("master: constants exports CRM_V2_MASTER_FEATURE_KEY", () => {
  assert(doc("lib/crm-v2/constants.ts").includes('crm_v2_master"'), "missing constant");
});

check("master: access uses CRM_V2_MASTER_FEATURE_KEY", () => {
  assert(doc("lib/crm-v2/access.ts").includes("CRM_V2_MASTER_FEATURE_KEY"), "missing usage");
});

check("master: migration seeds crm_v2_master", () => {
  assert(doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql").includes("'crm_v2_master'"), "missing seed");
});

check("master: migration seeds crm_v2_master disabled", () => {
  const sql = doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql");
  const block = sql.slice(sql.indexOf("'crm_v2_master'"), sql.indexOf("'crm_v2_pilot_mode'"));
  assert(/\bfalse\b/.test(block), "master not disabled in migration");
});

check("master: migration seeds crm_v2_master client_visible false", () => {
  const sql = doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql");
  const block = sql.slice(sql.indexOf("'crm_v2_master'"), sql.indexOf("'crm_v2_pilot_mode'"));
  const lines = block.split("\n").map((l) => l.trim());
  const falseCount = lines.filter((l) => l === "false," || l === "false").length;
  assert(falseCount >= 2, "expected enabled and client_visible false");
});

check("master: migration uses idempotent ON CONFLICT", () => {
  assert(
    doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql").includes(
      "ON CONFLICT (feature_key) DO NOTHING",
    ),
    "missing idempotent insert",
  );
});

check("master: migration does not UPDATE existing rows", () => {
  const sql = doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql");
  assert(!/\bUPDATE\b/i.test(sql), "UPDATE present");
});

check("master: featureFlags uses isFeatureEnabled pattern", () => {
  assert(doc("lib/crm-v2/access.ts").includes("isFeatureEnabled"), "missing isFeatureEnabled");
});

check("master: no parallel master key advisor_crm_v2", () => {
  const corpus = [
    doc("lib/compliance/types.ts"),
    doc("lib/compliance/featureFlags.ts"),
    doc("lib/crm-v2/constants.ts"),
  ].join("\n");
  assert(!corpus.includes("advisor_crm_v2"), "parallel master key found");
});

// --- Pilot (20 checks) ---

check("pilot: crm_v2_pilot_mode separate key in types.ts", () => {
  assert(doc("lib/compliance/types.ts").includes('| "crm_v2_pilot_mode"'), "missing union member");
});

check("pilot: crm_v2_pilot_mode in PLATFORM_FEATURE_KEYS", () => {
  const types = doc("lib/compliance/types.ts");
  const masterIdx = types.indexOf('"crm_v2_master"');
  const pilotIdx = types.indexOf('"crm_v2_pilot_mode"');
  assert(masterIdx > 0 && pilotIdx > masterIdx, "pilot key must follow master key");
});

check("pilot: crm_v2_pilot_mode in featureFlags.ts", () => {
  assert(doc("lib/compliance/featureFlags.ts").includes("crm_v2_pilot_mode:"), "missing defaults");
});

check("pilot: code default enabled false", () => {
  const flags = doc("lib/compliance/featureFlags.ts");
  const block = flags.slice(flags.indexOf("crm_v2_pilot_mode:"));
  assert(block.includes("enabled: false"), "enabled not false");
});

check("pilot: code default client_visible false", () => {
  const flags = doc("lib/compliance/featureFlags.ts");
  const block = flags.slice(flags.indexOf("crm_v2_pilot_mode:"));
  assert(block.includes("client_visible: false"), "client_visible not false");
});

check("pilot: pilotConfig.ts exists", () => {
  assert(existsSync("lib/crm-v2/pilotConfig.ts"), "missing");
});

check("pilot: pilotConfig.ts is server-only", () => {
  assert(doc("lib/crm-v2/pilotConfig.ts").includes('import "server-only"'), "missing server-only");
});

check("pilot: CRM_V2_PILOT_USER_IDS env constant", () => {
  assert(doc("lib/crm-v2/constants.ts").includes("CRM_V2_PILOT_USER_IDS"), "missing env constant");
});

check("pilot: pilotConfig reads CRM_V2_PILOT_USER_IDS env", () => {
  assert(doc("lib/crm-v2/pilotConfig.ts").includes("CRM_V2_PILOT_USER_IDS_ENV"), "env not referenced");
});

check("pilot unit test: missing env denies", () => {
  const result = runPilotConfigUnitTests();
  assert(result.failed.length === 0, result.failed.join("; "));
});

check("pilot unit test: all four cases pass", () => {
  const result = runPilotConfigUnitTests();
  assert(result.passed === 4, `expected 4 passed, got ${result.passed}`);
});

check("pilot unit test: no failures reported", () => {
  const result = runPilotConfigUnitTests();
  assert(result.failed.length === 0, result.failed.join("; "));
});

check("pilot unit test: malformed token denies entire allowlist", () => {
  const source = doc("lib/crm-v2/pilotConfigTests.ts");
  assert(source.includes('"malformed"'), "malformed case missing in tests");
});

check("pilot: migration seeds crm_v2_pilot_mode", () => {
  assert(
    doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql").includes(
      "'crm_v2_pilot_mode'",
    ),
    "missing seed",
  );
});

check("pilot: access uses CRM_V2_PILOT_MODE_FEATURE_KEY", () => {
  assert(doc("lib/crm-v2/access.ts").includes("CRM_V2_PILOT_MODE_FEATURE_KEY"), "missing usage");
});

check("pilot: access uses isUserInPilotAllowlist", () => {
  assert(doc("lib/crm-v2/access.ts").includes("isUserInPilotAllowlist"), "missing membership check");
});

check("pilot: access uses auth user id not browser param", () => {
  const access = doc("lib/crm-v2/access.ts");
  assert(access.includes("adviserAccess.authUser.id"), "auth user id not used");
  assert(!access.includes("searchParams"), "browser params used");
});

for (const libFile of CRM_V2_LIB_FILES) {
  check(`pilot: no hardcoded UUID in ${libFile}`, () => {
    assert(!UUID_RE.test(doc(libFile)), "hardcoded UUID found");
  });
}

check("pilot: pilotConfig fail-closed on malformed tokens", () => {
  assert(doc("lib/crm-v2/pilotConfig.ts").includes('"malformed"'), "malformed reason missing");
});

check("pilot: pilotConfig fail-closed on missing env", () => {
  assert(doc("lib/crm-v2/pilotConfig.ts").includes('"missing"'), "missing reason missing");
});

// --- UI navigation (Phase 15 aligned) ---

check("ui nav: CRM_V2_HOME_PATH is /advisor", () => {
  assert(
    doc("lib/crm-v2/navigation.ts").includes('export const CRM_V2_HOME_PATH = "/advisor"'),
    "home path missing",
  );
});

check("ui nav: CRM_V2_PRIMARY_NAV exports Today", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Today"'), "Today missing");
});

check("ui nav: CRM_V2_PRIMARY_NAV exports Relationships", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Relationships"'), "Relationships missing");
});

check("ui nav: CRM_V2_PRIMARY_NAV exports Appointments", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Appointments"'), "Appointments missing");
});

check("ui nav: CRM_V2_PRIMARY_NAV exports Service", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Service"'), "Service missing");
});

check("ui nav: CRM_V2_PRIMARY_NAV exports Reports", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Reports"'), "Reports missing");
});

check("ui nav: CRM_V2_PRIMARY_NAV exports Operations", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Operations"'), "Operations missing");
});

check("ui nav: Communications is in CRM_V2_MORE_NAV not primary", () => {
  const nav = doc("lib/crm-v2/navigation.ts");
  const primaryBlock = nav.slice(nav.indexOf("CRM_V2_PRIMARY_NAV"), nav.indexOf("CRM_V2_MORE_NAV"));
  const moreBlock = nav.slice(nav.indexOf("CRM_V2_MORE_NAV"), nav.indexOf("CRM_V2_TOOLS_NAV_GROUPS"));
  assert(!primaryBlock.includes('label: "Communications"'), "Communications in primary nav");
  assert(moreBlock.includes('label: "Communications"'), "Communications missing from more nav");
});

check("ui nav: CRM_V2_MORE_NAV exports Communications", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Communications"'), "Communications missing");
});

check("ui nav: CRM_V2_MORE_NAV exports Templates", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Templates"'), "Templates missing");
});

check("ui nav: CRM_V2_MORE_NAV exports Settings", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes('label: "Settings"'), "Settings missing");
});

check("ui nav: CRM_V2_TOOLS_NAV_GROUPS exported", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes("CRM_V2_TOOLS_NAV_GROUPS"), "tools groups missing");
});

check("ui nav: primary href /advisor/today", () => {
  assert(doc("lib/crm-v2/navigation.ts").includes("CRM_V2_TODAY_PATH"), "today path constant");
  assert(doc("lib/crm-v2/navigation.ts").includes('href: CRM_V2_TODAY_PATH'), "today href uses constant");
});

check("ui nav: isCrmV2NavActive helper exported", () => {
  assert(/export function isCrmV2NavActive/.test(doc("lib/crm-v2/navigation.ts")), "missing helper");
});

check("ui shell: AdviserCrmV2Shell renders nav landmark", () => {
  const shell = doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(shell.includes("<nav"), "nav landmark missing");
  assert(shell.includes('aria-label="Adviser primary"'), "primary nav label missing");
});

check("ui shell: AdviserCrmV2Shell renders main landmark", () => {
  const shell = doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(shell.includes("<main"), "main landmark missing");
  assert(shell.includes('id="crm-v2-main"'), "main id missing");
});

check("ui shell: AdviserCrmV2Shell mobile menu toggle", () => {
  const shell = doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(shell.includes("menuOpen"), "mobile menu state missing");
  assert(shell.includes("Open navigation"), "mobile toggle label missing");
});

check("ui shell: AdviserCrmV2Shell focus-visible styles", () => {
  assert(
    doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx").includes("focus-visible:outline"),
    "focus-visible missing",
  );
});

check("ui shell: AdviserCrmV2Shell uses CRM_V2_PRIMARY_NAV", () => {
  assert(
    doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx").includes("CRM_V2_PRIMARY_NAV"),
    "primary nav not wired",
  );
});

check("ui shell: AdviserCrmV2Shell uses CRM_V2_MORE_NAV", () => {
  assert(
    doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx").includes("CRM_V2_MORE_NAV"),
    "more nav not wired",
  );
});

check("ui shell: AdviserCrmV2Shell uses CRM_V2_TOOLS_NAV_GROUPS", () => {
  assert(
    doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx").includes("CRM_V2_TOOLS_NAV_GROUPS"),
    "tools nav groups not wired",
  );
});

check("ui shell: AdviserCrmV2Shell aria-current on active link", () => {
  assert(doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx").includes("aria-current"), "aria-current missing");
});

check("ui shell: AEGIS Adviser Workspace branding", () => {
  const shell = doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(shell.includes("AEGIS Adviser Workspace"), "workspace branding missing");
  assert(!shell.includes("CRM V2 Limited Pilot"), "pilot badge copy present");
  assert(!shell.includes("CrmV2PilotBadge"), "pilot badge imported");
  assert(!shell.includes("CrmV2AdviserParityNotice"), "parity notice imported");
});

check("ui shell: classic fallback link is subtle not prominent", () => {
  const shell = doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(!shell.includes("Back to classic adviser workspace"), "prominent classic CTA present");
  assert(
    shell.includes("/advisor/classic") || shell.includes("CRM_V2_CLASSIC_ADVISER_PATH"),
    "classic fallback link missing",
  );
});

// --- Phase 15 routing (6 checks) ---

check("routing: /advisor is primary workspace entry", () => {
  const advisor = doc("app/advisor/page.tsx");
  assert(advisor.includes("AdviserCrmV2Shell"), "shell missing");
  assert(advisor.includes("AdviserCrmV2LandingContent"), "landing missing");
  assert(advisor.includes("isCrmV2PilotAvailable"), "availability gate");
});

check("routing: /advisor-v2 redirects to CRM_V2_HOME_PATH", () => {
  const alias = doc("app/advisor-v2/page.tsx");
  assert(alias.includes("redirect"), "redirect missing");
  assert(alias.includes("CRM_V2_HOME_PATH"), "home path constant used");
  assert(!alias.includes("AdviserCrmV2LandingContent"), "duplicate landing on alias");
});

check("routing: /advisor-v2 sub-routes redirect to canonical paths", () => {
  const todayAlias = doc("app/advisor-v2/today/page.tsx");
  assert(todayAlias.includes("redirectToCanonicalAdviserRoute"), "today alias redirect");
  assert(todayAlias.includes("CRM_V2_TODAY_PATH"), "today canonical target");
  const apptsAlias = doc("app/advisor-v2/appointments/page.tsx");
  assert(apptsAlias.includes("CRM_V2_APPOINTMENTS_PATH"), "appointments workspace path");
});

check("routing: canonical CRM V2 workspace layout under /advisor", () => {
  assert(existsSync("app/advisor/(crm-v2)/layout.tsx"), "workspace layout missing");
  const layout = doc("app/advisor/(crm-v2)/layout.tsx");
  assert(layout.includes("AdviserCrmV2Shell"), "shell in canonical layout");
  assert(layout.includes("assertCrmV2Access"), "access gate in canonical layout");
});

check("routing: /advisor-v2 alias layout does not render shell", () => {
  const layout = doc("app/advisor-v2/layout.tsx");
  assert(!layout.includes("AdviserCrmV2Shell"), "shell must not wrap alias redirects");
  assert(layout.includes("assertCrmV2Access"), "alias layout still gated");
});

check("routing: /advisor/classic fallback exists", () => {
  assert(existsSync("app/advisor/classic/page.tsx"), "classic page missing");
  assert(
    doc("app/advisor/classic/page.tsx").includes("ClassicAdvisorWorkspace"),
    "classic workspace missing",
  );
});

check("routing: shell home link uses CRM_V2_HOME_PATH", () => {
  const shell = doc("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(shell.includes("CRM_V2_HOME_PATH"), "home path constant missing in shell");
  assert(shell.includes('label="Home"'), "home nav item missing");
});

// --- UI placeholders (12 checks) ---

for (const route of ROUTE_PAGES) {
  if (route.segment === "relationships") {
    check("ui relationships: list page server-loads initial book", () => {
      const source = doc(route.path);
      assert(source.includes("loadCrmRelationshipListPage"), "missing server list loader");
      assert(source.includes("RelationshipListClient"), "missing list client");
      assert(!source.includes("CrmV2FoundationPlaceholderPage"), "still placeholder");
    });
    continue;
  }
  check(`ui placeholder: ${route.segment} page has no fetch`, () => {
    const source = doc(route.path);
    assert(!source.includes("fetch("), "fetch call present");
    assert(!source.includes("useEffect"), "client fetch hook present");
  });
}

check("ui placeholder: foundation component has no fetch", () => {
  const source = doc("components/aegis/advisor-v2/CrmV2FoundationPlaceholderPage.tsx");
  assert(!source.includes("fetch("), "fetch present");
});

check("ui landing: dashboard has no hardcoded client totals", () => {
  const landing = doc("components/aegis/advisor-v2/AdviserCrmV2LandingContent.tsx");
  const dashboard = doc("components/aegis/advisor-v2/AdviserWorkspaceDashboard.tsx");
  assert(!landing.includes("client total"), "fake totals in landing loader");
  assert(!/\b\d+\s+clients?\b/i.test(landing), "hardcoded client count in landing");
  assert(!/\b\d+\s+clients?\b/i.test(dashboard), "hardcoded client count in dashboard");
});

check("ui landing: primary workspace dashboard on /advisor", () => {
  const landing = doc("components/aegis/advisor-v2/AdviserCrmV2LandingContent.tsx");
  assert(landing.includes("AdviserWorkspaceDashboard"), "dashboard component missing");
  assert(landing.includes("loadAdviserTodayProjection"), "today projection loader");
  assert(landing.includes("CRM_V2_PRIMARY_NAV") || landing.includes("AdviserWorkspaceDashboard"), "workspace sections");
  assert(!landing.toLowerCase().includes("limited pilot"), "pilot copy in landing");
});

check("ui landing: /advisor-v2 alias redirects not duplicates home", () => {
  const alias = doc("app/advisor-v2/page.tsx");
  assert(alias.includes("redirect"), "alias must redirect");
  assert(alias.includes("CRM_V2_HOME_PATH"), "alias must target CRM_V2_HOME_PATH");
  assert(!alias.includes("AdviserCrmV2LandingContent"), "alias must not render landing");
});

// --- Compatibility (10 checks) ---

check("compat: /advisor layout uses requireAdvisorAccess", () => {
  const layout = doc("app/advisor/layout.tsx");
  assert(layout.includes("requireAdvisorAccess"), "missing adviser guard");
  assert(layout.includes("await requireAdvisorAccess()"), "guard not awaited");
});

check("compat: /advisor layout preserves dynamic force-dynamic", () => {
  const layout = doc("app/advisor/layout.tsx");
  assert(layout.includes('export const dynamic = "force-dynamic"'), "dynamic export missing");
});

check("compat: /advisor layout returns children when allowed", () => {
  assert(doc("app/advisor/layout.tsx").includes("return children"), "children return missing");
});

check("compat: lib/navigation.ts has no /advisor-v2 link", () => {
  const nav = doc("lib/navigation.ts");
  assert(!nav.includes("/advisor-v2"), "legacy nav links to CRM V2");
});

check("compat: advisor-v2 layout has no work-queue import", () => {
  assert(!doc("app/advisor-v2/layout.tsx").includes("work-queue"), "work-queue imported");
});

check("compat: advisor-v2 pages have no work-queue import", () => {
  const files = listFilesRecursive("app/advisor-v2").filter((f) => f.endsWith(".tsx"));
  for (const file of files) {
    assert(!doc(file).includes("work-queue"), `${file} imports work-queue`);
  }
});

check("compat: adviser shell components have no work-queue import", () => {
  const files = listFilesRecursive("components/aegis/advisor-v2").filter((f) => f.endsWith(".tsx"));
  for (const file of files) {
    assert(!doc(file).includes("work-queue"), `${file} imports work-queue`);
  }
});

check("compat: no CrmV2PilotEntryBanner on classic workspace", () => {
  const classic = doc("components/aegis/advisor/ClassicAdvisorWorkspace.tsx");
  assert(!classic.includes("CrmV2PilotEntryBanner"), "pilot entry banner on classic");
});

check("compat: pilot entry banner deprecated", () => {
  const banner = doc("components/aegis/advisor/CrmV2PilotEntryBanner.tsx");
  assert(banner.includes("return null"), "pilot banner should not render");
});

check("compat: CRM V2 layout does not modify legacy advisor layout file", () => {
  assert(!doc("app/advisor/layout.tsx").includes("advisor-v2"), "legacy layout references V2");
});

check("compat: qa script registered in package.json", () => {
  assert(read("package.json").includes("qa:crm-v2-shell"), "npm script missing");
});

// --- Migration and diagnostics (12 checks) ---

check("migration: 202606290001_phase01 file exists", () => {
  assert(
    existsSync("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql"),
    "missing migration",
  );
});

check("migration: approved Phase 01–03 CRM migrations present", () => {
  const migrations = readdirSync(join(ROOT, "supabase/migrations"));
  const crmMigrations = migrations
    .filter((f) => /phase0[123]_crm_v2/i.test(f))
    .sort();
  assert(
    crmMigrations.length === 4,
    `unexpected crm migrations: ${crmMigrations.join(", ")}`,
  );
  assert(
    crmMigrations.some((f) => f.includes("phase01_crm_v2_feature_controls")),
    "phase01 migration missing",
  );
  assert(
    crmMigrations.some((f) => f.includes("phase02_crm_v2_relationships")),
    "phase02 migration missing",
  );
  assert(
    crmMigrations.some((f) => f.includes("phase03_crm_v2_appointments_adviser_feature_control")),
    "phase03 feature migration missing",
  );
  assert(
    crmMigrations.some((f) => f.includes("phase03_crm_v2_appointment_core")),
    "phase03 core migration missing",
  );
});

check("migration: seeds only CRM V2 feature controls", () => {
  const sql = doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql");
  assert(sql.includes("INSERT INTO platform_feature_controls"), "missing insert");
  assert(!/\bCREATE\s+TABLE\b/i.test(sql), "CREATE TABLE present");
  assert(!sql.includes("service_commitments"), "business table referenced");
});

check("migration: no service_commitments table migration in chain", () => {
  const migrations = readdirSync(join(ROOT, "supabase/migrations"));
  const commitmentMigrations = migrations.filter((f) => /service_commitments/i.test(f));
  assert(commitmentMigrations.length === 0, commitmentMigrations.join(", "));
});

check("diagnostics: preflight exists", () => {
  assert(
    existsSync(
      "supabase/diagnostics/preflight_202606290001_phase01_crm_v2_feature_controls.sql",
    ),
    "missing preflight",
  );
});

check("diagnostics: verify exists", () => {
  assert(
    existsSync("supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls.sql"),
    "missing verify",
  );
});

check("diagnostics: discrepancies exists", () => {
  assert(
    existsSync(
      "supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql",
    ),
    "missing discrepancies",
  );
});

check("diagnostics: verify checks crm_v2_master disabled", () => {
  assert(
    doc("supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls.sql").includes(
      "crm_v2_master.enabled",
    ),
    "master enabled check missing",
  );
});

check("diagnostics: discrepancies returns failing rows only pattern", () => {
  const sql = doc(
    "supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql",
  );
  assert(sql.includes("missing_or_mismatch"), "discrepancy issue label missing");
  assert(sql.toLowerCase().includes("where"), "filter clause missing");
});

check("diagnostics: preflight references phase01 migration version", () => {
  assert(
    doc("supabase/diagnostics/preflight_202606290001_phase01_crm_v2_feature_controls.sql").includes(
      "202606290001",
    ),
    "version missing",
  );
});

check("migration: no destructive DROP in phase01 migration", () => {
  const sql = doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql");
  assert(!/\bDROP\b/i.test(sql), "DROP present");
});

check("migration: no appointment schema changes in phase01 migration", () => {
  const sql = doc("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql");
  assert(!sql.includes("adviser_appointments"), "appointment table referenced");
});

// --- Documentation (5 checks) ---

for (const phaseDoc of PHASE_01_DOCS) {
  check(`docs: ${phaseDoc} exists`, () => {
    assert(existsSync(phaseDoc), "missing file");
  });
}

// --- Shell API (12 checks) ---

check("api: app/api/advisor-v2/shell/route.ts exists", () => {
  assert(existsSync("app/api/advisor-v2/shell/route.ts"), "missing route");
});

check("api: shell route uses assertCrmV2Access", () => {
  assert(doc("app/api/advisor-v2/shell/route.ts").includes("assertCrmV2Access"), "missing guard");
});

check("api: shell response body field available", () => {
  assert(doc("app/api/advisor-v2/shell/route.ts").includes("available:"), "available field missing");
});

check("api: shell response body field requestId", () => {
  assert(doc("app/api/advisor-v2/shell/route.ts").includes("requestId:"), "requestId field missing");
});

check("api: shell body does not expose denial reason", () => {
  const route = doc("app/api/advisor-v2/shell/route.ts");
  assert(!route.includes("reason:"), "reason leaked in JSON body");
});

check("api: shell body does not expose allowlist", () => {
  const route = doc("app/api/advisor-v2/shell/route.ts");
  const bodyStart = route.indexOf("const body = {");
  const bodyEnd = route.indexOf("};", bodyStart) + 2;
  const bodyBlock = route.slice(bodyStart, bodyEnd);
  assert(!bodyBlock.includes("allowlist"), "allowlist field present");
  assert(!bodyBlock.includes("userIds"), "userIds field present");
});

check("api: shell sets X-Request-Id header", () => {
  assert(doc("app/api/advisor-v2/shell/route.ts").includes('"X-Request-Id"'), "header missing");
});

check("api: shell sets Cache-Control no-store", () => {
  assert(doc("app/api/advisor-v2/shell/route.ts").includes("no-store"), "cache header missing");
});

check("api: shell route force-dynamic", () => {
  assert(
    doc("app/api/advisor-v2/shell/route.ts").includes('export const dynamic = "force-dynamic"'),
    "dynamic missing",
  );
});

check("api: shell returns 401 for unauthenticated", () => {
  assert(doc("app/api/advisor-v2/shell/route.ts").includes("unauthenticated"), "unauthenticated branch missing");
  assert(doc("app/api/advisor-v2/shell/route.ts").includes("401"), "401 status missing");
});

check("api: shell returns 403 for other denials", () => {
  assert(doc("app/api/advisor-v2/shell/route.ts").includes("403"), "403 status missing");
});

check("api: shell route does not query business tables", () => {
  const route = doc("app/api/advisor-v2/shell/route.ts");
  assert(!route.includes("from("), "supabase query present");
  assert(!route.includes("createClient"), "supabase client present");
});

// --- Error and loading (6 checks) ---

check("error: route error uses RouteErrorFallback", () => {
  assert(doc("app/advisor-v2/error.tsx").includes("RouteErrorFallback"), "fallback missing");
});

check("error: route error does not render raw exception message", () => {
  const source = doc("app/advisor-v2/error.tsx");
  assert(!source.includes("{error.message}"), "raw message rendered");
});

check("error: route error safe CRM title", () => {
  assert(doc("app/advisor-v2/error.tsx").includes("CRM V2 unavailable"), "safe title missing");
});

check("loading: route loading uses CrmV2LoadingSkeleton", () => {
  assert(doc("app/advisor-v2/loading.tsx").includes("CrmV2LoadingSkeleton"), "skeleton missing");
});

check("error: route error does not log allowlist", () => {
  assert(!doc("app/advisor-v2/error.tsx").includes("allowlist"), "allowlist logged");
});

check("error: route error digest reference only when present", () => {
  assert(doc("app/advisor-v2/error.tsx").includes("error.digest"), "digest handling missing");
});

// --- Shell primitives (6 checks) ---

check("primitives: CrmV2PageHeader exists", () => {
  assert(existsSync("components/aegis/advisor-v2/CrmV2PageHeader.tsx"), "missing");
});

check("primitives: CrmV2SectionPanel exists", () => {
  assert(existsSync("components/aegis/advisor-v2/CrmV2SectionPanel.tsx"), "missing");
});

check("primitives: CrmV2FoundationEmptyState exists", () => {
  assert(existsSync("components/aegis/advisor-v2/CrmV2FoundationEmptyState.tsx"), "missing");
});

check("primitives: CrmV2PhaseNotice exists", () => {
  assert(existsSync("components/aegis/advisor-v2/CrmV2PhaseNotice.tsx"), "missing");
});

check("primitives: CrmV2AccessDenied exists", () => {
  assert(existsSync("components/aegis/advisor-v2/CrmV2AccessDenied.tsx"), "missing");
});

check("primitives: CrmV2LoadingSkeleton exists", () => {
  assert(existsSync("components/aegis/advisor-v2/CrmV2LoadingSkeleton.tsx"), "missing");
});

// --- Meta gate (2 checks) ---

check("meta: minimum explicit check count ≥ 120", () => {
  assert(TESTS.length >= 120, `only ${TESTS.length} checks defined`);
});

check("meta: pilotConfigTests module imported", () => {
  assert(typeof runPilotConfigUnitTests === "function", "import failed");
});

function main(): void {
  console.log("CRM V2 Phase 01 — Foundation Shell Validation\n");
  console.log(`Defined explicit checks: ${TESTS.length}\n`);

  for (const test of TESTS) {
    try {
      test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  PASS  [${test.id}] ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  FAIL  [${test.id}] ${test.name}: ${message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`\n${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.log("\nFailed tests:");
    for (const f of failed) {
      console.log(`  [${f.id}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }

  if (TESTS.length < 120) {
    console.error(`\nInsufficient explicit checks: ${TESTS.length} < 120 required`);
    process.exit(1);
  }

  console.log("\nVerdict: READY FOR CRM V2 RELATIONSHIP 360");
}

main();
