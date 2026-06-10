/**
 * Phase 4Z final beta launch readiness check.
 * Verifies launch docs, script files, and npm scripts exist.
 * Does not print secret values. Does not run build or live API tests.
 *
 * Run: npm run final:check
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

const REQUIRED_LAUNCH_DOCS = [
  "docs/FINAL_BETA_LAUNCH_CHECKLIST.md",
  "docs/GO_NO_GO_CRITERIA.md",
  "docs/LAUNCH_DAY_RUNBOOK.md",
  "docs/BETA_LIMITATIONS_AND_RISKS.md",
  "docs/BETA_ROADMAP_AFTER_LAUNCH.md",
  "docs/FINAL_DEMO_CHECKLIST.md",
  "docs/FINAL_SECURITY_CHECKLIST.md",
  "docs/PRODUCTION_READINESS_CHECKLIST.md",
  "docs/DEPLOYMENT_CHECKLIST.md",
  "docs/DEMO_ENVIRONMENT.md",
] as const;

const REQUIRED_SCRIPT_FILES = [
  "scripts/verify-env.ts",
  "scripts/check-api-routes.ts",
  "scripts/smoke-test-api.ts",
  "scripts/ops-check.ts",
  "scripts/security-audit.ts",
  "scripts/predeploy-check.ts",
  "scripts/verify-production-config.ts",
  "scripts/seed-demo-data.ts",
  "scripts/clear-demo-data.ts",
  "scripts/check-service-role-imports.ts",
  "scripts/check-api-auth-patterns.ts",
  "scripts/final-readiness-check.ts",
] as const;

const REQUIRED_NPM_SCRIPTS = [
  "qa:env",
  "qa:routes",
  "qa:smoke",
  "ops:check",
  "security:audit",
  "deploy:check",
  "deploy:config",
  "demo:seed",
  "demo:clear",
  "final:check",
] as const;

const REQUIRED_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
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

function checkNpmScripts(): CheckResult {
  const packagePath = resolve(ROOT, "package.json");

  if (!existsSync(packagePath)) {
    return {
      name: "Required npm scripts",
      pass: false,
      detail: "package.json not found",
    };
  }

  const pkg = JSON.parse(readFileSync(packagePath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  const scripts = pkg.scripts ?? {};
  const missing = REQUIRED_NPM_SCRIPTS.filter((name) => !scripts[name]);

  if (missing.length === 0) {
    return {
      name: "Required npm scripts",
      pass: true,
      detail: `All ${REQUIRED_NPM_SCRIPTS.length} scripts configured`,
    };
  }

  return {
    name: "Required npm scripts",
    pass: false,
    detail: `Missing: ${missing.join(", ")}`,
  };
}

function checkEnvExample(): CheckResult {
  const envExamplePath = resolve(ROOT, ".env.example");

  if (!existsSync(envExamplePath)) {
    return {
      name: "Environment variable names documented",
      pass: false,
      detail: ".env.example missing",
    };
  }

  const content = readFileSync(envExamplePath, "utf8");
  const missing = REQUIRED_ENV_NAMES.filter((name) => !content.includes(name));

  if (missing.length === 0) {
    return {
      name: "Environment variable names documented",
      pass: true,
      detail: `All ${REQUIRED_ENV_NAMES.length} required names in .env.example`,
    };
  }

  return {
    name: "Environment variable names documented",
    pass: false,
    detail: `Missing from .env.example: ${missing.join(", ")}`,
  };
}

function checkNoPublicServiceRoleName(): CheckResult {
  const envExamplePath = resolve(ROOT, ".env.example");
  const filesToScan = [envExamplePath].filter((path) => existsSync(path));

  const forbidden: string[] = [];

  for (const filePath of filesToScan) {
    const content = readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex <= 0) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      if (
        key.startsWith("NEXT_PUBLIC_") &&
        key.toUpperCase().includes("SERVICE_ROLE")
      ) {
        forbidden.push(key);
      }
    }
  }

  const processForbidden = Object.keys(process.env).filter(
    (key) =>
      key.startsWith("NEXT_PUBLIC_") &&
      key.toUpperCase().includes("SERVICE_ROLE"),
  );

  const unique = [...new Set([...forbidden, ...processForbidden])];

  if (unique.length === 0) {
    return {
      name: "Service role not exposed as NEXT_PUBLIC",
      pass: true,
      detail: "No NEXT_PUBLIC_*SERVICE_ROLE* variable names detected",
    };
  }

  return {
    name: "Service role not exposed as NEXT_PUBLIC",
    pass: false,
    detail: `Forbidden variable names: ${unique.join(", ")}`,
  };
}

function checkReadmeFinalSection(): CheckResult {
  const readmePath = resolve(ROOT, "README.md");

  if (!existsSync(readmePath)) {
    return {
      name: "README final readiness section",
      pass: false,
      detail: "README.md missing",
    };
  }

  const content = readFileSync(readmePath, "utf8");
  const hasSection =
    content.includes("Final readiness") &&
    content.includes("FINAL_BETA_LAUNCH_CHECKLIST.md");

  if (hasSection) {
    return {
      name: "README final readiness section",
      pass: true,
      detail: "README links to final launch checklist",
    };
  }

  return {
    name: "README final readiness section",
    pass: false,
    detail: "Add Final readiness section linking to docs/FINAL_BETA_LAUNCH_CHECKLIST.md",
  };
}

function checkRlsFixDocumented(): CheckResult {
  const securityDoc = resolve(ROOT, "docs/FINAL_SECURITY_CHECKLIST.md");

  if (!existsSync(securityDoc)) {
    return {
      name: "RLS role-escalation fix documented",
      pass: false,
      detail: "docs/FINAL_SECURITY_CHECKLIST.md missing",
    };
  }

  const content = readFileSync(securityDoc, "utf8");
  const mentionsFix =
    content.includes("202606100014_fix_users_role_self_escalation") ||
    content.includes("role escalation") ||
    content.includes("role-escalation");

  if (mentionsFix) {
    return {
      name: "RLS role-escalation fix documented",
      pass: true,
      detail: "Final security checklist references C-1 RLS fix",
    };
  }

  return {
    name: "RLS role-escalation fix documented",
    pass: false,
    detail: "FINAL_SECURITY_CHECKLIST.md should reference migration 202606100014",
  };
}

function main(): void {
  console.log("Aegis Wealth OS — Phase 4Z Final Readiness Check");
  console.log("(No secret values printed)\n");

  const checks: CheckResult[] = [
    checkFiles(REQUIRED_LAUNCH_DOCS, "Launch documentation"),
    checkFiles(REQUIRED_SCRIPT_FILES, "Automation script files"),
    checkNpmScripts(),
    checkEnvExample(),
    checkNoPublicServiceRoleName(),
    checkReadmeFinalSection(),
    checkRlsFixDocumented(),
  ];

  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const status = check.pass ? "PASS" : "FAIL";
    console.log(`  ${status}  ${check.name}`);
    console.log(`         ${check.detail}`);

    if (check.pass) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`\nSummary: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log("\nResolve failures above, then run the full gate sequence:");
    console.log("  npm run final:check");
    console.log("  npm run deploy:check");
    console.log("  npm run ops:check");
    console.log("  npm run security:audit");
    console.log("  npm run build && npx tsc --noEmit");
    process.exit(1);
  }

  console.log("\nStructural readiness checks passed.");
  console.log("Next: run automated gates and manual checklists in docs/FINAL_BETA_LAUNCH_CHECKLIST.md");
  console.log("  npm run qa:env");
  console.log("  npm run deploy:check");
  console.log("  npm run deploy:config -- --production");
  console.log("  npm run ops:check");
  console.log("  npm run security:audit");
  console.log("  npm run build && npx tsc --noEmit");
  console.log("  npm run dev   # then: npm run qa:smoke");
  console.log("  npm run demo:seed   # dev/staging demo only");
}

main();
