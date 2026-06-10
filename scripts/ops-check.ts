/**
 * Operations readiness check — docs, health routes, env names, ops utilities.
 * Does not require credentials and does not print secret values.
 *
 * Run: npm run ops:check
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const REQUIRED_DOCS = [
  "docs/OPERATIONS_RUNBOOK.md",
  "docs/MONITORING_AND_LOGGING.md",
  "docs/BACKUP_AND_RECOVERY.md",
  "docs/INCIDENT_RESPONSE.md",
  "docs/AUDIT_LOG_REVIEW.md",
  "docs/PRODUCTION_READINESS_CHECKLIST.md",
  "docs/DEPLOYMENT_CHECKLIST.md",
] as const;

const REQUIRED_OPS_FILES = [
  "lib/ops/logger.ts",
  "lib/ops/errorReporting.ts",
  "lib/ops/health.ts",
  "app/api/health/app/route.ts",
  "app/api/health/supabase/route.ts",
  "scripts/ops-check.ts",
] as const;

const REQUIRED_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const HEALTH_ENDPOINTS = [
  { path: "/api/health/app", file: "app/api/health/app/route.ts" },
  { path: "/api/health/supabase", file: "app/api/health/supabase/route.ts" },
] as const;

type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
};

function checkFiles(relativePaths: readonly string[], label: string): CheckResult {
  const missing = relativePaths.filter((path) => !existsSync(resolve(ROOT, path)));

  if (missing.length === 0) {
    return {
      name: label,
      pass: true,
      detail: `All ${relativePaths.length} paths present`,
    };
  }

  return {
    name: label,
    pass: false,
    detail: `Missing: ${missing.join(", ")}`,
  };
}

function checkHealthRoutesDocumented(): CheckResult {
  const monitoringDoc = resolve(ROOT, "docs/MONITORING_AND_LOGGING.md");
  const runbookDoc = resolve(ROOT, "docs/OPERATIONS_RUNBOOK.md");

  if (!existsSync(monitoringDoc) || !existsSync(runbookDoc)) {
    return {
      name: "Health endpoints documented",
      pass: false,
      detail: "Monitoring or runbook doc missing",
    };
  }

  const monitoring = readFileSync(monitoringDoc, "utf8");
  const runbook = readFileSync(runbookDoc, "utf8");
  const combined = `${monitoring}\n${runbook}`;

  const undocumented = HEALTH_ENDPOINTS.filter(
    ({ path }) => !combined.includes(path),
  );

  if (undocumented.length === 0) {
    return {
      name: "Health endpoints documented",
      pass: true,
      detail: "Both /api/health/app and /api/health/supabase referenced in ops docs",
    };
  }

  return {
    name: "Health endpoints documented",
    pass: false,
    detail: `Not documented: ${undocumented.map((item) => item.path).join(", ")}`,
  };
}

function checkEnvExample(): CheckResult {
  const envExamplePath = resolve(ROOT, ".env.example");
  if (!existsSync(envExamplePath)) {
    return {
      name: "Required env names documented",
      pass: false,
      detail: ".env.example missing",
    };
  }

  const content = readFileSync(envExamplePath, "utf8");
  const missing = REQUIRED_ENV_NAMES.filter((name) => !content.includes(name));

  if (missing.length === 0) {
    return {
      name: "Required env names documented",
      pass: true,
      detail: `All ${REQUIRED_ENV_NAMES.length} required names found in .env.example`,
    };
  }

  return {
    name: "Required env names documented",
    pass: false,
    detail: `Missing from .env.example: ${missing.join(", ")}`,
  };
}

function checkPackageScript(): CheckResult {
  const packagePath = resolve(ROOT, "package.json");
  if (!existsSync(packagePath)) {
    return {
      name: "npm script ops:check",
      pass: false,
      detail: "package.json missing",
    };
  }

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  if (pkg.scripts?.["ops:check"]) {
    return {
      name: "npm script ops:check",
      pass: true,
      detail: "ops:check script configured",
    };
  }

  return {
    name: "npm script ops:check",
    pass: false,
    detail: "Add ops:check to package.json scripts",
  };
}

function checkHealthRouteFiles(): CheckResult {
  const missingHandlers = HEALTH_ENDPOINTS.filter(({ file }) => {
    const fullPath = resolve(ROOT, file);
    if (!existsSync(fullPath)) {
      return true;
    }

    const source = readFileSync(fullPath, "utf8");
    return !source.includes("export async function GET");
  });

  if (missingHandlers.length === 0) {
    return {
      name: "Health route handlers",
      pass: true,
      detail: "GET handlers present for app and supabase health routes",
    };
  }

  return {
    name: "Health route handlers",
    pass: false,
    detail: `Review handlers: ${missingHandlers.map((item) => item.path).join(", ")}`,
  };
}

function main(): void {
  console.log("Aegis Wealth OS — operations readiness check\n");

  const checks: CheckResult[] = [
    checkFiles(REQUIRED_DOCS, "Operations documentation"),
    checkFiles(REQUIRED_OPS_FILES, "Ops utilities and health routes"),
    checkHealthRouteFiles(),
    checkHealthRoutesDocumented(),
    checkEnvExample(),
    checkPackageScript(),
  ];

  let failed = 0;

  for (const check of checks) {
    const icon = check.pass ? "OK  " : "FAIL";
    console.log(`  ${icon}  ${check.name}`);
    console.log(`        ${check.detail}`);
    if (!check.pass) {
      failed += 1;
    }
  }

  console.log("");

  if (failed === 0) {
    console.log("All operations checks passed.");
    process.exit(0);
  }

  console.log(`${failed} check(s) failed. Review items above before production.`);
  process.exit(1);
}

main();
