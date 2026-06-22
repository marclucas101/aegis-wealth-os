/**
 * Migration remediation package validation — structural checks only.
 * Does NOT run db push, migration repair, or any remote database command.
 * Run: npm run qa:migration-remediation
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  OPERATOR_VERIFIED_EXACT_MATCH_MIGRATIONS,
  PARTIAL_MIGRATION_EVIDENCE_FILES,
  PRE_PHASE9_HISTORY_REPAIR_ORDER,
  evidenceCompleteness,
} from "./migration-evidence";

const ROOT = resolve(process.cwd());

const HISTORICAL_MIGRATIONS = [
  "202606100019_adviser_profiles.sql",
  "202606100020_google_calendar_booking.sql",
  "202606100021_phase6f_performance_indexes.sql",
  "202606150001_clients_user_id_unique.sql",
  "202606180001_phase8a_client_birthday_reminders.sql",
  "202606180002_phase8b_adviser_created_appointments.sql",
];

const DEDICATED_DIAGNOSTICS: Record<string, string> = {
  "202606100019": "verify_202606100019_adviser_profiles.sql",
  "202606100020": "verify_202606100020_google_calendar_booking.sql",
  "202606100021": "verify_202606100021_performance_indexes.sql",
  "202606150001": "verify_202606150001_clients_user_id_unique.sql",
  "202606180001": "verify_202606180001_birthday_reminders.sql",
  "202606180002": "verify_202606180002_adviser_created_appointments.sql",
};

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

type TestCase = { id: number; name: string; run: () => void };

function countExecutableStatements(sql: string): number {
  return sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .filter((part) => part.trim().length > 0).length;
}

function cteNamesInStatement(statement: string): Set<string> {
  const names = new Set<string>();
  if (!/\bWITH\b/i.test(statement)) return names;
  const pattern = /\b([a-z_][a-z0-9_]*)\s+AS\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(statement)) !== null) {
    names.add(match[1].toLowerCase());
  }
  return names;
}

function findCrossStatementCteReferences(sql: string, cteNames: string[]): string[] {
  const stripped = sql.replace(/--[^\n]*/g, "");
  const statements = stripped.split(";").map((part) => part.trim()).filter(Boolean);
  const errors: string[] = [];
  for (const statement of statements) {
    const local = cteNamesInStatement(statement);
    for (const name of cteNames) {
      const pattern = new RegExp(`\\bFROM\\s+${name}\\b`, "i");
      if (pattern.test(statement) && !local.has(name.toLowerCase())) {
        errors.push(`${name} referenced without local WITH declaration`);
      }
    }
  }
  return errors;
}

const PREFLIGHT_REQUIRED_PROBES = [
  "clients.user_id_duplicate_probe",
  "clients.user_id_orphan_references",
  "appointment.overlap_probe",
  "appointment.idempotency_duplicate_probe",
  "appointment.creator_idempotency_duplicate_probe",
  "appointment.invalid_source_probe",
  "appointment.invalid_notification_status_probe",
  "appointment.invalid_calendar_sync_status_probe",
  "birthday.invalid_date_of_birth_probe",
  "birthday.duplicate_task_source_key_probe",
  "calendar.enum_status_labels",
  "history.pending_pre_phase9",
];

const tests: TestCase[] = [
  {
    id: 1,
    name: "Evidence file mapping exists for optional JSON exports",
    run: () => {
      for (const version of Object.keys(PARTIAL_MIGRATION_EVIDENCE_FILES)) {
        check(PARTIAL_MIGRATION_EVIDENCE_FILES[version].includes(version.slice(4)), version);
      }
    },
  },
  {
    id: 2,
    name: "Row-level JSON exports are optional (operator screenshots accepted)",
    run: () => {
      const status = evidenceCompleteness();
      const anyPresent = status.some((s) => s.present && s.rowCount > 0);
      const review = read("docs/REMOTE_MIGRATION_EVIDENCE_REVIEW.md");
      check(
        !anyPresent || review.includes("EXACT_MATCH"),
        "if JSON exports exist, evidence review must document classifications",
      );
    },
  },
  {
    id: 3,
    name: "Historical migrations remain unchanged",
    run: () => {
      for (const file of HISTORICAL_MIGRATIONS) {
        const path = `supabase/migrations/${file}`;
        check(existsSync(join(ROOT, path)), path);
        const content = read(path);
        check(!content.includes("reconcile_"), `${file} was modified with reconciliation markers`);
      }
    },
  },
  {
    id: 4,
    name: "No additive remediation migrations remain in migration chain",
    run: () => {
      const remediation = readdirSync(join(ROOT, "supabase/migrations")).filter((f) =>
        f.startsWith("20260622"),
      );
      check(remediation.length === 0, `remediation files still present: ${remediation.join(", ")}`);
    },
  },
  {
    id: 5,
    name: "Repository documents no additive remediation required",
    run: () => {
      const review = read("docs/REMOTE_MIGRATION_EVIDENCE_REVIEW.md");
      const repair = read("docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md");
      check(review.includes("No additive remediation migration"), "evidence review");
      check(repair.includes("No additive remediation migration"), "repair sequence");
    },
  },
  {
    id: 6,
    name: "No automatic migration repair in remediation package",
    run: () => {
      const pkg = read("package.json");
      check(!pkg.includes("migration repair"), "repair in package.json scripts");
      for (const doc of ["docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md", "docs/MIGRATION_REMEDIATION_ROLLBACK.md"]) {
        const text = read(doc);
        check(text.includes("Human-operated") || text.includes("Human only"), doc);
      }
    },
  },
  {
    id: 7,
    name: "No remote database command execution in QA scripts",
    run: () => {
      const script = read("scripts/run-migration-remediation-validation.ts");
      check(!/\bsupabase\s+db\s+push\b/.test(script.replace(/check\([^)]+\)/g, "")), "forbidden push invocation");
      check(!/\bsupabase\s+migration\b/.test(script.replace(/check\([^)]+\)/g, "")), "forbidden migration CLI invocation");
    },
  },
  {
    id: 8,
    name: "Preflight SQL is read-only",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql").toLowerCase().replace(/--[^\n]*/g, "");
      check(/\bselect\b/.test(sql), "preflight missing SELECT");
      check(!/(^|\n)\s*(create|alter|drop|insert|update|delete|truncate)\s+/m.test(sql), "preflight has writes");
    },
  },
  {
    id: 9,
    name: "Post-remediation verification is read-only",
    run: () => {
      const sql = read("supabase/diagnostics/verify_remediation_result.sql").toLowerCase().replace(/--[^\n]*/g, "");
      check(/\bselect\b/.test(sql), "verify missing SELECT");
      check(!/(^|\n)\s*(create|alter|drop|insert|update|delete|truncate)\s+/m.test(sql), "verify has writes");
      check(sql.includes("schema_migrations"), "history informational probe");
    },
  },
  {
    id: 10,
    name: "Duplicate client-user detection exists in preflight",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(sql.includes("clients.user_id_duplicate_probe"), "duplicate probe");
      check(sql.includes("query_to_xml"), "safe duplicate probe");
    },
  },
  {
    id: 11,
    name: "Appointment-idempotency duplicate detection exists",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(sql.includes("appointment.idempotency_duplicate_probe"), "idempotency probe");
      check(sql.includes("creator_idempotency_duplicate_probe"), "creator idempotency probe");
    },
  },
  {
    id: 12,
    name: "Appointment-overlap detection exists",
    run: () => {
      check(read("supabase/diagnostics/preflight_remediation.sql").includes("appointment.overlap_probe"), "overlap probe");
    },
  },
  {
    id: 13,
    name: "Invalid status detection exists",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      for (const probe of [
        "invalid_source_probe",
        "invalid_notification_status_probe",
        "invalid_calendar_sync_status_probe",
      ]) {
        check(sql.includes(probe), probe);
      }
    },
  },
  {
    id: 14,
    name: "Invalid date-of-birth detection exists",
    run: () => {
      check(read("supabase/diagnostics/preflight_remediation.sql").includes("invalid_date_of_birth_probe"), "dob probe");
    },
  },
  {
    id: 15,
    name: "Dedicated deep diagnostics exist for all six pre-Phase-9 migrations",
    run: () => {
      for (const [version, file] of Object.entries(DEDICATED_DIAGNOSTICS)) {
        check(existsSync(join(ROOT, `supabase/diagnostics/${file}`)), `${version} missing ${file}`);
      }
    },
  },
  {
    id: 16,
    name: "History repair order matches operator-verified migrations",
    run: () => {
      check(
        PRE_PHASE9_HISTORY_REPAIR_ORDER.join(",") === OPERATOR_VERIFIED_EXACT_MATCH_MIGRATIONS.join(","),
        "repair order constant mismatch",
      );
      const seq = read("docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md");
      for (const version of PRE_PHASE9_HISTORY_REPAIR_ORDER) {
        check(seq.includes(version), `repair sequence missing ${version}`);
      }
    },
  },
  {
    id: 17,
    name: "Migration repair documented as history-only (not schema application)",
    run: () => {
      const seq = read("docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md");
      const plan = read("docs/MIGRATION_RECONCILIATION_PLAN.md");
      check(seq.includes("migration history only") || seq.includes("history only"), "repair sequence");
      check(plan.includes("migration history only") || plan.includes("history only"), "reconciliation plan");
    },
  },
  {
    id: 18,
    name: "Rollback documentation covers history repair reversal",
    run: () => {
      check(existsSync(join(ROOT, "docs/MIGRATION_REMEDIATION_ROLLBACK.md")), "rollback doc");
      const doc = read("docs/MIGRATION_REMEDIATION_ROLLBACK.md");
      check(doc.includes("reverted") || doc.includes("revert"), "history revert guidance");
      check(doc.includes("does not") && doc.includes("schema"), "schema vs history distinction");
    },
  },
  {
    id: 19,
    name: "History repair sequence documents post-repair validation",
    run: () => {
      const doc = read("docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md");
      check(doc.includes("migration list"), "migration list");
      check(doc.includes("db push --dry-run"), "dry-run");
      check(doc.includes("Phase 9"), "Phase 9 next");
    },
  },
  {
    id: 20,
    name: "Phase 9 migrations are not included in pre-Phase-9 history repair",
    run: () => {
      const seq = read("docs/MIGRATION_HISTORY_REPAIR_SEQUENCE.md");
      check(seq.includes("Do not") && seq.includes("Phase 9"), "Phase 9 exclusion");
      for (const version of ["202606200001", "202606200007"]) {
        check(!seq.includes(`migration repair --status applied ${version}`), `repair must not include ${version}`);
      }
    },
  },
  {
    id: 21,
    name: "TypeScript remediation modules exist",
    run: () => {
      check(existsSync(join(ROOT, "scripts/migration-evidence.ts")), "migration-evidence");
      check(read("scripts/classify-migration-drift.ts").includes("compareRemediationSnapshots"), "compare fn");
    },
  },
  {
    id: 22,
    name: "Evidence review documents operator EXACT_MATCH verdict",
    run: () => {
      const doc = read("docs/REMOTE_MIGRATION_EVIDENCE_REVIEW.md");
      check(doc.includes("OPERATOR-VERIFIED"), "verdict header");
      for (const version of OPERATOR_VERIFIED_EXACT_MATCH_MIGRATIONS) {
        check(doc.includes(version) && doc.includes("EXACT_MATCH"), `${version} EXACT_MATCH`);
      }
      check(doc.includes("No additive remediation migration"), "no remediation required");
    },
  },
  {
    id: 23,
    name: "Classifier warns on history/schema drift",
    run: () => {
      const ts = read("scripts/classify-migration-drift.ts");
      check(ts.includes("SCHEMA_EXACT_HISTORY_PENDING"), "schema exact warning");
      check(ts.includes("HISTORY_APPLIED_SCHEMA_PARTIAL"), "partial warning");
    },
  },
  {
    id: 24,
    name: "Preflight is a single executable SQL statement",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(countExecutableStatements(sql) === 1, "preflight must be one statement");
    },
  },
  {
    id: 25,
    name: "No cross-statement CTE references in preflight",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      const errors = findCrossStatementCteReferences(sql, [
        "clients_exists",
        "duplicate_user_id",
        "appt_counts",
        "resolved",
      ]);
      check(errors.length === 0, errors.join("; "));
    },
  },
  {
    id: 26,
    name: "clients_exists is statement-local in preflight",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(sql.includes("WITH clients_exists AS"), "clients_exists declaration");
      const errors = findCrossStatementCteReferences(sql, ["clients_exists"]);
      check(errors.length === 0, "clients_exists out of scope");
    },
  },
  {
    id: 27,
    name: "Missing clients table returns UNKNOWN not crash semantics",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(sql.includes("WHEN NOT (SELECT ok FROM clients_exists) THEN 'UNKNOWN'"), "clients unknown path");
      check(sql.includes("query_to_xml"), "clients duplicate probe uses query_to_xml");
      check(sql.includes("references.clients_table"), "clients catalog gate");
    },
  },
  {
    id: 28,
    name: "Missing appointment tables use catalog gates",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(sql.includes("appointments_exists"), "appointments gate");
      check(sql.includes("WHEN NOT (SELECT ok FROM appt_counts) THEN 'UNKNOWN'"), "appointments unknown path");
      check(sql.includes("references.adviser_appointments_table"), "appointments catalog gate");
    },
  },
  {
    id: 29,
    name: "Missing advisor_tasks table uses catalog gates",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(sql.includes("advisor_tasks_exists"), "tasks gate");
      check(sql.includes("WHEN NOT (SELECT ok FROM advisor_tasks_exists) THEN 'UNKNOWN'"), "tasks unknown path");
    },
  },
  {
    id: 30,
    name: "All required preflight probes remain represented",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      for (const probe of PREFLIGHT_REQUIRED_PROBES) {
        check(sql.includes(probe), `missing ${probe}`);
      }
      check(sql.includes("references.users_table"), "users reference probe");
    },
  },
  {
    id: 31,
    name: "Preflight probe output columns are standardized",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      check(sql.includes("SELECT probe_id, classification, detail"), "output columns");
      for (const level of ["READY", "WARNING", "BLOCKER", "UNKNOWN"]) {
        check(sql.includes(`'${level}'`), level);
      }
    },
  },
  {
    id: 32,
    name: "No temporary or persistent helper objects in preflight",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql").toLowerCase();
      check(!/\bcreate\s+(temp|temporary)\b/.test(sql), "temp table");
      check(!/\bcreate\s+(or\s+replace\s+)?function\b/.test(sql), "function");
      check(!/\bcreate\s+view\b/.test(sql), "view");
    },
  },
  {
    id: 33,
    name: "Deep diagnostic rollups re-declare resolved CTE chain",
    run: () => {
      for (const file of [
        "verify_202606100020_google_calendar_booking.sql",
        "verify_202606150001_clients_user_id_unique.sql",
        "verify_202606100021_performance_indexes.sql",
        "verify_202606180001_birthday_reminders.sql",
        "verify_202606180002_adviser_created_appointments.sql",
      ]) {
        const sql = read(`supabase/diagnostics/${file}`);
        check(sql.includes("CTE chain re-declared"), `${file} missing rollup CTE re-declaration`);
        check(
          /CTE chain re-declared[\s\S]*\bresolved\s+AS\s*\([\s\S]*\bFROM\s+resolved\b/i.test(sql),
          `${file} rollup must declare resolved before FROM resolved`,
        );
      }
    },
  },
];

function main(): void {
  console.log(`Migration remediation validation — ${tests.length} structural checks\n`);
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
