/**
 * Load remote diagnostic evidence exports from supabase/diagnostics/results/.
 * Read-only filesystem access — no database connection.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export type EvidenceState = "present" | "absent" | "conflicting" | "unknown";

export type EvidenceRow = {
  migration: string;
  check_id: string;
  expected_object?: string;
  present?: boolean;
  state: EvidenceState;
  detail?: string | null;
};

/** Migrations operator-verified EXACT_MATCH via dedicated deep diagnostics (2026-06-22). */
export const OPERATOR_VERIFIED_EXACT_MATCH_MIGRATIONS = [
  "202606100019",
  "202606100020",
  "202606100021",
  "202606150001",
  "202606180001",
  "202606180002",
] as const;

/** Human-operated history repair order after structural verification. */
export const PRE_PHASE9_HISTORY_REPAIR_ORDER = [...OPERATOR_VERIFIED_EXACT_MATCH_MIGRATIONS];

export const PARTIAL_MIGRATION_EVIDENCE_FILES: Record<string, string> = {
  "202606100020": "202606100020_google_calendar_booking.json",
  "202606150001": "202606150001_clients_user_id_unique.json",
  "202606180001": "202606180001_birthday_reminders.json",
  "202606180002": "202606180002_adviser_created_appointments.json",
};

const ROOT = resolve(process.cwd());
const RESULTS_DIR = join(ROOT, "supabase/diagnostics/results");

export function evidencePathForMigration(version: string): string {
  const file = PARTIAL_MIGRATION_EVIDENCE_FILES[version];
  if (!file) throw new Error(`No evidence file mapping for migration ${version}`);
  return join(RESULTS_DIR, file);
}

export function loadEvidenceForMigration(version: string): EvidenceRow[] | null {
  const path = evidencePathForMigration(version);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as EvidenceRow[];
}

export function loadAllPartialEvidence(): Map<string, EvidenceRow[] | null> {
  const map = new Map<string, EvidenceRow[] | null>();
  for (const version of Object.keys(PARTIAL_MIGRATION_EVIDENCE_FILES)) {
    map.set(version, loadEvidenceForMigration(version));
  }
  return map;
}

export function listResultFiles(): string[] {
  if (!existsSync(RESULTS_DIR)) return [];
  return readdirSync(RESULTS_DIR).filter((f) => f.endsWith(".json"));
}

export function evidenceCompleteness(): {
  version: string;
  file: string;
  present: boolean;
  rowCount: number;
}[] {
  return Object.entries(PARTIAL_MIGRATION_EVIDENCE_FILES).map(([version, file]) => {
    const path = join(RESULTS_DIR, file);
    if (!existsSync(path)) {
      return { version, file, present: false, rowCount: 0 };
    }
    const rows = JSON.parse(readFileSync(path, "utf8")) as EvidenceRow[];
    return { version, file, present: true, rowCount: rows.length };
  });
}

export function rowsNeedingRemediation(rows: EvidenceRow[]): EvidenceRow[] {
  return rows.filter((r) => ["absent", "conflicting", "unknown"].includes(r.state));
}
