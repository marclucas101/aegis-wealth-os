/**
 * CRM V2 Phase 17 — Adviser workspace burn-in regression validation.
 * Run: npm run qa:adviser-workspace-regression
 *
 * Validates canonical /advisor routes, /advisor-v2 compatibility redirects,
 * legacy tool preservation, client portal safety freeze, and shell polish.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];
const TESTS: TestCase[] = [];
let nextId = 1;

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const CANONICAL_ROUTES = [
  { path: "app/advisor/page.tsx", url: "/advisor", label: "home" },
  { path: "app/advisor/(crm-v2)/today/page.tsx", url: "/advisor/today", label: "today" },
  {
    path: "app/advisor/(crm-v2)/relationships/page.tsx",
    url: "/advisor/relationships",
    label: "relationships",
  },
  {
    path: "app/advisor/(crm-v2)/workspace/appointments/page.tsx",
    url: "/advisor/workspace/appointments",
    label: "workspace appointments",
  },
  { path: "app/advisor/(crm-v2)/service/page.tsx", url: "/advisor/service", label: "service" },
  { path: "app/advisor/(crm-v2)/reports/page.tsx", url: "/advisor/reports", label: "reports" },
  {
    path: "app/advisor/(crm-v2)/operations/page.tsx",
    url: "/advisor/operations",
    label: "operations",
  },
  {
    path: "app/advisor/(crm-v2)/communications/page.tsx",
    url: "/advisor/communications",
    label: "communications",
  },
  {
    path: "app/advisor/(crm-v2)/templates/page.tsx",
    url: "/advisor/templates",
    label: "templates",
  },
  {
    path: "app/advisor/(crm-v2)/settings/page.tsx",
    url: "/advisor/settings",
    label: "settings",
  },
  { path: "app/advisor/classic/page.tsx", url: "/advisor/classic", label: "classic fallback" },
] as const;

const LEGACY_ADVISER_ROUTES = [
  { path: "app/advisor/protection-report/page.tsx", url: "/advisor/protection-report" },
  { path: "app/advisor/feedback/page.tsx", url: "/advisor/feedback" },
  { path: "app/advisor/my-profile/page.tsx", url: "/advisor/my-profile" },
  { path: "app/advisor/appointments/page.tsx", url: "/advisor/appointments" },
  { path: "app/advisor/clients/page.tsx", url: "/advisor/clients" },
] as const;

const CLIENT_PORTAL_ROUTES = [
  { path: "app/appointments/page.tsx", url: "/appointments" },
  { path: "app/appointments/request/page.tsx", url: "/appointments/request" },
  { path: "app/actions/page.tsx", url: "/actions" },
  { path: "app/requests/page.tsx", url: "/requests" },
  { path: "app/protection/page.tsx", url: "/protection" },
  { path: "app/preferences/page.tsx", url: "/preferences" },
  { path: "app/preferences/advocacy/page.tsx", url: "/preferences/advocacy" },
  { path: "app/messages/page.tsx", url: "/messages" },
] as const;

const ALIAS_REDIRECTS = [
  {
    alias: "app/advisor-v2/page.tsx",
    target: "CRM_V2_HOME_PATH",
    canonical: "/advisor",
  },
  {
    alias: "app/advisor-v2/today/page.tsx",
    target: "CRM_V2_TODAY_PATH",
    canonical: "/advisor/today",
  },
  {
    alias: "app/advisor-v2/relationships/page.tsx",
    target: "CRM_V2_RELATIONSHIPS_PATH",
    canonical: "/advisor/relationships",
  },
  {
    alias: "app/advisor-v2/appointments/page.tsx",
    target: "CRM_V2_APPOINTMENTS_PATH",
    canonical: "/advisor/workspace/appointments",
  },
  {
    alias: "app/advisor-v2/service/page.tsx",
    target: "CRM_V2_SERVICE_PATH",
    canonical: "/advisor/service",
  },
  {
    alias: "app/advisor-v2/reports/page.tsx",
    target: "CRM_V2_REPORTS_PATH",
    canonical: "/advisor/reports",
  },
  {
    alias: "app/advisor-v2/operations/page.tsx",
    target: "CRM_V2_OPERATIONS_PATH",
    canonical: "/advisor/operations",
  },
] as const;

const ADVISER_CONSOLIDATION_PATHS = [
  "app/advisor/page.tsx",
  "app/advisor/(crm-v2)/layout.tsx",
  "lib/crm-v2/navigation.ts",
  "lib/crm-v2/aliasRedirects.ts",
  "components/aegis/advisor-v2/AdviserCrmV2Shell.tsx",
  "components/aegis/advisor-v2/AdviserWorkspaceDashboard.tsx",
] as const;

const PILOT_UI_PATTERNS = [
  "CRM V2 Limited Pilot",
  "CrmV2PilotBadge",
  "CrmV2AdviserParityNotice",
  "CrmV2PilotEntryBanner",
  "limited pilot",
  "pilot mode",
] as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function check(name: string, fn: () => void): void {
  TESTS.push({ id: nextId++, name, run: fn });
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

// --- Canonical adviser routes ---

for (const route of CANONICAL_ROUTES) {
  check(`canonical route exists: ${route.url}`, () => {
    assert(existsSync(route.path), `missing ${route.path}`);
  });
}

check("canonical: CRM_V2_HOME_PATH is /advisor", () => {
  assert(
    read("lib/crm-v2/navigation.ts").includes('export const CRM_V2_HOME_PATH = "/advisor"'),
    "home path not canonical",
  );
});

check("canonical: workspace layout uses assertCrmV2Access and shell", () => {
  const layout = read("app/advisor/(crm-v2)/layout.tsx");
  assert(layout.includes("assertCrmV2Access"), "access gate missing");
  assert(layout.includes("AdviserCrmV2Shell"), "shell missing");
});

check("canonical: /advisor landing renders workspace dashboard", () => {
  const page = read("app/advisor/page.tsx");
  assert(page.includes("AdviserCrmV2Shell"), "shell missing on /advisor");
  assert(page.includes("AdviserCrmV2LandingContent"), "landing missing on /advisor");
});

// --- Legacy adviser routes preserved ---

for (const route of LEGACY_ADVISER_ROUTES) {
  check(`legacy route preserved: ${route.url}`, () => {
    assert(existsSync(route.path), `missing ${route.path}`);
  });
}

check("legacy: protection report generator route intact", () => {
  const page = read("app/advisor/protection-report/page.tsx");
  assert(!page.includes("redirect("), "protection report should not redirect away");
});

check("legacy: classic workspace not promoted in primary nav", () => {
  const primaryBlock = read("lib/crm-v2/navigation.ts").slice(
    read("lib/crm-v2/navigation.ts").indexOf("CRM_V2_PRIMARY_NAV"),
    read("lib/crm-v2/navigation.ts").indexOf("CRM_V2_MORE_NAV"),
  );
  assert(!primaryBlock.includes("/advisor/classic"), "classic in primary nav");
});

// --- /advisor-v2 compatibility redirects ---

for (const redirect of ALIAS_REDIRECTS) {
  check(`alias redirects: ${redirect.canonical}`, () => {
    const source = read(redirect.alias);
    assert(source.includes("redirect"), "redirect missing");
    assert(source.includes(redirect.target), `target ${redirect.target} missing`);
    assert(!source.includes("AdviserCrmV2Shell"), "alias must not render shell");
  });
}

check("alias: redirectToCanonicalAdviserRoute helper used for sub-routes", () => {
  const today = read("app/advisor-v2/today/page.tsx");
  assert(today.includes("redirectToCanonicalAdviserRoute"), "helper missing");
  assert(!today.includes('redirect("/advisor-v2'), "must not redirect to alias");
});

check("alias: no redirect loop — canonical pages do not redirect to /advisor-v2", () => {
  const crmPages = listFilesRecursive("app/advisor/(crm-v2)").filter((f) =>
    f.endsWith("page.tsx"),
  );
  for (const page of crmPages) {
    const source = read(page);
    assert(
      !source.includes('redirect("/advisor-v2') && !source.includes("redirect('/advisor-v2"),
      `${page} redirects back to alias`,
    );
  }
});

check("alias: /advisor-v2 layout does not render shell before redirect", () => {
  const layout = read("app/advisor-v2/layout.tsx");
  assert(!layout.includes("AdviserCrmV2Shell"), "shell wraps alias");
  assert(layout.includes("assertCrmV2Access"), "alias still gated");
});

// --- Navigation regression ---

check("nav: primary nav hrefs use /advisor not /advisor-v2", () => {
  const primaryBlock = read("lib/crm-v2/navigation.ts").slice(
    read("lib/crm-v2/navigation.ts").indexOf("CRM_V2_PRIMARY_NAV"),
    read("lib/crm-v2/navigation.ts").indexOf("CRM_V2_MORE_NAV"),
  );
  assert(!primaryBlock.includes('href: "/advisor-v2'), "primary nav links to alias");
  assert(primaryBlock.includes("CRM_V2_TODAY_PATH"), "today constant");
  assert(primaryBlock.includes("CRM_V2_APPOINTMENTS_PATH"), "appointments workspace path");
});

check("nav: Reports and Operations in primary nav", () => {
  const nav = read("lib/crm-v2/navigation.ts");
  const primaryBlock = nav.slice(nav.indexOf("CRM_V2_PRIMARY_NAV"), nav.indexOf("CRM_V2_MORE_NAV"));
  assert(primaryBlock.includes('label: "Reports"'), "Reports missing");
  assert(primaryBlock.includes('label: "Operations"'), "Operations missing");
  assert(primaryBlock.includes("CRM_V2_REPORTS_PATH"), "reports path");
  assert(primaryBlock.includes("CRM_V2_OPERATIONS_PATH"), "operations path");
});

check("nav: Communications under More / Workspace not primary", () => {
  const nav = read("lib/crm-v2/navigation.ts");
  const primaryBlock = nav.slice(nav.indexOf("CRM_V2_PRIMARY_NAV"), nav.indexOf("CRM_V2_MORE_NAV"));
  const moreBlock = nav.slice(nav.indexOf("CRM_V2_MORE_NAV"), nav.indexOf("CRM_V2_TOOLS_NAV_GROUPS"));
  assert(!primaryBlock.includes('label: "Communications"'), "Communications in primary");
  assert(moreBlock.includes('label: "Communications"'), "Communications missing from more");
});

check("nav: shell home link uses CRM_V2_HOME_PATH", () => {
  const shell = read("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(shell.includes("CRM_V2_HOME_PATH"), "home path constant");
  assert(!shell.includes('href="/advisor-v2"'), "visible alias home link");
});

check("nav: classic fallback reachable from shell footer", () => {
  const shell = read("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(
    shell.includes("CRM_V2_CLASSIC_ADVISER_PATH") || shell.includes("/advisor/classic"),
    "classic fallback link missing",
  );
  assert(shell.includes("Classic workspace (fallback)") || shell.includes("Classic fallback"), "classic label");
});

// --- Tools nav: legacy preservation and safe client entry ---

const REQUIRED_LEGACY_TOOL_HREFS = [
  "/advisor/protection-report",
  "/advisor/clients",
  "/advisor/insights",
  "/advisor/feedback",
  "/advisor/appointments",
  "/advisor/my-profile",
  "/advisor/classic",
] as const;

for (const href of REQUIRED_LEGACY_TOOL_HREFS) {
  check(`tools nav preserves: ${href}`, () => {
    assert(read("lib/crm-v2/navigation.ts").includes(href), `missing ${href} in navigation`);
  });
}

check("tools nav: client-context tools route to /advisor/clients roster", () => {
  const toolsBlock = read("lib/crm-v2/navigation.ts").slice(
    read("lib/crm-v2/navigation.ts").indexOf("CRM_V2_TOOLS_NAV_GROUPS"),
  );
  const clientContextLabels = [
    "Shield Diagnostic",
    "Stress Test",
    "Planning & Roadmap",
    "Client Binder",
    "Document Vault",
    "Meeting Studio",
  ];
  for (const label of clientContextLabels) {
    const labelIdx = toolsBlock.indexOf(`label: "${label}"`);
    assert(labelIdx >= 0, `${label} missing`);
    const snippet = toolsBlock.slice(labelIdx, labelIdx + 200);
    assert(snippet.includes('href: "/advisor/clients"'), `${label} must route to roster`);
  }
});

check("tools nav: no fake client IDs in navigation config", () => {
  const nav = read("lib/crm-v2/navigation.ts");
  assert(!UUID_RE.test(nav), "hardcoded UUID in navigation");
  assert(!nav.includes("/advisor/clients/"), "deep client ID links in nav config");
});

check("tools nav: Google Calendar Operations uses canonical path", () => {
  const nav = read("lib/crm-v2/navigation.ts");
  assert(nav.includes("CRM_V2_OPERATIONS_GOOGLE_CALENDAR_PATH"), "ops calendar path constant");
  assert(!nav.includes('href: "/advisor-v2/operations'), "alias path in tools nav");
});

// --- Shell polish: no pilot language or debug strings ---

check("shell: AEGIS Adviser Workspace branding", () => {
  const shell = read("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(shell.includes("AEGIS Adviser Workspace"), "branding missing");
});

for (const pattern of PILOT_UI_PATTERNS) {
  check(`shell: no pilot language "${pattern}"`, () => {
    const shell = read("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
    assert(!shell.toLowerCase().includes(pattern.toLowerCase()), `found: ${pattern}`);
  });
}

check("shell: dashboard has no pilot copy", () => {
  const dashboard = read("components/aegis/advisor-v2/AdviserWorkspaceDashboard.tsx");
  for (const pattern of PILOT_UI_PATTERNS) {
    assert(!dashboard.toLowerCase().includes(pattern.toLowerCase()), `found: ${pattern}`);
  }
});

check("shell: no CRM_V2_DEBUG strings in adviser workspace", () => {
  const adviserFiles = [
    ...listFilesRecursive("components/aegis/advisor-v2"),
    ...listFilesRecursive("app/advisor/(crm-v2)"),
    "app/advisor/page.tsx",
  ].filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));

  for (const file of adviserFiles) {
    const source = read(file);
    assert(!source.includes("CRM_V2_DEBUG"), `${file} contains CRM_V2_DEBUG`);
  }
});

check("shell: classic fallback referenced but not promoted as main workspace", () => {
  const shell = read("components/aegis/advisor-v2/AdviserCrmV2Shell.tsx");
  assert(!shell.includes("Back to classic adviser workspace"), "prominent classic CTA");
  assert(shell.includes("fallback"), "fallback framing missing");
});

// --- Client portal safety freeze ---

for (const route of CLIENT_PORTAL_ROUTES) {
  check(`client route exists (frozen): ${route.url}`, () => {
    assert(existsSync(route.path), `missing ${route.path}`);
  });
}

check("client safety: adviser consolidation does not import client portal pages", () => {
  for (const file of ADVISER_CONSOLIDATION_PATHS) {
    const source = read(file);
    for (const route of CLIENT_PORTAL_ROUTES) {
      const importPattern = route.path.replace("app/", "@/app/");
      assert(!source.includes(importPattern), `${file} imports ${route.url}`);
    }
    assert(!source.includes('href="/appointments"'), `${file} links to client /appointments`);
    assert(!source.includes('href="/actions"'), `${file} links to client /actions`);
    assert(!source.includes('href="/messages"'), `${file} links to client /messages`);
  }
});

check("client safety: navigation.ts has no client portal paths", () => {
  const nav = read("lib/crm-v2/navigation.ts");
  for (const route of CLIENT_PORTAL_ROUTES) {
    assert(!nav.includes(`"${route.url}"`), `client path ${route.url} in adviser nav`);
  }
});

// --- API prefix unchanged ---

check("api: /api/advisor-v2 prefix retained for CRM V2 APIs", () => {
  assert(existsSync("app/api/advisor-v2/shell/route.ts"), "shell API missing");
  assert(existsSync("app/api/advisor-v2/today/route.ts"), "today API missing");
});

check("api: legacy /api/advisor routes preserved", () => {
  const advisorApi = listFilesRecursive("app/api/advisor").filter((f) => f.endsWith("route.ts"));
  assert(advisorApi.length > 0, "no legacy adviser APIs");
});

// --- Phase 17 documentation ---

check("docs: Phase 17 burn-in runbook exists", () => {
  assert(existsSync("docs/CRM_V2_PHASE_17_ADVISER_BURN_IN_HARDENING.md"), "missing runbook");
});

check("docs: rollout index references Phase 17 burn-in", () => {
  const index = read("docs/CRM_V2_ROLLOUT_INDEX.md");
  assert(index.includes("Phase 17"), "Phase 17 missing");
  assert(index.includes("Burn-In") || index.includes("burn-in"), "burn-in missing");
});

check("package: qa:adviser-workspace-regression script registered", () => {
  assert(read("package.json").includes("qa:adviser-workspace-regression"), "npm script missing");
});

check("meta: minimum explicit check count >= 60", () => {
  assert(TESTS.length >= 60, `only ${TESTS.length} checks defined`);
});

function main(): void {
  console.log("CRM V2 Phase 17 — Adviser Workspace Regression\n");
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

  console.log("\nVerdict: READY FOR ADVISER-ONLY BURN-IN");
}

main();
