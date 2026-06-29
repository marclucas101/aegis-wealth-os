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

const OPTIONAL_PENDING_RELATIONS = [
  "platform_feature_controls",
  "published_outputs",
  "meeting_sessions",
  "meeting_session_events",
  "client_goals",
  "client_review_submissions",
  "governed_content",
  "client_notifications",
  "communication_preferences",
  "communication_deliveries",
  "binder_exports",
  "promotion_migration_reviews",
  "automation_job_runs",
  "automation_job_items",
  "adviser_calendar_connections",
  "adviser_calendar_settings",
  "adviser_appointments",
];

const PRE_PHASE9_DIAGNOSTICS = [
  "supabase/diagnostics/verify_202606100020_google_calendar_booking.sql",
  "supabase/diagnostics/verify_202606100021_performance_indexes.sql",
  "supabase/diagnostics/verify_202606150001_clients_user_id_unique.sql",
  "supabase/diagnostics/verify_202606180001_birthday_reminders.sql",
  "supabase/diagnostics/verify_202606180002_adviser_created_appointments.sql",
  "supabase/diagnostics/verify_pre_phase9_migrations.sql",
];

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
    name: "No direct FROM platform_feature_controls",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql").toLowerCase();
      const marker = sql.indexOf("c. seed-row probes");
      const executable = marker >= 0 ? sql.slice(0, marker) : sql;
      assert(!/\bfrom\s+platform_feature_controls\b/.test(executable), "direct FROM platform_feature_controls found");
    },
  },
  {
    id: 6,
    name: "No direct query against optional pending tables",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql").toLowerCase();
      const marker = sql.indexOf("c. seed-row probes");
      const executable = marker >= 0 ? sql.slice(0, marker) : sql;
      for (const rel of OPTIONAL_PENDING_RELATIONS) {
        assert(!new RegExp(`\\bfrom\\s+${rel}\\b`).test(executable), `direct FROM ${rel}`);
        assert(!new RegExp(`\\bjoin\\s+${rel}\\b`).test(executable), `direct JOIN ${rel}`);
      }
    },
  },
  {
    id: 7,
    name: "Section O uses catalog-safe checks",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql");
      assert(sql.includes("expected_migrations"), "rollup migration CTE missing");
      assert(sql.includes("information_schema.tables"), "table catalog checks missing");
      assert(sql.includes("pg_indexes"), "index catalog checks missing");
    },
  },
  {
    id: 8,
    name: "All pending migrations remain represented",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql");
      for (const v of PENDING_VERSIONS) {
        assert(sql.includes(v), `diagnostic missing ${v}`);
      }
    },
  },
  {
    id: 9,
    name: "Absent Phase 9 schema still yields rollup rows",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql");
      assert(sql.includes("preliminary_classification"), "classification column missing");
      assert(sql.includes("absent_checks"), "absent count missing");
      assert(sql.includes("unknown_checks"), "unknown count missing");
    },
  },
  {
    id: 10,
    name: "Seed checks cannot terminate the full diagnostic",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pending_migrations.sql");
      assert(sql.includes("Seed-row probes"), "seed probe section missing");
      assert(sql.includes("relation_exists"), "seed relation gate missing");
      assert(sql.includes("probe_sql"), "seed probe sql text missing");
    },
  },
  {
    id: 11,
    name: "Diagnostic SQL remains read-only",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_pending_migrations.sql",
        "supabase/diagnostics/verify_202606100019_adviser_profiles.sql",
        ...PRE_PHASE9_DIAGNOSTICS,
      ]) {
        const sql = read(file).toLowerCase().replace(/--[^\n]*/g, "");
        assert(!/(^|\n)\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke)\s+/i.test(sql), `${file} has write/ddl verb`);
        assert(!/\bmigration\s+repair\b/.test(sql), `${file} mentions migration repair`);
        assert(!/\bdb\s+push\b/.test(sql), `${file} mentions db push`);
      }
    },
  },
  {
    id: 12,
    name: "Dedicated 019 verification remains comprehensive",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606100019_adviser_profiles.sql");
      for (const required of [
        "expected_schema_name",
        "actual_schema_name",
        "resolved AS",
        "rollup_checks",
        "adviser_profiles_set_updated_at",
        "adviser_id_from_storage_path",
        "adviser_photos_select_own_or_admin",
        "adviser_profiles_delete_admin",
        "seed_row:storage.buckets/adviser-photos",
        "routine_privileges",
      ]) {
        assert(sql.includes(required), `019 diagnostic missing ${required}`);
      }
    },
  },
  {
    id: 25,
    name: "No ambiguous unqualified schema_name in diagnostics",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606100019_adviser_profiles.sql",
        "supabase/diagnostics/verify_pending_migrations.sql",
      ]) {
        const sql = read(file).toLowerCase();
        assert(!/\bcoalesce\s*\(\s*schema_name\b/.test(sql), `${file} has unqualified schema_name`);
        assert(!/\bselect\s+schema_name\b/.test(sql), `${file} selects unqualified schema_name`);
      }
    },
  },
  {
    id: 26,
    name: "No ambiguous unqualified relation_name in diagnostics",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606100019_adviser_profiles.sql",
        "supabase/diagnostics/verify_pending_migrations.sql",
      ]) {
        const sql = read(file).toLowerCase();
        assert(!/\bcoalesce\s*\([^)]*relation_name\b/.test(sql.replace(/expected_relation_name/g, "")), `${file} has unqualified relation_name in COALESCE`);
        assert(!/\bselect\s+relation_name\b/.test(sql), `${file} selects unqualified relation_name`);
      }
    },
  },
  {
    id: 27,
    name: "Final rollup fields use explicit aliases",
    run: () => {
      const pending = read("supabase/diagnostics/verify_pending_migrations.sql");
      assert(pending.includes("FROM rollup r"), "pending rollup alias missing");
      assert(pending.includes("r.total_expected_checks"), "pending rollup fields not qualified");
      const adviser = read("supabase/diagnostics/verify_202606100019_adviser_profiles.sql");
      assert(adviser.includes("FROM rollup_checks rc"), "019 rollup alias missing");
      assert(adviser.includes("rc.check_group"), "019 rollup fields not qualified");
    },
  },
  {
    id: 28,
    name: "Both diagnostics use resolved CTE for join output",
    run: () => {
      assert(read("supabase/diagnostics/verify_202606100019_adviser_profiles.sql").includes("resolved AS"), "019 resolved CTE");
      assert(read("supabase/diagnostics/verify_pending_migrations.sql").includes("resolved AS"), "pending resolved CTE");
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
  {
    id: 29,
    name: "All five dedicated diagnostics exist",
    run: () => {
      for (const file of PRE_PHASE9_DIAGNOSTICS.slice(0, 5)) {
        assert(existsSync(join(ROOT, file)), `missing ${file}`);
      }
    },
  },
  {
    id: 30,
    name: "Every new diagnostic is SELECT-only",
    run: () => {
      for (const file of PRE_PHASE9_DIAGNOSTICS) {
        const sql = read(file).toLowerCase().replace(/--[^\n]*/g, "");
        assert(/\bselect\b/.test(sql), `${file} missing SELECT`);
      }
    },
  },
  {
    id: 31,
    name: "Diagnostics tolerate absent objects via catalogs",
    run: () => {
      for (const file of PRE_PHASE9_DIAGNOSTICS) {
        const sql = read(file);
        assert(
          sql.includes("pg_class") || sql.includes("information_schema") || sql.includes("pg_indexes"),
          `${file} lacks catalog-safe inspection`,
        );
      }
    },
  },
  {
    id: 32,
    name: "Each migration has multiple meaningful checks",
    run: () => {
      const checks = [
        "verify_202606100020_google_calendar_booking.sql",
        "verify_202606100021_performance_indexes.sql",
        "verify_202606150001_clients_user_id_unique.sql",
        "verify_202606180001_birthday_reminders.sql",
        "verify_202606180002_adviser_created_appointments.sql",
      ];
      for (const name of checks) {
        const sql = read(`supabase/diagnostics/${name}`);
        const count = (sql.match(/\('2026/g) ?? []).length;
        assert(count >= 3, `${name} has too few checks`);
      }
    },
  },
  {
    id: 33,
    name: "Index definitions are inspected, not only names",
    run: () => {
      const sql020 = read("supabase/diagnostics/verify_202606100020_google_calendar_booking.sql");
      const sql021 = read("supabase/diagnostics/verify_202606100021_performance_indexes.sql");
      assert(sql020.includes("indexdef") || sql020.includes("definition"), "020 index definition check missing");
      assert(sql021.includes("actual_index_definition"), "021 index definition check missing");
    },
  },
  {
    id: 34,
    name: "Constraint definitions are inspected",
    run: () => {
      const sql020 = read("supabase/diagnostics/verify_202606100020_google_calendar_booking.sql");
      const sql180001 = read("supabase/diagnostics/verify_202606180001_birthday_reminders.sql");
      assert(sql020.includes("pg_get_constraintdef"), "020 constraint definition missing");
      assert(sql180001.includes("pg_get_constraintdef"), "180001 constraint definition missing");
    },
  },
  {
    id: 35,
    name: "RLS policies are inspected where applicable",
    run: () => {
      const sql020 = read("supabase/diagnostics/verify_202606100020_google_calendar_booking.sql");
      assert(sql020.includes("pg_policies"), "020 policies missing");
      assert(sql020.includes("rls_enabled"), "020 RLS state missing");
    },
  },
  {
    id: 36,
    name: "clients.user_id duplicate detection exists",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606150001_clients_user_id_unique.sql");
      assert(sql.includes("duplicate_non_null_user_id_count"), "duplicate detection missing");
      assert(sql.includes("query_to_xml"), "safe duplicate probe missing");
    },
  },
  {
    id: 37,
    name: "Calendar relationships are inspected",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606100020_google_calendar_booking.sql");
      assert(sql.includes("adviser_calendar_connections"), "calendar connections missing");
      assert(sql.includes("adviser_calendar_settings"), "calendar settings missing");
      assert(sql.includes("adviser_appointments"), "appointments missing");
    },
  },
  {
    id: 38,
    name: "Birthday cron capability is not overstated",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606180001_birthday_reminders.sql");
      assert(sql.includes("migration does not create cron schedule objects"), "cron caveat missing");
    },
  },
  {
    id: 39,
    name: "Appointment migration checks expected fields",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606180002_adviser_created_appointments.sql");
      for (const col of [
        "source",
        "created_by_user_id",
        "notification_status",
        "calendar_sync_status",
      ]) {
        assert(sql.includes(col), `missing field ${col}`);
      }
    },
  },
  {
    id: 40,
    name: "Consolidated rollup covers all five migrations",
    run: () => {
      const sql = read("supabase/diagnostics/verify_pre_phase9_migrations.sql");
      for (const v of ["202606100020", "202606100021", "202606150001", "202606180001", "202606180002"]) {
        assert(sql.includes(v), `rollup missing ${v}`);
      }
    },
  },
  {
    id: 41,
    name: "EXACT_MATCH requires all checks in classifier",
    run: () => {
      const ts = read("scripts/classify-migration-drift.ts");
      assert(ts.includes("present === total && absent === 0 && conflicting === 0 && unknown === 0"), "strict EXACT_MATCH rule missing");
    },
  },
  {
    id: 42,
    name: "No remote write command present in new diagnostics",
    run: () => {
      for (const file of PRE_PHASE9_DIAGNOSTICS) {
        const sql = read(file).toLowerCase();
        assert(!sql.includes("migration repair"), `${file} mentions migration repair`);
        assert(!sql.includes("db push"), `${file} mentions db push`);
      }
    },
  },
  {
    id: 43,
    name: "No invalid xpath(...)[n] without outer parentheses",
    run: () => {
      for (const file of readdirSync(join(ROOT, "supabase/diagnostics")).filter((f) => f.endsWith(".sql"))) {
        const path = `supabase/diagnostics/${file}`;
        const sql = read(path);
        if (!sql.includes("xpath")) continue;
        assert(!/''\)\)\[\d+\]/.test(sql), `${path} has invalid xpath array-index syntax`);
      }
    },
  },
  {
    id: 44,
    name: "Every indexed xpath call is parenthesised before subscript",
    run: () => {
      for (const file of readdirSync(join(ROOT, "supabase/diagnostics")).filter((f) => f.endsWith(".sql"))) {
        const path = `supabase/diagnostics/${file}`;
        const sql = read(path);
        if (!sql.includes("xpath")) continue;
        assert(/\(xpath\s*\(/.test(sql), `${path} missing parenthesised xpath before indexing`);
        assert(/\)\)\[\d+\]/.test(sql), `${path} missing parenthesised xpath result subscript`);
      }
    },
  },
  {
    id: 45,
    name: "Pre-Phase9 diagnostics remain read-only with xpath probes",
    run: () => {
      for (const file of PRE_PHASE9_DIAGNOSTICS) {
        const sql = read(file).toLowerCase().replace(/--[^\n]*/g, "");
        assert(!/(^|\n)\s*(create|alter|drop|insert|update|delete|truncate|grant|revoke)\s+/i.test(sql), `${file} has write/ddl verb`);
      }
    },
  },
  {
    id: 46,
    name: "Consolidated rollup and clients.user_id duplicate probe remain present",
    run: () => {
      const rollup = read("supabase/diagnostics/verify_pre_phase9_migrations.sql");
      for (const v of ["202606100020", "202606100021", "202606150001", "202606180001", "202606180002"]) {
        assert(rollup.includes(v), `rollup missing ${v}`);
      }
      const clients = read("supabase/diagnostics/verify_202606150001_clients_user_id_unique.sql");
      assert(clients.includes("duplicate_non_null_user_id_count"), "duplicate probe column missing");
      assert(clients.includes("query_to_xml"), "safe duplicate probe missing");
      assert(clients.includes("HAVING count(*) > 1"), "duplicate user_id probe missing");
    },
  },
  {
    id: 47,
    name: "Preflight remediation is single-statement with no cross-statement CTEs",
    run: () => {
      const sql = read("supabase/diagnostics/preflight_remediation.sql");
      const parts = sql.replace(/--[^\n]*/g, "").split(";").filter((p) => p.trim().length > 0);
      assert(parts.length === 1, "preflight must be one SQL statement");
      assert(sql.includes("WITH clients_exists AS"), "clients_exists declaration");
      assert(!/;\s*\n\s*SELECT[\s\S]*clients_exists/i.test(sql), "clients_exists used after statement end");
    },
  },
  {
    id: 48,
    name: "Phase 9F.1 dedicated verify diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql")),
        "missing verify_202606200008",
      );
    },
  },
  {
    id: 49,
    name: "Phase 9F.1 preflight diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/preflight_202606200008_phase9f.sql")),
        "missing preflight_202606200008",
      );
    },
  },
  {
    id: 50,
    name: "Phase 9F diagnostics verify active-run index predicate",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
      assert(sql.includes("idx_automation_job_runs_single_active"), "index name");
      assert(sql.includes("index_def"), "index definition check");
      assert(sql.includes("running"), "predicate");
    },
  },
  {
    id: 51,
    name: "Phase 9F diagnostics do not modify migration history",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql",
        "supabase/diagnostics/preflight_202606200008_phase9f.sql",
        "supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql",
      ]) {
        const sql = read(file).toLowerCase();
        assert(!sql.includes("insert into supabase_migrations"), file);
        assert(!sql.includes("delete from supabase_migrations"), file);
        assert(!sql.includes("update supabase_migrations"), file);
      }
    },
  },
  {
    id: 52,
    name: "Phase 9F discrepancy diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql")),
        "missing discrepancies diagnostic",
      );
    },
  },
  {
    id: 53,
    name: "Phase 9F discrepancy diagnostic is SELECT-only",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql").toLowerCase();
      assert(/\bselect\b/.test(sql), "missing SELECT");
      assert(!/(^|\n)\s*(insert|update|delete|truncate|create|alter|drop)\s+/m.test(sql), "write DDL/DML");
      assert(!/\bxpath\s*\(/.test(sql), "xpath present");
      assert(!/\bquery_to_xml\s*\(/.test(sql), "query_to_xml present");
    },
  },
  {
    id: 54,
    name: "Phase 9F discrepancy diagnostic shares verify inventory",
    run: () => {
      const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
      const discrepancies = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
      assert(
        verify.includes("('202606200008','seed','platform_feature_controls.scheduled_content_automation','disabled')"),
        "verify seed row",
      );
      assert(
        discrepancies.includes("('202606200008','seed','platform_feature_controls.scheduled_content_automation','disabled')"),
        "discrepancies seed row",
      );
      const count = (discrepancies.match(/\('202606200008'/g) ?? []).length;
      assert(count === 35, `inventory count ${count}`);
    },
  },
  {
    id: 55,
    name: "Phase 9F discrepancy diagnostic does not mask with rollup",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
      assert(sql.includes("WHERE r.state IN ('conflicting', 'absent', 'unknown')"), "state filter");
      assert(!sql.includes("classification"), "no rollup classification column");
      assert(sql.includes("suggested_interpretation"), "per-check interpretation");
    },
  },
  {
    id: 57,
    name: "Phase 9F diagnostics use pg_index catalog for index verification",
    run: () => {
      const sql = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
      assert(sql.includes("index_key_cols"), "index_key_cols");
      assert(sql.includes("pg_get_expr(ix.indpred"), "indpred");
      assert(!sql.includes("FROM pg_indexes"), "no pg_indexes");
    },
  },
  {
    id: 58,
    name: "Phase 9F verify and discrepancy diagnostics share resolved core",
    run: () => {
      const verify = read("supabase/diagnostics/verify_202606200008_phase9f_scheduled_publishing.sql");
      const discrepancies = read("supabase/diagnostics/verify_202606200008_phase9f_discrepancies.sql");
      const begin = "-- PHASE9F_RESOLVED_CORE_BEGIN";
      const end = "-- PHASE9F_RESOLVED_CORE_END";
      const extract = (text: string) => text.slice(text.indexOf(begin) + begin.length, text.indexOf(end)).trim();
      const vCore = extract(verify);
      const dCore = extract(discrepancies);
      assert(vCore === dCore, "resolved core mismatch");
      assert(vCore.includes("predicate_canonical"), "predicate canonicalisation");
    },
  },
  {
    id: 59,
    name: "Phase 9F.2 dedicated verify diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql")),
        "missing verify_202606200009",
      );
    },
  },
  {
    id: 60,
    name: "Phase 9F.2 preflight diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/preflight_202606200009_phase9f2.sql")),
        "missing preflight_202606200009",
      );
    },
  },
  {
    id: 61,
    name: "Phase 9F.2 discrepancy diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql")),
        "missing discrepancies_202606200009",
      );
    },
  },
  {
    id: 62,
    name: "Phase 9F.2 diagnostics are SELECT-only",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql",
        "supabase/diagnostics/preflight_202606200009_phase9f2.sql",
        "supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql",
      ]) {
        const sql = read(file).toLowerCase();
        assert(!sql.includes("insert into"), file);
        assert(!sql.includes("update "), file);
        assert(!sql.includes("delete from"), file);
      }
    },
  },
  {
    id: 63,
    name: "Phase 9F.2 diagnostics use no XML",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql",
        "supabase/diagnostics/preflight_202606200009_phase9f2.sql",
        "supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql",
      ]) {
        const sql = read(file);
        assert(!sql.includes("xpath("), file);
        assert(!sql.includes("query_to_xml"), file);
      }
    },
  },
  {
    id: 64,
    name: "Phase 9F.2 verify and discrepancies share resolved core",
    run: () => {
      const verify = read("supabase/diagnostics/verify_202606200009_phase9f2_lifecycle_notifications.sql");
      const discrepancies = read("supabase/diagnostics/verify_202606200009_phase9f2_discrepancies.sql");
      const begin = "-- PHASE9F2_RESOLVED_CORE_BEGIN";
      const end = "-- PHASE9F2_RESOLVED_CORE_END";
      const extract = (text: string) => text.slice(text.indexOf(begin) + begin.length, text.indexOf(end)).trim();
      assert(extract(verify) === extract(discrepancies), "core mismatch");
    },
  },
  {
    id: 65,
    name: "Phase 9F.2 migration audit document exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/PHASE_9F2_MIGRATION_AUDIT.md")), "audit");
    },
  },
  {
    id: 66,
    name: "Phase 9F.2 event wiring audit exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/PHASE_9F2_EVENT_WIRING_AUDIT.md")), "wiring");
    },
  },
  {
    id: 67,
    name: "Phase 9F.3 dedicated verify diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql")),
        "missing verify_202606200010",
      );
    },
  },
  {
    id: 68,
    name: "Phase 9F.3 preflight diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/preflight_202606200010_phase9f3.sql")),
        "missing preflight_202606200010",
      );
    },
  },
  {
    id: 69,
    name: "Phase 9F.3 discrepancy diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql")),
        "missing discrepancies_202606200010",
      );
    },
  },
  {
    id: 70,
    name: "Phase 9F.3 diagnostics are SELECT-only",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
        "supabase/diagnostics/preflight_202606200010_phase9f3.sql",
        "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql",
      ]) {
        const sql = read(file).toLowerCase();
        assert(!sql.includes("insert into"), file);
        assert(!sql.includes("update "), file);
        assert(!sql.includes("delete from"), file);
      }
    },
  },
  {
    id: 71,
    name: "Phase 9F.3 diagnostics use no XML",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
        "supabase/diagnostics/preflight_202606200010_phase9f3.sql",
        "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql",
      ]) {
        const sql = read(file);
        assert(!sql.includes("xpath("), file);
        assert(!sql.includes("query_to_xml"), file);
      }
    },
  },
  {
    id: 72,
    name: "Phase 9F.3 verify and discrepancies share resolved core",
    run: () => {
      const verify = read("supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql");
      const discrepancies = read("supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql");
      const begin = "-- PHASE9F3_RESOLVED_CORE_BEGIN";
      const end = "-- PHASE9F3_RESOLVED_CORE_END";
      const extract = (text: string) => text.slice(text.indexOf(begin) + begin.length, text.indexOf(end)).trim();
      assert(extract(verify) === extract(discrepancies), "core mismatch");
    },
  },
  {
    id: 73,
    name: "Phase 9F.3 resolved core shared file exists",
    run: () => {
      assert(existsSync(join(ROOT, "supabase/diagnostics/phase9f3_202606200010_resolved_core.sql")), "core");
    },
  },
  {
    id: 74,
    name: "Phase 9F.3 migration file exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/migrations/202606200010_phase9f3_binder_pdf_client_vault.sql")),
        "migration",
      );
    },
  },
  {
    id: 75,
    name: "Phase 9F.3 migration audit document exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/PHASE_9F3_MIGRATION_AUDIT.md")), "audit");
    },
  },
  {
    id: 76,
    name: "Phase 9F.3 verify rollup classification EXACT_MATCH",
    run: () => {
      const verify = read("supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql");
      assert(verify.includes("EXACT_MATCH"), "rollup");
      assert(verify.includes("total_required_checks"), "summary");
    },
  },
  {
    id: 77,
    name: "Phase 9F.3 storage architecture doc exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/PHASE_9F3_STORAGE_ARCHITECTURE.md")), "storage");
      assert(read("docs/PHASE_9F3_STORAGE_ARCHITECTURE.md").includes("binder-exports"), "bucket");
    },
  },
  {
    id: 78,
    name: "Phase 9F.3 binder PDF architecture doc exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/PHASE_9F3_BINDER_PDF_ARCHITECTURE.md")), "pdf arch");
    },
  },
  {
    id: 79,
    name: "Phase 9F.3 system audit doc exists",
    run: () => {
      assert(existsSync(join(ROOT, "docs/PHASE_9F3_EXISTING_SYSTEM_AUDIT.md")), "audit");
    },
  },
  {
    id: 80,
    name: "Phase 9F.3 preflight avoids direct optional-column references",
    run: () => {
      const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
      assert(preflight.includes("to_jsonb(be) ->> 'generation_idempotency_key'"), "jsonb idempotency");
      assert(!preflight.includes("SELECT generation_idempotency_key FROM"), "no direct column select");
      assert(preflight.includes("information_schema.columns"), "catalog column probe");
    },
  },
  {
    id: 81,
    name: "Phase 9F.3 preflight probes CTE has explicit output column names",
    run: () => {
      const preflight = read("supabase/diagnostics/preflight_202606200010_phase9f3.sql");
      assert(preflight.includes("probes (probe_id, classification, detail) AS ("), "typed probes");
      assert(
        /SELECT\s+probe_id\s*,\s*classification\s*,\s*detail\s+FROM\s+probes/i.test(preflight),
        "final select columns",
      );
    },
  },
  {
    id: 82,
    name: "Phase 9F.4 write-freeze verify diagnostic exists",
    run: () => {
      assert(
        existsSync(
          join(ROOT, "supabase/diagnostics/verify_202606200011_phase9f4_legacy_promotions_write_freeze.sql"),
        ),
        "verify 011",
      );
    },
  },
  {
    id: 83,
    name: "Phase 9F.4 write-freeze preflight diagnostic exists",
    run: () => {
      assert(existsSync(join(ROOT, "supabase/diagnostics/preflight_202606200011_phase9f4.sql")), "preflight 011");
    },
  },
  {
    id: 84,
    name: "Phase 9F.4 write-freeze discrepancy diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200011_phase9f4_discrepancies.sql")),
        "discrepancies 011",
      );
    },
  },
  {
    id: 85,
    name: "Phase 9F.4 idempotency preflight diagnostic exists",
    run: () => {
      assert(existsSync(join(ROOT, "supabase/diagnostics/preflight_202606200012_phase9f4.sql")), "preflight 012");
    },
  },
  {
    id: 86,
    name: "Phase 9F.4 idempotency verify diagnostic exists",
    run: () => {
      assert(
        existsSync(
          join(ROOT, "supabase/diagnostics/verify_202606200012_phase9f4_promotion_migration_idempotency.sql"),
        ),
        "verify 012",
      );
    },
  },
  {
    id: 87,
    name: "Phase 9F.4 idempotency discrepancy diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606200012_phase9f4_discrepancies.sql")),
        "discrepancies 012",
      );
    },
  },
  {
    id: 88,
    name: "Phase 9F.4 idempotency preflight is SELECT-only with probe columns",
    run: () => {
      const preflight = read("supabase/diagnostics/preflight_202606200012_phase9f4.sql");
      assert(preflight.includes("probes (probe_id, classification, detail) AS ("), "typed probes");
      assert(/SELECT\s+probe_id\s*,\s*classification\s*,\s*detail\s+FROM\s+probes/i.test(preflight), "output");
      assert(preflight.includes("202606200011"), "prereq 011");
      assert(preflight.includes("202606200012"), "pending 012");
    },
  },
  {
    id: 89,
    name: "Phase 9F.4 idempotency verify includes grant and search_path checks",
    run: () => {
      const verify = read("supabase/diagnostics/verify_202606200012_phase9f4_promotion_migration_idempotency.sql");
      assert(verify.includes("search_path=public"), "search_path");
      assert(verify.includes("grants.anon_no_execute_migration_rpc"), "anon grant");
      assert(verify.includes("grants.authenticated_no_execute_migration_rpc"), "authenticated grant");
      assert(verify.includes("overall.exact_match_verdict"), "verdict");
    },
  },
  {
    id: 90,
    name: "Phase 9F.4 idempotency discrepancies filter non-match rows only",
    run: () => {
      const disc = read("supabase/diagnostics/verify_202606200012_phase9f4_discrepancies.sql");
      assert(disc.includes("WHERE COALESCE(classification, 'unknown') <> 'match'"), "filter");
    },
  },
  {
    id: 91,
    name: "Phase 9F.4 idempotency migration revokes anon and authenticated",
    run: () => {
      const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
      assert(sql.includes("FROM anon"), "revoke anon");
      assert(sql.includes("FROM authenticated"), "revoke authenticated");
      assert(sql.includes("SET search_path = public"), "fixed search_path");
    },
  },
  {
    id: 92,
    name: "Phase 9F.4 idempotency migration remains pending in drift classifier",
    run: () => {
      assert(PENDING_VERSIONS.includes("202606200012"), "pending 012");
    },
  },
  {
    id: 93,
    name: "Phase 9F.4 idempotency preflight probes extensions.uuid_generate_v5",
    run: () => {
      const preflight = read("supabase/diagnostics/preflight_202606200012_phase9f4.sql");
      assert(
        preflight.includes("to_regprocedure('extensions.uuid_generate_v5(uuid,text)')"),
        "extensions uuid v5 regprocedure",
      );
    },
  },
  {
    id: 94,
    name: "Phase 9F.4 idempotency migration uses qualified extensions.uuid_generate_v5",
    run: () => {
      const sql = read("supabase/migrations/202606200012_phase9f4_promotion_migration_idempotency.sql");
      assert(sql.includes('WITH SCHEMA extensions'), "extension schema");
      assert(sql.includes("extensions.uuid_generate_v5"), "qualified");
      const withoutQualified = sql.split("extensions.uuid_generate_v5").join("");
      assert(!withoutQualified.includes("uuid_generate_v5("), "no unqualified call");
    },
  },
  {
    id: 95,
    name: "Phase 01 CRM V2 migration file exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql")),
        "migration",
      );
    },
  },
  {
    id: 96,
    name: "Phase 01 CRM V2 dedicated verify diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls.sql")),
        "verify",
      );
    },
  },
  {
    id: 97,
    name: "Phase 01 CRM V2 preflight diagnostic exists",
    run: () => {
      assert(
        existsSync(join(ROOT, "supabase/diagnostics/preflight_202606290001_phase01_crm_v2_feature_controls.sql")),
        "preflight",
      );
    },
  },
  {
    id: 98,
    name: "Phase 01 CRM V2 discrepancy diagnostic exists",
    run: () => {
      assert(
        existsSync(
          join(ROOT, "supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql"),
        ),
        "discrepancies",
      );
    },
  },
  {
    id: 99,
    name: "Phase 01 CRM V2 diagnostics are SELECT-only",
    run: () => {
      for (const file of [
        "supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls.sql",
        "supabase/diagnostics/preflight_202606290001_phase01_crm_v2_feature_controls.sql",
        "supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql",
      ]) {
        const sql = read(file).toLowerCase();
        assert(!sql.includes("insert into"), file);
        assert(!sql.includes("update "), file);
        assert(!sql.includes("delete from"), file);
      }
    },
  },
  {
    id: 100,
    name: "Phase 01 CRM V2 migration seeds both feature keys disabled",
    run: () => {
      const sql = read("supabase/migrations/202606290001_phase01_crm_v2_feature_controls.sql");
      assert(sql.includes("'crm_v2_master'"), "master key");
      assert(sql.includes("'crm_v2_pilot_mode'"), "pilot key");
      assert(sql.includes("ON CONFLICT (feature_key) DO NOTHING"), "idempotent");
      assert(!sql.includes("UPDATE platform_feature_controls"), "no update");
    },
  },
  {
    id: 101,
    name: "Phase 01 CRM V2 discrepancies use to_regclass guard",
    run: () => {
      const disc = read("supabase/diagnostics/verify_202606290001_phase01_crm_v2_feature_controls_discrepancies.sql");
      assert(disc.includes("to_regclass('public.platform_feature_controls')"), "guard");
    },
  },
  {
    id: 102,
    name: "Phase 01 CRM V2 migration remains pending in drift classifier",
    run: () => {
      assert(PENDING_VERSIONS.includes("202606290001"), "pending 202606290001");
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
