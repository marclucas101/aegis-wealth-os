/**
 * Scans the repo for service-role imports in unsafe locations.
 * Does not read or print secret values.
 *
 * Run: npm run security:service-role
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type Finding = {
  severity: "critical" | "review";
  file: string;
  message: string;
};

const SERVICE_ROLE_PATTERNS = [
  /createAdminSupabaseClient/,
  /getSupabaseServiceRoleKey/,
  /from\s+["']@\/lib\/supabase\/admin["']/,
  /from\s+["']\.\/admin["']/,
  /from\s+["']\.\.\/admin["']/,
  /SUPABASE_SERVICE_ROLE_KEY/,
] as const;

const SAFE_PATH_PREFIXES = [
  "app/api/",
  "lib/supabase/",
  "scripts/",
  "lib/ops/",
] as const;

const ALWAYS_UNSAFE_PREFIXES = [
  "lib/supabase/client.ts",
] as const;

function walkSourceFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;

  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkSourceFiles(fullPath, acc);
      continue;
    }

    if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      acc.push(fullPath);
    }
  }

  return acc.sort();
}

function rel(filePath: string): string {
  return relative(ROOT, filePath).replace(/\\/g, "/");
}

function isUseClient(source: string): boolean {
  return /^\s*["']use client["'];?\s*$/m.test(source);
}

function isSafePath(filePath: string): boolean {
  const r = rel(filePath);

  if (ALWAYS_UNSAFE_PREFIXES.some((prefix) => r === prefix)) {
    return false;
  }

  if (SAFE_PATH_PREFIXES.some((prefix) => r.startsWith(prefix))) {
    return true;
  }

  if (r.startsWith("app/") && r.endsWith(".tsx") && !isUseClient(readFileSync(filePath, "utf8"))) {
    return true;
  }

  if (r === "middleware.ts") {
    return true;
  }

  return false;
}

function matchesServiceRoleUsage(source: string): boolean {
  return SERVICE_ROLE_PATTERNS.some((pattern) => pattern.test(source));
}

function scanFiles(): Finding[] {
  const findings: Finding[] = [];
  const files = walkSourceFiles(ROOT);

  for (const filePath of files) {
    const source = readFileSync(filePath, "utf8");
    if (!matchesServiceRoleUsage(source)) continue;

    const r = rel(filePath);
    const clientComponent = isUseClient(source);

    if (clientComponent) {
      findings.push({
        severity: "critical",
        file: r,
        message:
          "Service-role reference in a Client Component — must use server-only modules",
      });
      continue;
    }

    if (r.startsWith("components/")) {
      findings.push({
        severity: "critical",
        file: r,
        message:
          "Service-role reference under components/ — verify this is not bundled client-side",
      });
      continue;
    }

    if (!isSafePath(filePath)) {
      findings.push({
        severity: "review",
        file: r,
        message:
          "Service-role reference outside known safe prefixes — manual review required",
      });
    }
  }

  return findings;
}

function scanPublicEnvNames(): Finding[] {
  const findings: Finding[] = [];
  const envExample = resolve(ROOT, ".env.example");

  if (existsSync(envExample)) {
    const content = readFileSync(envExample, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const key = trimmed.split("=")[0]?.trim() ?? "";
      if (key.startsWith("NEXT_PUBLIC_") && key.toUpperCase().includes("SERVICE_ROLE")) {
        findings.push({
          severity: "critical",
          file: ".env.example",
          message: `Public env name must not expose service role: ${key}`,
        });
      }
    }
  }

  const codeFiles = walkSourceFiles(ROOT).filter((file) => {
    const r = rel(file);
    return (
      r.startsWith("lib/") ||
      r.startsWith("app/") ||
      r.startsWith("scripts/") ||
      r === "middleware.ts"
    );
  });

  for (const filePath of codeFiles) {
    const source = readFileSync(filePath, "utf8");
    if (/NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE/i.test(source)) {
      findings.push({
        severity: "critical",
        file: rel(filePath),
        message:
          "NEXT_PUBLIC_*SERVICE_ROLE* reference in source — service role must be server-only",
      });
    }
  }

  return findings;
}

function printFindings(findings: Finding[]): void {
  const critical = findings.filter((f) => f.severity === "critical");
  const review = findings.filter((f) => f.severity === "review");

  console.log("Service role import scan\n");

  if (critical.length === 0) {
    console.log("  OK   No critical unsafe service-role imports detected");
  } else {
    console.log(`  FAIL ${critical.length} critical finding(s):`);
    for (const finding of critical) {
      console.log(`       [CRITICAL] ${finding.file}: ${finding.message}`);
    }
  }

  if (review.length === 0) {
    console.log("  OK   No manual-review service-role paths flagged");
  } else {
    console.log(`  REVIEW ${review.length} item(s) (possible false positives):`);
    for (const finding of review) {
      console.log(`       [REVIEW] ${finding.file}: ${finding.message}`);
    }
  }

  console.log("\nSafe prefixes: app/api/**, lib/supabase/** (except client.ts), scripts/**, server app pages");
  console.log("Full report: docs/SERVICE_ROLE_USAGE_REVIEW.md");
}

function main(): void {
  const findings = [...scanFiles(), ...scanPublicEnvNames()];
  printFindings(findings);

  const hasCritical = findings.some((f) => f.severity === "critical");
  if (hasCritical) {
    process.exitCode = 1;
  }
}

main();
