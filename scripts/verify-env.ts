/**
 * Verifies required environment variables are present without printing secret values.
 * Run: npx tsx scripts/verify-env.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const OPTIONAL_VARS = ["BASE_URL", "NODE_ENV", "VERCEL_ENV"] as const;

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

function main(): void {
  const fileValues = loadDotEnvFile(resolve(process.cwd(), ".env.local"));

  console.log("Environment verification (values are never printed)\n");

  const missing: string[] = [];
  const present: string[] = [];

  for (const name of REQUIRED_VARS) {
    const value = resolveEnv(name, fileValues);
    if (value) {
      present.push(name);
    } else {
      missing.push(name);
    }
  }

  for (const name of present) {
    console.log(`  OK   ${name}`);
  }

  for (const name of missing) {
    console.log(`  MISS ${name}`);
  }

  const optionalPresent = OPTIONAL_VARS.filter(
    (name) => resolveEnv(name, fileValues).length > 0,
  );

  if (optionalPresent.length > 0) {
    console.log("\nOptional variables detected:");
    for (const name of optionalPresent) {
      console.log(`  OK   ${name}`);
    }
  }

  if (missing.length > 0) {
    console.log(
      `\nMissing ${missing.length} required variable(s). Copy .env.example to .env.local and fill in values.`,
    );
    process.exit(1);
  }

  console.log("\nAll required environment variables are present.");
}

main();
