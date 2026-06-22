/**
 * Mirrors predicate canonicalisation in phase9f_202606200008_resolved_core.sql.
 * Used by QA parity tests — keep in sync with SQL.
 */

export function canonicalizeIndexPredicate(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let s = raw.replace(/^\s*where\s+/i, "").trim();
  if (s === "") return null;
  s = s.replace(/::text\b/gi, "");
  s = s.replace(/'([^']+)'::text/gi, "'$1'");
  s = s.replace(/\s+/g, " ").toLowerCase();
  for (let i = 0; i < 2; i++) {
    const m = s.match(/^\((.*)\)$/);
    if (!m) break;
    s = m[1];
  }
  return s;
}

export const PHASE9F_STABLE_CHECK_IDS = [
  "table:automation_job_runs",
  "table:automation_job_items",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_runs",
  "column:automation_job_items",
  "column:automation_job_items",
  "column:automation_job_items",
  "column:automation_job_items",
  "column:automation_job_items",
  "constraint:automation_job_runs_job_name_check",
  "constraint:automation_job_runs_trigger_source_check",
  "constraint:automation_job_runs_status_check",
  "constraint:automation_job_items_reference_type_check",
  "constraint:automation_job_items_outcome_check",
  "fk:automation_job_items_job_run_id_fkey",
  "index:idx_automation_job_runs_single_active",
  "index_def:idx_automation_job_runs_single_active",
  "index:idx_automation_job_runs_job_started",
  "index:idx_automation_job_items_run",
  "rls:automation_job_runs",
  "rls:automation_job_items",
  "no_policy:automation_job_runs",
  "no_policy:automation_job_items",
  "comment:automation_job_runs",
  "comment:automation_job_items",
  "seed:platform_feature_controls.scheduled_content_automation",
] as const;

export function extractPhase9fResolvedCore(sql: string): string {
  const begin = "-- PHASE9F_RESOLVED_CORE_BEGIN";
  const end = "-- PHASE9F_RESOLVED_CORE_END";
  const start = sql.indexOf(begin);
  const stop = sql.indexOf(end);
  if (start < 0 || stop < 0 || stop <= start) {
    throw new Error("PHASE9F_RESOLVED_CORE markers not found");
  }
  return sql.slice(start + begin.length, stop).trim();
}
