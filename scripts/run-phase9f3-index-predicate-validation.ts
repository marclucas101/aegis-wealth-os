/**
 * Regression tests for Phase 9F.3 partial-index predicate canonicalisation.
 * Run: npx tsx scripts/run-phase9f3-index-predicate-validation.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  anchorNormalizeSimpleIsNotNullPredicate,
  canonicalizeBinderIndexPredicate,
  extractPhase9f3ResolvedCore,
  matchesAnchoredSimpleIsNotNullPredicate,
  matchesAndPredicate,
  matchesIsNotNullPredicate,
  PHASE9F3_PARTIAL_INDEX_PREDICATES,
} from "./phase9f3-index-predicate";
import { detectInvalidBtrimArity } from "./diagnostic-sql-analyzer";

const ROOT = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

function runAnchoredIsNotNullRegression(
  label: string,
  column: string,
  exactPredicate: string,
): void {
  check(`${label}: exact predicate passes`, () => {
    if (!matchesAnchoredSimpleIsNotNullPredicate(exactPredicate, column)) {
      throw new Error(`expected pass for ${exactPredicate}`);
    }
  });

  check(`${label}: qualification passes`, () => {
    const forms = [
      `public.binder_exports.${column} IS NOT NULL`,
      `binder_exports.${column} IS NOT NULL`,
      `(public.binder_exports.${column} IS NOT NULL)`,
    ];
    for (const f of forms) {
      if (!matchesAnchoredSimpleIsNotNullPredicate(f, column)) {
        throw new Error(`${f} should pass`);
      }
    }
  });

  check(`${label}: outer parentheses pass`, () => {
    const forms = [
      `(${column} IS NOT NULL)`,
      `((${column} IS NOT NULL))`,
      `WHERE ((${column} IS NOT NULL))`,
    ];
    for (const f of forms) {
      if (!matchesAnchoredSimpleIsNotNullPredicate(f, column)) {
        throw new Error(`${f} should pass`);
      }
    }
  });

  check(`${label}: wrong column fails`, () => {
    const other =
      column === "generation_idempotency_key"
        ? "published_document_id IS NOT NULL"
        : "generation_idempotency_key IS NOT NULL";
    if (matchesAnchoredSimpleIsNotNullPredicate(other, column)) {
      throw new Error("wrong column must fail");
    }
  });

  check(`${label}: IS NULL fails`, () => {
    if (matchesAnchoredSimpleIsNotNullPredicate(`${column} IS NULL`, column)) {
      throw new Error("is null must not match is not null");
    }
  });

  check(`${label}: added AND fails`, () => {
    if (
      matchesAnchoredSimpleIsNotNullPredicate(
        `${column} IS NOT NULL AND status = 'ready'`,
        column,
      )
    ) {
      throw new Error("extra and term must fail");
    }
  });

  check(`${label}: added OR fails`, () => {
    if (
      matchesAnchoredSimpleIsNotNullPredicate(
        `${column} IS NOT NULL OR status = 'ready'`,
        column,
      )
    ) {
      throw new Error("or term must fail");
    }
  });

  check(`${label}: missing predicate fails`, () => {
    if (matchesAnchoredSimpleIsNotNullPredicate(null, column)) {
      throw new Error("null predicate must fail");
    }
  });
}

function main(): void {
  console.log("Phase 9F.3 index predicate canonicalisation regression\n");

  const genIdem = PHASE9F3_PARTIAL_INDEX_PREDICATES.generation_idempotent;
  const pubDoc = PHASE9F3_PARTIAL_INDEX_PREDICATES.published_document;
  const lineageCurrent = PHASE9F3_PARTIAL_INDEX_PREDICATES.lineage_current_published;

  runAnchoredIsNotNullRegression(
    "generation_idempotent",
    "generation_idempotency_key",
    genIdem,
  );
  runAnchoredIsNotNullRegression("published_document", "published_document_id", pubDoc);

  check("anchored normalization does not strip casts", () => {
    const raw = "WHERE (published_document_id IS NOT NULL)::text";
    const anchored = anchorNormalizeSimpleIsNotNullPredicate(raw);
    if (anchored === "published_document_id is not null") {
      throw new Error("cast suffix must remain for anchored matcher to reject");
    }
    if (matchesAnchoredSimpleIsNotNullPredicate(raw, "published_document_id")) {
      throw new Error("cast suffix must fail exact anchored match");
    }
  });

  check("general canonicalizer still handles compound predicates", () => {
    const required = ["status = 'published_to_client'", "withdrawn_at IS NULL"];
    const passForms = [
      lineageCurrent,
      `(status = 'published_to_client'::text) AND (withdrawn_at IS NULL)`,
      "public.binder_exports.status = 'published_to_client' AND binder_exports.withdrawn_at IS NULL",
      "withdrawn_at IS NULL AND status = 'published_to_client'",
    ];
    for (const f of passForms) {
      const c = canonicalizeBinderIndexPredicate(f);
      if (!matchesAndPredicate(c, required)) {
        throw new Error(`${f} => ${c}`);
      }
    }
    const failMissing = canonicalizeBinderIndexPredicate("status = 'published_to_client'");
    if (matchesAndPredicate(failMissing, required)) {
      throw new Error("missing withdrawn_at must fail");
    }
    const failExtra = canonicalizeBinderIndexPredicate(
      "status = 'published_to_client' AND withdrawn_at IS NULL AND published_document_id IS NOT NULL",
    );
    if (matchesAndPredicate(failExtra, required)) {
      throw new Error("extra conjunct must fail");
    }
  });

  check("general is-not-null matcher rejects compound predicates", () => {
    const c = canonicalizeBinderIndexPredicate(
      "generation_idempotency_key IS NOT NULL AND status = 'ready'",
    );
    if (matchesIsNotNullPredicate(c, "generation_idempotency_key")) {
      throw new Error("compound predicate must fail simple is-not-null match");
    }
  });

  check("SQL resolved core uses anchored simple-predicate catalog", () => {
    const core = read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql");
    if (!core.includes("index_simple_pred_prepped")) {
      throw new Error("expected index_simple_pred_prepped CTE");
    }
    if (!core.includes("simple_predicate_normalized = 'generation_idempotency_key is not null'")) {
      throw new Error("expected anchored generation_idempotent check");
    }
    if (!core.includes("simple_predicate_normalized = 'published_document_id is not null'")) {
      throw new Error("expected anchored published_document check");
    }
    if (!core.includes("pg_get_indexdef(ix.indexrelid, 1, true)")) {
      throw new Error("expected first_key_col via pg_get_indexdef");
    }
  });

  check("SQL resolved core uses conjunct array for compound predicates", () => {
    const core = read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql");
    if (!core.includes("regexp_split_to_array")) {
      throw new Error("expected conjunct splitting in SQL");
    }
  });

  check("main diagnostic and discrepancy inventory remain identical", () => {
    const verify = read(
      "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
    );
    const disc = read("supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql");
    if (extractPhase9f3ResolvedCore(verify) !== extractPhase9f3ResolvedCore(disc)) {
      throw new Error("resolved core mismatch between verify and discrepancies");
    }
  });

  check("generated SQL has no invalid multi-argument btrim calls", () => {
    for (const file of [
      "supabase/diagnostics/phase9f3_202606200010_resolved_core.sql",
      "supabase/diagnostics/verify_202606200010_phase9f3_binder_pdf_client_vault.sql",
      "supabase/diagnostics/verify_202606200010_phase9f3_discrepancies.sql",
    ]) {
      const issues = detectInvalidBtrimArity(read(file));
      if (issues.length > 0) {
        throw new Error(`${file}: ${issues[0]?.message ?? "invalid btrim"}`);
      }
    }
  });

  check("generated SQL uses staged outer-paren stripping CTEs", () => {
    const core = read("supabase/diagnostics/phase9f3_202606200010_resolved_core.sql");
    if (!core.includes("index_predicate_stage_1")) {
      throw new Error("expected staged predicate paren-strip CTEs");
    }
    if (!core.includes("index_simple_pred_stage_1")) {
      throw new Error("expected staged simple-predicate paren-strip CTEs");
    }
    if (!core.includes("FOR char_length(predicate_stage_0) - 2")) {
      throw new Error("expected substring-based paren strip with char_length(expr) - 2");
    }
    if (!core.includes("index_conjunct_stage_1")) {
      throw new Error("expected staged conjunct paren-strip CTEs");
    }
  });

  if (process.exitCode === 1) {
    console.error("\nPredicate regression failed");
    process.exit(1);
  }
  console.log("\nAll predicate regression tests passed");
}

main();
