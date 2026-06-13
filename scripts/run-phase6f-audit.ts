/**
 * Phase 6F audit runner — static checks, security scripts, performance artifacts.
 * Does not print secret values.
 *
 * Run: npm run qa:phase6f
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Phase 6F audit failed: ${message}`);
  }
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function runNpmScript(script: string): number {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`Running npm run ${script}`);
  console.log("=".repeat(72));

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["run", script], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  return result.status ?? 1;
}

function checkPhase6fArtifacts(): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log("Phase 6F artifact checks");
  console.log("=".repeat(72));

  const required = [
    "docs/PHASE_6F_AUDIT_REPORT.md",
    "lib/server/fetchWithTimeout.ts",
    "supabase/migrations/202606100021_phase6f_performance_indexes.sql",
    "app/error.tsx",
    "app/advisor/error.tsx",
    "app/my-adviser/error.tsx",
    "components/aegis/RouteErrorFallback.tsx",
    "app/api/advisor/clients/[clientId]/command-center/heavy/route.ts",
  ];

  for (const path of required) {
    assert(existsSync(join(ROOT, path)), `missing ${path}`);
    console.log(`  OK   ${path}`);
  }

  assert(
    !existsSync(join(ROOT, "components/aegis/ShieldRadarChart.tsx")),
    "dead ShieldRadarChart should be removed",
  );
  console.log("  OK   ShieldRadarChart removed");

  const pkg = read("package.json");
  assert(!pkg.includes('"recharts"'), "recharts dependency should be removed");
  console.log("  OK   recharts removed from package.json");

  const calendarClient = read("lib/google/calendarClient.ts");
  assert(
    calendarClient.includes("fetchWithTimeout"),
    "Google calendar client should use fetchWithTimeout",
  );
  console.log("  OK   Google Calendar fetch timeouts");

  const dashboard = read("components/aegis/DashboardClient.tsx");
  assert(
    dashboard.includes("dynamic(") &&
      dashboard.includes("ShieldArchitectureModule"),
    "dashboard should lazy-load ShieldArchitectureModule",
  );
  console.log("  OK   dashboard lazy-loads shield architecture");

  const workspace = read("components/aegis/advisor/AdvisorClientWorkspace.tsx");
  assert(
    workspace.includes("command-center/heavy"),
    "client workspace should defer heavy panels",
  );
  console.log("  OK   client workspace staged command-center load");

  const migration = read(
    "supabase/migrations/202606100021_phase6f_performance_indexes.sql",
  );
  assert(
    migration.includes("idx_adviser_feedback_client_created"),
    "feedback index migration missing",
  );
  assert(
    migration.includes("idx_clients_advisor_display_name"),
    "clients list index migration missing",
  );
  console.log("  OK   performance index migration");
}

function checkPerformanceBudgets(): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log("Performance budget reference (regression guards)");
  console.log("=".repeat(72));

  const budgets = [
    ["Production build (wall clock)", "< 60s on dev machine"],
    ["Dashboard shield module", "lazy-loaded (not in initial JS)"],
    ["My Clients list page size", "20 rows per page"],
    ["Client command-center shell", "workspace + review only"],
    ["Google API timeout", "15s default"],
    ["Largest removed dependency", "recharts (~300KB+ saved)"],
  ];

  for (const [label, budget] of budgets) {
    console.log(`  ${label}: ${budget}`);
  }

  const baselinePath = join(ROOT, ".phase6f-baseline-build.log");
  const afterPath = join(ROOT, ".phase6f-after-build.log");

  if (existsSync(baselinePath)) {
    console.log(`\n  Baseline log: .phase6f-baseline-build.log`);
  } else {
    console.log("\n  WARN No baseline build log found");
  }

  if (existsSync(afterPath)) {
    console.log("  After log:    .phase6f-after-build.log");
  }
}

function main(): void {
  console.log("AEGIS Wealth OS — Phase 6F Audit\n");

  checkPhase6fArtifacts();
  checkPerformanceBudgets();

  const scripts = [
    "security:service-role",
    "security:api",
    "security:advisor-access",
    "qa:my-adviser",
    "qa:calendar",
    "qa:my-clients",
  ];

  let failed = 0;

  for (const script of scripts) {
    const code = runNpmScript(script);
    if (code !== 0) {
      failed += 1;
    }
  }

  console.log(`\n${"=".repeat(72)}`);
  if (failed === 0) {
    console.log("Phase 6F audit checks passed.");
    console.log("Primary report: docs/PHASE_6F_AUDIT_REPORT.md");
    console.log("=".repeat(72));
    process.exit(0);
  }

  console.log(`Phase 6F audit completed with ${failed} failing script(s).`);
  console.log("=".repeat(72));
  process.exit(1);
}

main();
