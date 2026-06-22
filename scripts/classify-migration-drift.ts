/**
 * Classify pending migration drift from a diagnostic snapshot JSON export.
 * Does NOT connect to any database.
 *
 * Usage:
 *   npx tsx scripts/classify-migration-drift.ts --snapshot path/to/export.json
 *   npx tsx scripts/classify-migration-drift.ts --manual  (stdin JSON)
 *
 * Snapshot format (from verify_pending_migrations.sql section O):
 * [
 *   { "migration": "202606100019", "check_id": "adviser_profiles_table", "present": true, "state": "present" }
 * ]
 */

import { readFileSync } from "node:fs";

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
];

function loadSnapshot(args: string[]): MigrationCheck[] {
  const snapshotIdx = args.indexOf("--snapshot");
  if (snapshotIdx >= 0 && args[snapshotIdx + 1]) {
    const raw = readFileSync(args[snapshotIdx + 1], "utf8");
    return JSON.parse(raw) as MigrationCheck[];
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
    "Provide --snapshot <file.json> or a demo mode (--demo-absent, --demo-partial-019). No database connection.",
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

  const required = manifest.requiredChecks;
  const results = required.map((id) => {
    const row = relevant.find((c) => c.check_id === id);
    return row?.present ?? false;
  });

  const presentCount = results.filter(Boolean).length;
  if (presentCount === 0) return "ABSENT";
  if (presentCount === required.length) {
    const conflicting = relevant.some((c) => c.match_status === "CONFLICTING");
    return conflicting ? "CONFLICTING" : "EXACT_MATCH";
  }
  if (presentCount > 0 && presentCount < required.length) return "PARTIAL_MATCH";
  return "UNKNOWN";
}

function main(): void {
  const args = process.argv.slice(2);
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
    console.log(`  ${row.version} ${row.name}: ${row.classification}`);
  }

  const needsEvidence = results.some((r) =>
    ["UNKNOWN", "PARTIAL_MATCH", "CONFLICTING"].includes(r.classification),
  );
  if (needsEvidence && !args.includes("--demo-absent") && !args.includes("--demo-partial-019")) {
    console.log("\nNote: Run verify_pending_migrations.sql on remote and export section O as JSON.");
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || require.main === module) {
  main();
}
