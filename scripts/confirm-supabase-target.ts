/**
 * Read-only Supabase target confirmation before migration commands.
 * Never writes to Supabase. Never prints secrets.
 *
 * Usage:
 *   EXPECTED_SUPABASE_PROJECT_REF=<ref> npm run supabase:confirm-target -- --env staging
 *   npm run supabase:confirm-target -- --env staging --expected-ref abcdefghijklmnop
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type EnvClassification = "staging" | "production" | "local" | "unknown";

function readProjectRef(): string | null {
  const candidates = [
    join(ROOT, "supabase", ".temp", "project-ref"),
    join(ROOT, "supabase", ".temp", "linked-project.json"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const raw = readFileSync(path, "utf8").trim();
    if (path.endsWith("project-ref")) {
      return raw || null;
    }
    try {
      const parsed = JSON.parse(raw) as { id?: string; project_id?: string };
      return parsed.id ?? parsed.project_id ?? null;
    } catch {
      continue;
    }
  }
  return null;
}

function parseArgs(): { env: EnvClassification; expectedRef: string | null } {
  const args = process.argv.slice(2);
  let env: EnvClassification = "unknown";
  let expectedRef: string | null = process.env.EXPECTED_SUPABASE_PROJECT_REF?.trim() ?? null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--env" && args[i + 1]) {
      env = args[i + 1] as EnvClassification;
      i++;
    }
    if (args[i] === "--expected-ref" && args[i + 1]) {
      expectedRef = args[i + 1];
      i++;
    }
  }

  return { env, expectedRef };
}

function main(): void {
  const { env, expectedRef } = parseArgs();
  const projectRef = readProjectRef();

  console.log("Supabase target confirmation (read-only)\n");
  console.log(`  Linked project reference: ${projectRef ?? "(not linked locally)"}`);
  console.log(`  Requested environment class: ${env}`);
  console.log(`  Expected safe reference: ${expectedRef ?? "(not set — set EXPECTED_SUPABASE_PROJECT_REF)"}`);

  let exitCode = 0;

  if (!projectRef) {
    console.error("\nFAIL: No linked Supabase project reference found.");
    console.error("Run `npx supabase link --project-ref <ref>` after operator approval.");
    exitCode = 1;
  }

  if (env === "unknown") {
    console.error("\nFAIL: Environment classification required. Pass --env staging|production|local");
    exitCode = 1;
  }

  if (env === "production") {
    console.warn("\nWARNING: Production classification detected.");
    console.warn("Remote migration push requires explicit operator approval and backup.");
    exitCode = 1;
  }

  if (expectedRef && projectRef && projectRef !== expectedRef) {
    console.error("\nFAIL: Linked project reference does not match EXPECTED_SUPABASE_PROJECT_REF.");
    console.error("Do not run db push or migration repair against an unknown target.");
    exitCode = 1;
  }

  if (!expectedRef && env === "staging") {
    console.warn("\nWARNING: Staging selected but EXPECTED_SUPABASE_PROJECT_REF is unset.");
    console.warn("Set EXPECTED_SUPABASE_PROJECT_REF to your approved staging project ref.");
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log("\nPASS: Target reference matches expected staging classification.");
    console.log("Operator must still confirm project name in Supabase Dashboard before any write.");
  } else {
    console.log("\nBlocked: resolve target mismatch before migration commands.");
  }

  process.exit(exitCode);
}

main();
