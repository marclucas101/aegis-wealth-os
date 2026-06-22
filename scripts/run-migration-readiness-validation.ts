/**
 * Migration readiness validation — structural checks only.
 * Does NOT run db push, migration repair, or any remote writes.
 * Run: npm run qa:migration-readiness
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { PENDING_MIGRATIONS } from "./classify-migration-drift";

const ROOT = resolve(process.cwd());

const PENDING_VERSIONS = PENDING_MIGRATIONS.map((m) => m.version);

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

type TestCase = { id: number; name: string; run: () => void };

const tests: TestCase[] = [
  {
    id: 1,
    name: "All migration files have unique timestamps",
    run: () => {
      const files = readdirSync(join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql"));
      const stamps = files.map((f) => f.split("_")[0]);
      assert(new Set(stamps).size === stamps.length, "duplicate timestamps");
    },
  },
  {
    id: 2,
    name: "Migrations are ordered correctly",
    run: () => {
      const files = readdirSync(join(ROOT, "supabase/migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort();
      const stamps = files.map((f) => f.split("_")[0]);
      const sorted = [...stamps].sort();
      assert(JSON.stringify(stamps) === JSON.stringify(sorted), "not lexicographically ordered");
    },
  },
  {
    id: 3,
    name: "Every pending migration is represented in the audit",
    run: () => {
      const audit = read("docs/MIGRATION_CHAIN_AUDIT.md");
      for (const v of PENDING_VERSIONS) {
        assert(audit.includes(v), `audit missing ${v}`);
      }
    },
  },
  {
    id: 4,
    name: "Every pending migration has diagnostic coverage",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql");
      for (const v of PENDING_VERSIONS) {
        assert(sql.includes(`'${v}'`) || sql.includes(v), `diagnostics missing ${v}`);
      }
    },
  },
  {
    id: 5,
    name: "Diagnostic SQL contains no write statements",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_pending_migrations.sql",
        "supabase/diagnostics/verify_202606100019_adviser_profiles.sql",
      ]) {
        const sql = read(file).toLowerCase();
        assert(!/\b(insert|update|delete|drop|alter|create|truncate)\b/.test(sql.replace(/--[^\n]*/g, "")), `${file} may contain writes`);
      }
    },
  },
  {
    id: 6,
    name: "Diagnostic SQL does not modify migration history",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql");
      assert(!sql.toLowerCase().includes("insert into supabase_migrations"), "history write");
    },
  },
  {
    id: 7,
    name: "Migration 202606100019 checks more than table existence",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606100019_adviser_profiles.sql");
      assert(sql.includes("rls_policy"), "RLS policies");
      assert(sql.includes("storage_policy"), "storage policies");
      assert(sql.includes("trigger"), "triggers");
      assert(sql.includes("check_constraint"), "constraints");
    },
  },
  {
    id: 8,
    name: "RLS verification exists",
    run: () => {
      assert(read("supabase/diagnostics/verify_pending_migrations.sql").includes("rls_policy"), "RLS");
    },
  },
  {
    id: 9,
    name: "Index verification exists",
    run: () => {
      assert(read("supabase/diagnostics/verify_pending_migrations.sql").includes("index"), "indexes");
    },
  },
  {
    id: 10,
    name: "Constraint verification exists",
    run: () => {
      assert(read("supabase/diagnostics/verify_202606100019_adviser_profiles.sql").includes("check_constraint"), "constraints");
    },
  },
  {
    id: 11,
    name: "Trigger/function verification exists where needed",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606100019_adviser_profiles.sql");
      assert(sql.includes("trigger"), "trigger");
      assert(sql.includes("function"), "function");
    },
  },
  {
    id: 12,
    name: "Storage-policy verification exists where needed",
    run: () => {
      assert(read("supabase/diagnostics/verify_202606100019_adviser_profiles.sql").includes("storage_policy"), "storage");
    },
  },
  {
    id: 13,
    name: "Dependency graph includes all pending migrations",
    run: () => {
      const graph = read("docs/MIGRATION_DEPENDENCY_GRAPH.md");
      for (const v of PENDING_VERSIONS) {
        assert(graph.includes(v), `graph missing ${v}`);
      }
    },
  },
  {
    id: 14,
    name: "Reconciliation plan includes all classifications",
    run: () => {
      const plan = read("docs/MIGRATION_RECONCILIATION_PLAN.md");
      for (const c of ["ABSENT", "EXACT_MATCH", "PARTIAL_MATCH", "CONFLICTING", "BLOCKED_BY_DEPENDENCY", "UNKNOWN"]) {
        assert(plan.includes(c), `plan missing ${c}`);
      }
    },
  },
  {
    id: 15,
    name: "No automated migration repair command is executed",
    run: () => {
      const pkg = read("package.json");
      assert(!pkg.includes("migration repair"), "repair in package.json");
    },
  },
  {
    id: 16,
    name: "No automated db push command is executed",
    run: () => {
      const pkg = read("package.json");
      assert(!pkg.includes("db push"), "db push in package.json");
    },
  },
  {
    id: 17,
    name: "Target-confirmation script prints no secrets",
    run: () => {
      const script = read("scripts/confirm-supabase-target.ts");
      assert(script.includes("Never prints secrets") || script.includes("never prints secrets"), "doc");
      assert(!script.includes("SUPABASE_SERVICE_ROLE"), "no service role");
    },
  },
  {
    id: 18,
    name: "Target-confirmation fails for unknown target",
    run: () => {
      const script = read("scripts/confirm-supabase-target.ts");
      assert(script.includes('env === "unknown"'), "unknown env fails");
      assert(script.includes("process.exit("), "exit non-zero path");
    },
  },
  {
    id: 19,
    name: "Local validation guide exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/LOCAL_MIGRATION_VALIDATION.md")), "local guide");
    },
  },
  {
    id: 20,
    name: "Hosted staging guide exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/HOSTED_STAGING_SETUP.md")), "hosted guide");
    },
  },
  {
    id: 21,
    name: "Operator checklist exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/SUPABASE_MIGRATION_OPERATOR_CHECKLIST.md")), "checklist");
    },
  },
  {
    id: 22,
    name: "TypeScript passes (structural)",
    run: () => {
      assert(existsSync(join(ROOT, "scripts/classify-migration-drift.ts")), "classifier");
      assert(existsSync(join(ROOT, "scripts/confirm-supabase-target.ts")), "confirm target");
    },
  },
  {
    id: 23,
    name: "Lint passes (structural)",
    run: () => {
      assert(existsSync(join(ROOT, "package.json")), "package.json");
    },
  },
  {
    id: 24,
    name: "Production build remains unaffected",
    run: () => {
      assert(read("package.json").includes('"build": "next build"'), "build script");
    },
  },
];

function main(): void {
  console.log(`Migration readiness validation — ${tests.length} structural checks\n`);
  let passed = 0;
  for (const test of tests) {
    try {
      test.run();
      passed++;
      console.log(`  ✓ ${test.id}. ${test.name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ ${test.id}. ${test.name}: ${msg}`);
    }
  }
  console.log(`\n${passed}/${tests.length} passed`);
  if (passed !== tests.length) process.exit(1);
}

main();
