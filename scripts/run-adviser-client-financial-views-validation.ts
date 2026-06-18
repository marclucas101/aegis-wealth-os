import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Adviser client financial views validation failed: ${message}`);
  }
}

function main(): void {
  let passed = 0;

  const loaderPath = join(ROOT, "lib/supabase/advisorClientFinancialViews.ts");
  assert(existsSync(loaderPath), "adviser financial view loader missing");
  const loader = read(loaderPath);
  assert(
    loader.includes("resolveAccessibleClient"),
    "loader uses resolveAccessibleClient",
  );
  assert(
    loader.includes("loadDashboardSnapshot"),
    "dashboard loader reuses client scoring snapshot",
  );
  assert(
    loader.includes("loadShieldDiagnosticSnapshot"),
    "shield diagnostic loader reuses module snapshot",
  );
  assert(
    loader.includes("loadStressTestingSnapshot"),
    "stress tests loader reuses module snapshot",
  );
  passed += 1;

  const apiPaths = [
    "app/api/advisor/clients/[clientId]/dashboard/route.ts",
    "app/api/advisor/clients/[clientId]/shield-diagnostic/route.ts",
    "app/api/advisor/clients/[clientId]/stress-tests/route.ts",
  ] as const;

  for (const apiPath of apiPaths) {
    const fullPath = join(ROOT, apiPath);
    assert(existsSync(fullPath), `${apiPath} missing`);
    const source = read(fullPath);
    assert(source.includes("requireAdvisorAccess"), `${apiPath} gated`);
    assert(
      source.includes("loadAdvisorClient"),
      `${apiPath} uses adviser financial view loader`,
    );
    assert(source.includes("readOnly: true"), `${apiPath} marks read-only`);
    assert(!source.includes("export async function POST"), `${apiPath} is GET-only`);
    assert(!source.includes("export async function PATCH"), `${apiPath} is GET-only`);
  }
  passed += 1;

  const workspace = read(
    join(ROOT, "components/aegis/advisor/AdvisorClientWorkspace.tsx"),
  );
  assert(
    workspace.includes("AdvisorClientDashboardPanel"),
    "dashboard tab panel wired",
  );
  assert(
    workspace.includes("AdvisorClientShieldDiagnosticPanel"),
    "shield diagnostic tab panel wired",
  );
  assert(
    workspace.includes("AdvisorClientStressTestsPanel"),
    "stress test tab panel wired",
  );
  assert(
    workspace.includes('id: "dashboard"'),
    "dashboard tab label present",
  );
  assert(
    workspace.includes('id: "stress-test"'),
    "stress test tab label present",
  );
  passed += 1;

  const banner = read(
    join(ROOT, "components/aegis/advisor/AdvisorClientReadOnlyBanner.tsx"),
  );
  assert(
    banner.includes("Read-only client financial snapshot"),
    "read-only banner copy present",
  );
  passed += 1;

  const dashboardPanel = read(
    join(ROOT, "components/aegis/advisor/AdvisorClientDashboardPanel.tsx"),
  );
  const stressPanel = read(
    join(ROOT, "components/aegis/advisor/AdvisorClientStressTestsPanel.tsx"),
  );
  assert(
    dashboardPanel.includes("/api/advisor/clients/${clientId}/dashboard"),
    "dashboard panel lazy-loads adviser API",
  );
  assert(
    stressPanel.includes("Advisers cannot run new scenarios"),
    "stress panel is read-only for advisers",
  );
  assert(
    !stressPanel.includes("/api/stress-testing/run"),
    "stress panel does not call client run API",
  );
  passed += 1;

  console.log(
    `Adviser client financial views validations passed (${passed} assertion groups).`,
  );
}

main();
