/**
 * Phase 4X security audit runner — service-role scan, API auth scan, route inventory.
 * Does not require credentials and does not print secrets.
 *
 * Run: npm run security:audit
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const AUDIT_DOCS = [
  "docs/SECURITY_AUDIT_REPORT.md",
  "docs/RLS_POLICY_REVIEW.md",
  "docs/STORAGE_POLICY_REVIEW.md",
  "docs/SERVICE_ROLE_USAGE_REVIEW.md",
  "docs/API_SECURITY_REVIEW.md",
  "docs/ADVISOR_ADMIN_ACCESS_REVIEW.md",
] as const;

function runScript(scriptName: string): number {
  const scriptPath = resolve(ROOT, "scripts", scriptName);
  console.log(`\n${"=".repeat(72)}`);
  console.log(`Running ${scriptName}`);
  console.log("=".repeat(72));

  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(npx, ["tsx", scriptPath], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  return result.status ?? 1;
}

function checkAuditDocs(): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log("Audit documentation");
  console.log("=".repeat(72));

  const missing = AUDIT_DOCS.filter((doc) => !existsSync(resolve(ROOT, doc)));

  if (missing.length === 0) {
    console.log(`  OK   All ${AUDIT_DOCS.length} Phase 4X audit docs present`);
  } else {
    console.log("  WARN Missing audit docs:");
    for (const doc of missing) {
      console.log(`       ${doc}`);
    }
  }
}

function printSummary(): void {
  const inventoryPath = resolve(ROOT, "docs/API_ROUTE_INVENTORY.md");
  if (existsSync(inventoryPath)) {
    const content = readFileSync(inventoryPath, "utf8");
    const match = content.match(/\*\*Total routes:\*\*\s*(\d+)/);
    if (match) {
      console.log(`\nRoute inventory reference: ${match[1]} handlers (docs/API_ROUTE_INVENTORY.md)`);
    }
  }

  console.log("\nPhase 4X commands:");
  console.log("  npm run security:service-role");
  console.log("  npm run security:api");
  console.log("  npm run security:audit");
  console.log("\nPrimary report: docs/SECURITY_AUDIT_REPORT.md");
}

function main(): void {
  console.log("Aegis Wealth OS — Phase 4X Security Audit\n");

  const serviceRoleExit = runScript("check-service-role-imports.ts");
  const apiExit = runScript("check-api-auth-patterns.ts");

  checkAuditDocs();
  printSummary();

  if (serviceRoleExit !== 0 || apiExit !== 0) {
    console.log("\nAudit finished with findings — review docs/SECURITY_AUDIT_REPORT.md");
    process.exitCode = 1;
    return;
  }

  console.log("\nAutomated checks passed — still complete manual review in audit docs.");
}

main();
