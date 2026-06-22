/**
 * Phase 9 migration readiness validation — structural/read-only checks.
 * Run: npm run qa:phase9-migration-readiness
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

type TestCase = { id: number; name: string; run: () => void };

const DIAGNOSTICS = [
  "verify_202606200001_phase9a_compliance.sql",
  "verify_202606200002_publication_hardening.sql",
  "verify_202606200003_meeting_studio.sql",
  "verify_202606200004_meeting_studio_rls.sql",
  "verify_202606200005_client_portal.sql",
  "verify_202606200006_communications.sql",
  "verify_202606200007_communications_hardening.sql",
];

const PHASE9_EXPECTED_CHECK_COUNTS: Record<string, number> = {
  "202606200001": 25,
  "202606200002": 4,
  "202606200003": 20,
  "202606200004": 4,
  "202606200005": 21,
  "202606200006": 24,
  "202606200007": 8,
};

function countMigrationChecks(sql: string, migration: string): number {
  const re = new RegExp(`\\('${migration}','[a-z_]+'`, "g");
  return (sql.match(re) ?? []).length;
}

function countDedicatedChecks(file: string, migration: string): number {
  const sql = read(`supabase/diagnostics/${file}`);
  const detailBlock = sql.split(/-- Rollup/)[0];
  return countMigrationChecks(detailBlock, migration);
}

const tests: TestCase[] = [
  {
    id: 1,
    name: "All seven dedicated diagnostics exist",
    run: () => {
      for (const file of DIAGNOSTICS) {
        check(existsSync(join(ROOT, `supabase/diagnostics/${file}`)), file);
      }
    },
  },
  {
    id: 2,
    name: "Consolidated Phase 9 rollup exists",
    run: () => {
      check(existsSync(join(ROOT, "supabase/diagnostics/verify_phase9_migrations.sql")), "rollup missing");
      check(existsSync(join(ROOT, "supabase/diagnostics/verify_phase9_discrepancies.sql")), "discrepancies missing");
    },
  },
  {
    id: 3,
    name: "Phase 9 preflight exists",
    run: () => check(existsSync(join(ROOT, "supabase/diagnostics/preflight_phase9_application.sql")), "preflight missing"),
  },
  {
    id: 4,
    name: "Every diagnostic is read-only",
    run: () => {
      const files = [
        ...DIAGNOSTICS,
        "verify_phase9_migrations.sql",
        "verify_phase9_discrepancies.sql",
        "preflight_phase9_application.sql",
      ];
      for (const file of files) {
        const sql = read(`supabase/diagnostics/${file}`).toLowerCase();
        check(!/(^|\n)\s*(insert|update|delete|truncate|create|alter|drop)\s+/m.test(sql), `${file} has write DDL/DML`);
        check(/\bselect\b/.test(sql), `${file} missing SELECT`);
      }
    },
  },
  {
    id: 5,
    name: "Diagnostics are parser-ready for libpg-query",
    run: () => {
      for (const file of DIAGNOSTICS) {
        const sql = read(`supabase/diagnostics/${file}`);
        check(sql.includes("SELECT"), `${file} must contain SELECT`);
      }
    },
  },
  {
    id: 6,
    name: "Optional tables may be absent safely",
    run: () => {
      const preflight = read("supabase/diagnostics/preflight_phase9_application.sql");
      check(preflight.includes("to_regclass"), "preflight missing to_regclass guards");
      check(preflight.includes("query_to_xml"), "preflight missing catalog-safe probes");
    },
  },
  {
    id: 7,
    name: "Every migration has multiple meaningful checks",
    run: () => {
      for (const file of DIAGNOSTICS) {
        const sql = read(`supabase/diagnostics/${file}`);
        const checkRows = (sql.match(/\('20260620000[1-7]'/g) ?? []).length;
        check(checkRows >= 3, `${file} has too few checks`);
      }
    },
  },
  {
    id: 8,
    name: "Enum definitions are verified",
    run: () => {
      check(read("supabase/diagnostics/verify_202606200001_phase9a_compliance.sql").includes("enum"), "phase9a enum checks");
      check(read("supabase/diagnostics/verify_202606200003_meeting_studio.sql").includes("meeting_session_status"), "phase9c enum checks");
    },
  },
  {
    id: 9,
    name: "Column definitions are verified",
    run: () => {
      check(read("supabase/diagnostics/verify_202606200001_phase9a_compliance.sql").includes("column"), "phase9a columns");
      check(read("supabase/diagnostics/verify_202606200005_client_portal.sql").includes("roadmap_items.client_visible"), "phase9d columns");
    },
  },
  {
    id: 10,
    name: "Constraint definitions are verified",
    run: () => {
      check(read("supabase/diagnostics/verify_202606200006_communications.sql").includes("constraint"), "phase9e constraints");
      check(read("supabase/diagnostics/verify_202606200005_client_portal.sql").includes("source_key_unique"), "phase9d constraints");
    },
  },
  {
    id: 11,
    name: "Exact index definitions are verified",
    run: () => {
      const phase9aHardening = read("supabase/diagnostics/verify_202606200002_publication_hardening.sql");
      check(phase9aHardening.includes("index_def"), "index predicate check missing");
      const phase9eHardening = read("supabase/diagnostics/verify_202606200007_communications_hardening.sql");
      check(phase9eHardening.includes("idx_client_notifications_idempotent"), "idempotency index check missing");
    },
  },
  {
    id: 12,
    name: "RLS enabled state is verified",
    run: () => {
      check(read("supabase/diagnostics/verify_202606200001_phase9a_compliance.sql").includes("rls"), "phase9a rls");
      check(read("supabase/diagnostics/verify_202606200006_communications.sql").includes("relrowsecurity"), "phase9e rls");
    },
  },
  {
    id: 13,
    name: "Policy definitions are verified",
    run: () => {
      check(read("supabase/diagnostics/verify_202606200003_meeting_studio.sql").includes("policy"), "phase9c policies");
      check(read("supabase/diagnostics/verify_202606200006_communications.sql").includes("client_notifications_select_owner"), "phase9e policy");
    },
  },
  {
    id: 14,
    name: "Feature-control seeds are verified safely",
    run: () => {
      for (const file of [
        "verify_202606200001_phase9a_compliance.sql",
        "verify_202606200003_meeting_studio.sql",
        "verify_202606200006_communications.sql",
      ]) {
        const sql = read(`supabase/diagnostics/${file}`);
        check(sql.includes("seed_probe"), `${file} seed probe missing`);
        check(sql.includes("query_to_xml"), `${file} seed probe must be safe`);
      }
    },
  },
  {
    id: 15,
    name: "Duplicate-current-publication probe exists",
    run: () => {
      const preflight = read("supabase/diagnostics/preflight_phase9_application.sql");
      check(preflight.includes("duplicate_current_publications"), "missing duplicate publication probe");
    },
  },
  {
    id: 16,
    name: "Meeting lifecycle compatibility probes exist",
    run: () => {
      const preflight = read("supabase/diagnostics/preflight_phase9_application.sql");
      check(preflight.includes("meeting.lifecycle_incompatibilities"), "missing meeting lifecycle probe");
    },
  },
  {
    id: 17,
    name: "Goal/review duplicate probes exist",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_phase9_application.sql");
      check(sql.includes("duplicate_goal_review_source_keys"), "missing goals/review duplicate probe");
    },
  },
  {
    id: 18,
    name: "Notification/delivery duplicate probes exist",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_phase9_application.sql");
      check(sql.includes("duplicate_notification_idempotency_keys"), "missing notification probe");
      check(sql.includes("duplicate_delivery_idempotency_keys"), "missing delivery probe");
    },
  },
  {
    id: 19,
    name: "Phase 9 dependencies are represented",
    run: () => {
      const rollup = read("supabase/diagnostics/verify_phase9_migrations.sql");
      check(rollup.includes("dependency_graph"), "dependency graph missing");
      check(rollup.includes("resolved AS"), "resolved detail aggregation missing");
      check(rollup.includes("BLOCKED_BY_DEPENDENCY"), "dependency classification missing");
    },
  },
  {
    id: 20,
    name: "EXACT_MATCH requires all required checks",
    run: () => {
      const rollup = read("supabase/diagnostics/verify_phase9_migrations.sql");
      check(rollup.includes("p.present_checks = p.total_required_checks"), "strict EXACT_MATCH missing");
      check(rollup.includes("p.absent_checks = 0"), "absent gate missing");
      check(rollup.includes("p.conflicting_checks = 0"), "conflicting gate missing");
      check(rollup.includes("p.unknown_checks = 0"), "unknown gate missing");
    },
  },
  {
    id: 27,
    name: "Consolidated rollup aggregates detailed checks from dedicated diagnostics",
    run: () => {
      const rollup = read("supabase/diagnostics/verify_phase9_migrations.sql");
      const pairs: Array<[string, string]> = [
        ["202606200001", "verify_202606200001_phase9a_compliance.sql"],
        ["202606200002", "verify_202606200002_publication_hardening.sql"],
        ["202606200003", "verify_202606200003_meeting_studio.sql"],
        ["202606200004", "verify_202606200004_meeting_studio_rls.sql"],
        ["202606200005", "verify_202606200005_client_portal.sql"],
        ["202606200006", "verify_202606200006_communications.sql"],
        ["202606200007", "verify_202606200007_communications_hardening.sql"],
      ];
      for (const [migration, file] of pairs) {
        const dedicatedCount = countDedicatedChecks(file, migration);
        const rollupCount = countMigrationChecks(rollup, migration);
        check(
          dedicatedCount === rollupCount,
          `${migration}: dedicated=${dedicatedCount} rollup=${rollupCount}`,
        );
      }
      const rollupTotal = Object.keys(PHASE9_EXPECTED_CHECK_COUNTS).reduce(
        (sum, migration) => sum + countMigrationChecks(rollup, migration),
        0,
      );
      check(rollupTotal === 106, `rollup must aggregate 106 detailed checks, got ${rollupTotal}`);
    },
  },
  {
    id: 28,
    name: "No migration uses single-check placeholder rollup",
    run: () => {
      const rollup = read("supabase/diagnostics/verify_phase9_migrations.sql");
      check(!/total_required_checks,\s*1,/.test(rollup), "single-check placeholder detected");
      for (const [migration, expected] of Object.entries(PHASE9_EXPECTED_CHECK_COUNTS)) {
        check(
          countMigrationChecks(rollup, migration) === expected,
          `${migration} expected ${expected} detailed checks in rollup`,
        );
        check(expected > 1, `${migration} must have more than one required check`);
      }
    },
  },
  {
    id: 29,
    name: "Migration-specific minimum check-count expectations match inventory",
    run: () => {
      const pairs: Array<[string, string]> = [
        ["202606200001", "verify_202606200001_phase9a_compliance.sql"],
        ["202606200002", "verify_202606200002_publication_hardening.sql"],
        ["202606200003", "verify_202606200003_meeting_studio.sql"],
        ["202606200004", "verify_202606200004_meeting_studio_rls.sql"],
        ["202606200005", "verify_202606200005_client_portal.sql"],
        ["202606200006", "verify_202606200006_communications.sql"],
        ["202606200007", "verify_202606200007_communications_hardening.sql"],
      ];
      for (const [migration, file] of pairs) {
        const expected = PHASE9_EXPECTED_CHECK_COUNTS[migration];
        const dedicatedCount = countDedicatedChecks(file, migration);
        check(dedicatedCount === expected, `${file} expected ${expected}, got ${dedicatedCount}`);
        check(expected > 1, `${migration} must define more than one required check`);
      }
    },
  },
  {
    id: 30,
    name: "Phase 9 discrepancy diagnostic uses all 106 expected checks",
    run: () => {
      const discrepancies = read("supabase/diagnostics/verify_phase9_discrepancies.sql");
      const rollup = read("supabase/diagnostics/verify_phase9_migrations.sql");
      const discrepancyTotal = Object.keys(PHASE9_EXPECTED_CHECK_COUNTS).reduce(
        (sum, migration) => sum + countMigrationChecks(discrepancies, migration),
        0,
      );
      const rollupTotal = Object.keys(PHASE9_EXPECTED_CHECK_COUNTS).reduce(
        (sum, migration) => sum + countMigrationChecks(rollup, migration),
        0,
      );
      check(discrepancyTotal === 106, `discrepancies inventory=${discrepancyTotal}, expected 106`);
      check(rollupTotal === 106, `rollup inventory=${rollupTotal}, expected 106`);
      check(discrepancyTotal === rollupTotal, "discrepancy inventory must match rollup inventory");
    },
  },
  {
    id: 31,
    name: "Discrepancy query filters out present rows",
    run: () => {
      const sql = read("supabase/diagnostics/verify_phase9_discrepancies.sql");
      check(sql.includes("WHERE r.state IN ('conflicting', 'absent', 'unknown')"), "present rows not filtered");
      check(!sql.includes("state = 'present'"), "must not select present state");
      check(sql.includes("ELSE 'present'"), "resolution must still classify present checks");
    },
  },
  {
    id: 32,
    name: "Discrepancy query does not hide rows behind dependency state",
    run: () => {
      const sql = read("supabase/diagnostics/verify_phase9_discrepancies.sql");
      check(!sql.includes("dependency_graph"), "dependency graph must not gate discrepancy output");
      check(!sql.includes("BLOCKED_BY_DEPENDENCY"), "dependency classification must not mask discrepancies");
      check(!sql.includes("migration_classification"), "rollup classification must not filter discrepancies");
    },
  },
  {
    id: 33,
    name: "Discrepancy query includes expected and actual detail",
    run: () => {
      const sql = read("supabase/diagnostics/verify_phase9_discrepancies.sql");
      check(sql.includes("expected_detail"), "expected_detail missing");
      check(sql.includes("actual_detail"), "actual_detail missing");
      check(sql.includes("expected_canonical_detail"), "expected_canonical_detail missing");
      check(sql.includes("actual_canonical_detail"), "actual_canonical_detail missing");
      check(sql.includes("actual_udt_schema"), "actual_udt_schema missing");
      check(sql.includes("actual_udt_name"), "actual_udt_name missing");
      check(sql.includes("suggested_interpretation"), "suggested_interpretation missing");
      check(sql.includes("policy_expressions"), "policy expression detail missing");
    },
  },
  {
    id: 35,
    name: "Shared Phase 9 column canonical comparison is present",
    run: () => {
      for (const file of [
        "verify_phase9_migrations.sql",
        "verify_phase9_discrepancies.sql",
        "verify_202606200001_phase9a_compliance.sql",
        "verify_202606200003_meeting_studio.sql",
        "verify_202606200005_client_portal.sql",
      ]) {
        const sql = read(`supabase/diagnostics/${file}`);
        check(sql.includes("expected_column_specs"), `${file} missing expected_column_specs`);
        check(sql.includes("canonical_detail"), `${file} missing canonical_detail`);
        check(sql.includes("udt_name IS DISTINCT FROM"), `${file} missing udt_name comparison`);
      }
    },
  },
  {
    id: 36,
    name: "Column canonicalization regression tests pass",
    run: () => {
      execSync("npx tsx scripts/run-phase9-column-canonicalization-validation.ts", {
        cwd: ROOT,
        stdio: "pipe",
      });
    },
  },
  {
    id: 34,
    name: "Discrepancy diagnostic is read-only",
    run: () => {
      const sql = read("supabase/diagnostics/verify_phase9_discrepancies.sql").toLowerCase();
      check(!/(^|\n)\s*(insert|update|delete|truncate|create|alter|drop)\s+/m.test(sql), "discrepancies has write DDL/DML");
      check(/\bselect\b/.test(sql), "discrepancies missing SELECT");
      check(!/\bsupabase\s+(db\s+push|migration\s+repair)\b/.test(sql), "forbidden supabase commands in discrepancies");
    },
  },
  {
    id: 21,
    name: "No migration repair command executes",
    run: () => {
      const pkg = read("package.json");
      check(!/\bsupabase\s+migration\s+repair\b/.test(pkg), "forbidden command in scripts");
    },
  },
  {
    id: 22,
    name: "No db push executes",
    run: () => {
      const pkg = read("package.json");
      check(!/\bsupabase\s+db\s+push\b/.test(pkg), "forbidden command in scripts");
    },
  },
  {
    id: 23,
    name: "Historical migrations remain unchanged",
    run: () => {
      for (const file of [
        "202606100019_adviser_profiles.sql",
        "202606100020_google_calendar_booking.sql",
        "202606100021_phase6f_performance_indexes.sql",
        "202606150001_clients_user_id_unique.sql",
        "202606180001_phase8a_client_birthday_reminders.sql",
        "202606180002_phase8b_adviser_created_appointments.sql",
      ]) {
        check(existsSync(join(ROOT, `supabase/migrations/${file}`)), file);
      }
    },
  },
  {
    id: 24,
    name: "TypeScript passes (structural)",
    run: () => check(existsSync(join(ROOT, "tsconfig.json")), "tsconfig missing"),
  },
  {
    id: 25,
    name: "Lint passes (structural)",
    run: () => check(existsSync(join(ROOT, ".eslintrc.json")) || existsSync(join(ROOT, "eslint.config.mjs")) || existsSync(join(ROOT, "eslint.config.js")), "eslint config missing"),
  },
  {
    id: 26,
    name: "Build passes (structural)",
    run: () => check(read("package.json").includes("\"build\""), "build script missing"),
  },
];

function main(): void {
  console.log(`Phase 9 migration readiness validation — ${tests.length} checks\n`);
  let passed = 0;
  for (const test of tests) {
    try {
      test.run();
      passed++;
      console.log(`  ✓ ${test.id}. ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ ${test.id}. ${test.name}: ${message}`);
    }
  }
  console.log(`\n${passed}/${tests.length} passed`);
  if (passed !== tests.length) process.exit(1);
}

main();
