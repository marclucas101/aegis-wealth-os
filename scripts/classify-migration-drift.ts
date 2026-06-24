/**
 * Classify pending migration drift from diagnostic snapshot JSON exports.
 * Does NOT connect to any database.
 *
 * Usage:
 *   npx tsx scripts/classify-migration-drift.ts --snapshot path/to/export.json
 *   npx tsx scripts/classify-migration-drift.ts --compare pre.json post.json
 *   npx tsx scripts/classify-migration-drift.ts --history path/to/history.json --schema path/to/schema.json
 *   npx tsx scripts/classify-migration-drift.ts --demo-absent
 */

import { readFileSync } from "node:fs";

import { PRE_PHASE9_HISTORY_REPAIR_ORDER } from "./migration-evidence";

export type DriftClassification =
  | "ABSENT"
  | "EXACT_MATCH"
  | "PARTIAL_MATCH"
  | "CONFLICTING"
  | "BLOCKED_BY_DEPENDENCY"
  | "UNKNOWN";

export type MigrationCheck = {
  migration: string;
  check_id: string;
  present: boolean;
  state?: string;
  match_status?: string;
  total_required_checks?: number;
  present_checks?: number;
  absent_checks?: number;
  conflicting_checks?: number;
  unknown_checks?: number;
  classification?: string;
};

export type MigrationHistoryRow = {
  version: string;
  applied: boolean;
};

export type MigrationManifest = {
  version: string;
  name: string;
  dependsOn: string[];
  requiredChecks: string[];
};

export const PENDING_MIGRATIONS: MigrationManifest[] = [
  {
    version: "202606100019",
    name: "adviser_profiles",
    dependsOn: ["202606100018"],
    requiredChecks: [
      "adviser_profiles_table",
      "adviser_profiles_rls_policies",
      "adviser_photos_bucket",
      "adviser_photos_storage_policies",
    ],
  },
  {
    version: "202606100020",
    name: "google_calendar_booking",
    dependsOn: ["202606100019"],
    requiredChecks: ["calendar_tables"],
  },
  {
    version: "202606100021",
    name: "phase6f_performance_indexes",
    dependsOn: ["202606100018"],
    requiredChecks: ["performance_indexes"],
  },
  {
    version: "202606150001",
    name: "clients_user_id_unique",
    dependsOn: ["202606100003"],
    requiredChecks: ["clients_user_id_unique"],
  },
  {
    version: "202606180001",
    name: "phase8a_client_birthday_reminders",
    dependsOn: ["202606100013"],
    requiredChecks: ["birthday_columns"],
  },
  {
    version: "202606180002",
    name: "phase8b_adviser_created_appointments",
    dependsOn: ["202606100020"],
    requiredChecks: ["appointment_source_column"],
  },
  {
    version: "202606200001",
    name: "phase9a_compliance_access_architecture",
    dependsOn: ["202606100003"],
    requiredChecks: ["phase9a_core"],
  },
  {
    version: "202606200002",
    name: "phase9a_publication_hardening",
    dependsOn: ["202606200001"],
    requiredChecks: ["one_current_published_index"],
  },
  {
    version: "202606200003",
    name: "phase9c_meeting_studio",
    dependsOn: ["202606200001", "202606100020"],
    requiredChecks: ["meeting_studio_tables"],
  },
  {
    version: "202606200004",
    name: "phase9c_meeting_studio_rls_documentation",
    dependsOn: ["202606200003"],
    requiredChecks: ["meeting_policy_comments"],
  },
  {
    version: "202606200005",
    name: "phase9d_converted_client_portal",
    dependsOn: ["202606200001", "202606100007"],
    requiredChecks: ["client_goals_table"],
  },
  {
    version: "202606200006",
    name: "phase9e_communications_governance",
    dependsOn: ["202606200001", "202606100016"],
    requiredChecks: ["governed_content_table"],
  },
  {
    version: "202606200007",
    name: "phase9e_hardening",
    dependsOn: ["202606200006"],
    requiredChecks: ["idempotency_indexes"],
  },
  {
    version: "202606200008",
    name: "phase9f_scheduled_publishing",
    dependsOn: ["202606200007"],
    requiredChecks: ["automation_job_runs_table", "automation_job_items_table"],
  },
  {
    version: "202606200009",
    name: "phase9f2_lifecycle_notifications",
    dependsOn: ["202606200008"],
    requiredChecks: ["client_notifications_lifecycle_columns", "lifecycle_idempotency_index"],
  },
  {
    version: "202606200010",
    name: "phase9f3_binder_pdf_client_vault",
    dependsOn: ["202606200009"],
    requiredChecks: [
      "binder_exports_generation_columns",
      "binder_exports_generation_idempotent_index",
      "binder_exports_bucket",
    ],
  },
  {
    version: "202606200011",
    name: "phase9f4_legacy_promotions_write_freeze",
    dependsOn: ["202606200010"],
    requiredChecks: ["legacy_promotions_write_seed"],
  },
  {
    version: "202606200012",
    name: "phase9f4_promotion_migration_idempotency",
    dependsOn: ["202606200011"],
    requiredChecks: [
      "legacy_promotion_migration_destination_id",
      "execute_legacy_promotion_migration",
    ],
  },
];

export { PRE_PHASE9_HISTORY_REPAIR_ORDER };

const PHASE9_VERSIONS = PENDING_MIGRATIONS.filter((m) => m.version >= "202606200001").map(
  (m) => m.version,
);

function loadJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadSnapshot(args: string[]): MigrationCheck[] {
  const snapshotIdx = args.indexOf("--snapshot");
  if (snapshotIdx >= 0 && args[snapshotIdx + 1]) {
    return loadJsonFile<MigrationCheck[]>(args[snapshotIdx + 1]);
  }
  if (args.includes("--demo-absent")) {
    return PENDING_MIGRATIONS.flatMap((m) =>
      m.requiredChecks.map((check_id) => ({
        migration: m.version,
        check_id,
        present: false,
        state: "absent",
      })),
    );
  }
  if (args.includes("--demo-partial-019")) {
    return [
      { migration: "202606100019", check_id: "adviser_profiles_table", present: true },
      { migration: "202606100019", check_id: "adviser_profiles_rls_policies", present: false },
      { migration: "202606100019", check_id: "adviser_photos_bucket", present: true },
      { migration: "202606100019", check_id: "adviser_photos_storage_policies", present: false },
    ];
  }
  throw new Error(
    "Provide --snapshot <file.json>, --compare pre post, --history + --schema, or a demo mode. No database connection.",
  );
}

export function classifyMigration(
  manifest: MigrationManifest,
  checks: MigrationCheck[],
  priorClassifications: Map<string, DriftClassification>,
): DriftClassification {
  for (const dep of manifest.dependsOn) {
    const pending = PENDING_MIGRATIONS.find((m) => m.version === dep);
    if (!pending) continue;
    const depClass = priorClassifications.get(dep);
    if (depClass && depClass !== "EXACT_MATCH") {
      return "BLOCKED_BY_DEPENDENCY";
    }
  }

  const relevant = checks.filter((c) => c.migration === manifest.version);
  if (relevant.length === 0) {
    return "UNKNOWN";
  }

  const aggregated = relevant.find(
    (c) => typeof c.total_required_checks === "number" && typeof c.present_checks === "number",
  );
  if (aggregated) {
    const total = aggregated.total_required_checks ?? 0;
    const present = aggregated.present_checks ?? 0;
    const absent = aggregated.absent_checks ?? 0;
    const conflicting = aggregated.conflicting_checks ?? 0;
    const unknown = aggregated.unknown_checks ?? 0;

    if (total <= 0) return "UNKNOWN";
    if (present === total && absent === 0 && conflicting === 0 && unknown === 0) return "EXACT_MATCH";
    if (present === 0 && absent > 0 && conflicting === 0) return "ABSENT";
    if (conflicting > 0) return "CONFLICTING";
    if (present > 0 && absent > 0) return "PARTIAL_MATCH";
    return "UNKNOWN";
  }

  const required = manifest.requiredChecks;
  const results = required.map((id) => {
    const row = relevant.find((c) => c.check_id === id);
    return row?.present ?? false;
  });

  const presentCount = results.filter(Boolean).length;
  if (presentCount === 0) return "ABSENT";
  if (presentCount === required.length) {
    const conflicting = relevant.some((c) => c.match_status === "CONFLICTING");
    const hasUnknown = relevant.some((c) => c.state?.toLowerCase() === "unknown");
    return conflicting ? "CONFLICTING" : hasUnknown ? "UNKNOWN" : "EXACT_MATCH";
  }
  if (presentCount > 0 && presentCount < required.length) return "PARTIAL_MATCH";
  return "UNKNOWN";
}

export type DriftComparison = {
  migration: string;
  before: DriftClassification;
  after: DriftClassification;
  improved: boolean;
};

export function compareRemediationSnapshots(
  before: MigrationCheck[],
  after: MigrationCheck[],
): DriftComparison[] {
  const beforeMap = new Map<string, DriftClassification>();
  const afterMap = new Map<string, DriftClassification>();
  const order = ["202606100020", "202606100021", "202606150001", "202606180001", "202606180002"];

  for (const manifest of PENDING_MIGRATIONS) {
    beforeMap.set(manifest.version, classifyMigration(manifest, before, beforeMap));
  }
  for (const manifest of PENDING_MIGRATIONS) {
    afterMap.set(manifest.version, classifyMigration(manifest, after, afterMap));
  }

  return order.map((migration) => {
    const b = beforeMap.get(migration) ?? "UNKNOWN";
    const a = afterMap.get(migration) ?? "UNKNOWN";
    const improved =
      (b === "PARTIAL_MATCH" || b === "ABSENT" || b === "CONFLICTING") && a === "EXACT_MATCH";
    return { migration, before: b, after: a, improved };
  });
}

export type DriftWarning = {
  code: string;
  migration: string;
  message: string;
};

export function detectHistorySchemaWarnings(
  history: MigrationHistoryRow[],
  schemaChecks: MigrationCheck[],
): DriftWarning[] {
  const warnings: DriftWarning[] = [];
  const historyMap = new Map(history.map((h) => [h.version, h.applied]));
  const schemaMap = new Map<string, DriftClassification>();
  const prior = new Map<string, DriftClassification>();

  for (const manifest of PENDING_MIGRATIONS) {
    schemaMap.set(manifest.version, classifyMigration(manifest, schemaChecks, prior));
  }

  for (const manifest of PENDING_MIGRATIONS) {
    const applied = historyMap.get(manifest.version) ?? false;
    const schema = schemaMap.get(manifest.version) ?? "UNKNOWN";

    if (!applied && schema === "EXACT_MATCH") {
      warnings.push({
        code: "SCHEMA_EXACT_HISTORY_PENDING",
        migration: manifest.version,
        message: "Schema matches migration but history row is not applied",
      });
    }
    if (applied && (schema === "PARTIAL_MATCH" || schema === "ABSENT")) {
      warnings.push({
        code: "HISTORY_APPLIED_SCHEMA_PARTIAL",
        migration: manifest.version,
        message: "Migration marked applied but schema is not EXACT_MATCH",
      });
    }
    if (applied && schema === "ABSENT") {
      warnings.push({
        code: "HISTORY_APPLIED_SCHEMA_ABSENT",
        migration: manifest.version,
        message: "Migration marked applied but expected schema appears absent",
      });
    }
  }

  return warnings;
}

function main(): void {
  const args = process.argv.slice(2);
  const compareIdx = args.indexOf("--compare");
  if (compareIdx >= 0 && args[compareIdx + 1] && args[compareIdx + 2]) {
    const before = loadJsonFile<MigrationCheck[]>(args[compareIdx + 1]);
    const after = loadJsonFile<MigrationCheck[]>(args[compareIdx + 2]);
    console.log("Pre vs post remediation comparison\n");
    for (const row of compareRemediationSnapshots(before, after)) {
      const mark = row.improved ? "↑" : row.before === row.after ? "=" : "↓";
      console.log(`  ${mark} ${row.migration}: ${row.before} → ${row.after}`);
    }
    return;
  }

  const historyIdx = args.indexOf("--history");
  const schemaIdx = args.indexOf("--schema");
  if (historyIdx >= 0 && schemaIdx >= 0 && args[historyIdx + 1] && args[schemaIdx + 1]) {
    const history = loadJsonFile<MigrationHistoryRow[]>(args[historyIdx + 1]);
    const schema = loadJsonFile<MigrationCheck[]>(args[schemaIdx + 1]);
    const warnings = detectHistorySchemaWarnings(history, schema);
    console.log("History vs schema warnings\n");
    if (warnings.length === 0) {
      console.log("  (none)");
    } else {
      for (const w of warnings) {
        console.log(`  [${w.code}] ${w.migration}: ${w.message}`);
      }
    }
    return;
  }

  const checks = loadSnapshot(args);
  const results: { version: string; name: string; classification: DriftClassification }[] = [];
  const map = new Map<string, DriftClassification>();

  for (const manifest of PENDING_MIGRATIONS) {
    const classification = classifyMigration(manifest, checks, map);
    map.set(manifest.version, classification);
    results.push({ version: manifest.version, name: manifest.name, classification });
  }

  console.log("Migration drift classification (read-only analysis)\n");
  for (const row of results) {
    const phase9 = PHASE9_VERSIONS.includes(row.version) ? " [Phase 9]" : "";
    console.log(`  ${row.version} ${row.name}: ${row.classification}${phase9}`);
  }

  const needsEvidence = results.some((r) =>
    ["UNKNOWN", "PARTIAL_MATCH", "CONFLICTING"].includes(r.classification),
  );
  if (needsEvidence && !args.includes("--demo-absent") && !args.includes("--demo-partial-019")) {
    console.log("\nNote: Export dedicated diagnostics to supabase/diagnostics/results/ as JSON.");
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || require.main === module) {
  main();
}
