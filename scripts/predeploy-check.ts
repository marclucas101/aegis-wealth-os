/**
 * Pre-deploy gate: env names, package scripts, and API route inventory.
 * Does not print secret values. Does not run build/typecheck (verifies they exist).
 *
 * Run: npx tsx scripts/predeploy-check.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const EXPECTED_SCRIPTS = ["build", "qa:env", "qa:routes", "qa:smoke"] as const;

type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
};

function loadDotEnvFile(filePath: string): Record<string, string> {
  const values: Record<string, string> = {};

  if (!existsSync(filePath)) {
    return values;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function resolveEnv(name: string, fileValues: Record<string, string>): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;

  const fromFile = fileValues[name]?.trim();
  if (fromFile) return fromFile;

  return "";
}

function checkRequiredEnv(fileValues: Record<string, string>): CheckResult {
  const missing = REQUIRED_VARS.filter(
    (name) => resolveEnv(name, fileValues).length === 0,
  );

  if (missing.length === 0) {
    return {
      name: "Required environment variables",
      pass: true,
      detail: `All ${REQUIRED_VARS.length} required variable names present`,
    };
  }

  return {
    name: "Required environment variables",
    pass: false,
    detail: `Missing: ${missing.join(", ")}`,
  };
}

function checkNoPublicServiceRoleKey(
  fileValues: Record<string, string>,
): CheckResult {
  const forbiddenKeys = [
    ...Object.keys(process.env),
    ...Object.keys(fileValues),
  ].filter(
    (key) =>
      key.startsWith("NEXT_PUBLIC_") &&
      key.toUpperCase().includes("SERVICE_ROLE"),
  );

  const unique = [...new Set(forbiddenKeys)];

  if (unique.length === 0) {
    return {
      name: "Service role key not exposed as NEXT_PUBLIC",
      pass: true,
      detail: "No NEXT_PUBLIC_*SERVICE_ROLE* variable names detected",
    };
  }

  return {
    name: "Service role key not exposed as NEXT_PUBLIC",
    pass: false,
    detail: `Forbidden variable names: ${unique.join(", ")}`,
  };
}

function checkPackageScripts(): CheckResult {
  const packagePath = resolve(process.cwd(), "package.json");

  if (!existsSync(packagePath)) {
    return {
      name: "package.json scripts",
      pass: false,
      detail: "package.json not found",
    };
  }

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  const scripts = pkg.scripts ?? {};
  const missingScripts = EXPECTED_SCRIPTS.filter((name) => !scripts[name]);

  const hasTypecheck =
    Boolean(scripts["typecheck"]) ||
    Boolean(pkg.devDependencies?.typescript);

  const issues: string[] = [];

  if (missingScripts.length > 0) {
    issues.push(`missing scripts: ${missingScripts.join(", ")}`);
  }

  if (!hasTypecheck) {
    issues.push("typescript devDependency or typecheck script not found");
  }

  if (issues.length === 0) {
    return {
      name: "Build and QA scripts",
      pass: true,
      detail:
        "build, qa:env, qa:routes, qa:smoke present; typecheck via npx tsc --noEmit",
    };
  }

  return {
    name: "Build and QA scripts",
    pass: false,
    detail: issues.join("; "),
  };
}

function checkApiRoutes(): CheckResult {
  const result = spawnSync("npx tsx scripts/check-api-routes.ts", {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  if (result.error) {
    return {
      name: "API route inventory (qa:routes)",
      pass: false,
      detail: `Failed to run check-api-routes.ts: ${result.error.message}`,
    };
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "unknown error";
    return {
      name: "API route inventory (qa:routes)",
      pass: false,
      detail: `check-api-routes.ts exited with code ${result.status}: ${stderr}`,
    };
  }

  const output = result.stdout ?? "";
  const routeCountMatch = output.match(/Detected (\d+) API route/);
  const routeCount = routeCountMatch?.[1] ?? "?";

  return {
    name: "API route inventory (qa:routes)",
    pass: true,
    detail: `Route scan completed (${routeCount} handlers). See docs/API_ROUTE_INVENTORY.md`,
  };
}

function main(): void {
  console.log("Pre-deploy check (no secret values printed)\n");

  const fileValues = loadDotEnvFile(resolve(process.cwd(), ".env.local"));
  const results: CheckResult[] = [
    checkRequiredEnv(fileValues),
    checkNoPublicServiceRoleKey(fileValues),
    checkPackageScripts(),
    checkApiRoutes(),
  ];

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.pass ? "PASS" : "FAIL";
    console.log(`  ${status}  ${result.name}`);
    console.log(`         ${result.detail}`);

    if (result.pass) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log(
      "\nFix failures before deploying. Then run: npm run build && npx tsc --noEmit",
    );
    process.exit(1);
  }

  console.log(
    "\nPre-deploy checks passed. Run build and typecheck before promoting to production.",
  );
  console.log("  npm run build");
  console.log("  npx tsc --noEmit");
  console.log("  npm run deploy:config   (production-style config review)");
}

main();
