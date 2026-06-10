/**
 * Safely reviews production-facing configuration without printing secrets.
 *
 * Run locally before setting Vercel env vars:
 *   npx tsx scripts/verify-production-config.ts
 *
 * Simulate production review (stricter localhost warnings):
 *   npx tsx scripts/verify-production-config.ts --production
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const URL_VARS = ["BASE_URL", "NEXT_PUBLIC_APP_URL"] as const;

type Finding = {
  level: "error" | "warn" | "ok";
  message: string;
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

function isProductionStyle(): boolean {
  if (process.argv.includes("--production")) {
    return true;
  }

  const nodeEnv = process.env.NODE_ENV?.trim();
  const vercelEnv = process.env.VERCEL_ENV?.trim();

  return nodeEnv === "production" || vercelEnv === "production";
}

function isLocalhostUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isValidSupabaseProjectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    return host.endsWith(".supabase.co") || host.includes("supabase");
  } catch {
    return false;
  }
}

function collectForbiddenPublicServiceRoleKeys(
  fileValues: Record<string, string>,
): string[] {
  const keys = new Set<string>([
    ...Object.keys(process.env),
    ...Object.keys(fileValues),
  ]);

  return [...keys].filter(
    (key) =>
      key.startsWith("NEXT_PUBLIC_") &&
      key.toUpperCase().includes("SERVICE_ROLE"),
  );
}

function main(): void {
  const productionStyle = isProductionStyle();
  const fileValues = loadDotEnvFile(resolve(process.cwd(), ".env.local"));
  const findings: Finding[] = [];

  console.log(
    `Production config review (values are never printed)${productionStyle ? " [production-style]" : ""}\n`,
  );

  for (const name of REQUIRED_VARS) {
    const value = resolveEnv(name, fileValues);
    if (!value) {
      findings.push({ level: "error", message: `Missing required variable: ${name}` });
      continue;
    }

    findings.push({ level: "ok", message: `${name} is set` });
  }

  const supabaseUrl = resolveEnv("NEXT_PUBLIC_SUPABASE_URL", fileValues);
  if (supabaseUrl) {
    if (isValidSupabaseProjectUrl(supabaseUrl)) {
      findings.push({
        level: "ok",
        message: "NEXT_PUBLIC_SUPABASE_URL has expected Supabase HTTPS shape",
      });
    } else {
      findings.push({
        level: productionStyle ? "error" : "warn",
        message:
          "NEXT_PUBLIC_SUPABASE_URL does not look like a Supabase project URL (expected https://<ref>.supabase.co)",
      });
    }

    if (isLocalhostUrl(supabaseUrl)) {
      findings.push({
        level: "error",
        message: "NEXT_PUBLIC_SUPABASE_URL must not point to localhost",
      });
    }
  }

  const forbiddenPublicKeys = collectForbiddenPublicServiceRoleKeys(fileValues);
  if (forbiddenPublicKeys.length > 0) {
    findings.push({
      level: "error",
      message: `Service role key exposed via public env name(s): ${forbiddenPublicKeys.join(", ")}`,
    });
  } else {
    findings.push({
      level: "ok",
      message: "SUPABASE_SERVICE_ROLE_KEY is not prefixed with NEXT_PUBLIC_",
    });
  }

  const anonKey = resolveEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", fileValues);
  const serviceRoleKey = resolveEnv("SUPABASE_SERVICE_ROLE_KEY", fileValues);
  if (anonKey && serviceRoleKey && anonKey === serviceRoleKey) {
    findings.push({
      level: "error",
      message:
        "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must not be identical",
    });
  }

  for (const name of URL_VARS) {
    const value = resolveEnv(name, fileValues);
    if (!value) continue;

    if (isLocalhostUrl(value)) {
      findings.push({
        level: productionStyle ? "warn" : "ok",
        message: `${name} uses localhost — acceptable for local dev only`,
      });
    } else if (!value.startsWith("https://")) {
      findings.push({
        level: "warn",
        message: `${name} should use HTTPS in production deployments`,
      });
    } else {
      findings.push({
        level: "ok",
        message: `${name} uses a non-localhost HTTPS URL`,
      });
    }
  }

  if (productionStyle) {
    const localhostUrlVars = URL_VARS.filter((name) => {
      const value = resolveEnv(name, fileValues);
      return value.length > 0 && isLocalhostUrl(value);
    });

    if (localhostUrlVars.length > 0) {
      findings.push({
        level: "warn",
        message: `Production-style review: replace localhost in ${localhostUrlVars.join(", ")} with your Vercel URL`,
      });
    }
  }

  findings.push({
    level: "warn",
    message:
      "In-memory rate limiting is per-process — not production-grade for multi-instance Vercel deployments",
  });

  findings.push({
    level: "warn",
    message:
      "Do not deploy with real client data until legal, compliance, and security review is complete",
  });

  let errors = 0;
  let warnings = 0;
  let oks = 0;

  for (const finding of findings) {
    const label =
      finding.level === "error" ? "ERROR" : finding.level === "warn" ? "WARN " : "OK   ";
    console.log(`  ${label}  ${finding.message}`);

    if (finding.level === "error") errors += 1;
    else if (finding.level === "warn") warnings += 1;
    else oks += 1;
  }

  console.log(`\nSummary: ${oks} ok, ${warnings} warning(s), ${errors} error(s)`);

  if (errors > 0) {
    console.log("\nResolve errors before production deployment.");
    process.exit(1);
  }

  if (warnings > 0) {
    console.log("\nReview warnings. Deployment may proceed after acknowledgment.");
  } else {
    console.log("\nProduction config review passed with no warnings.");
  }
}

main();
