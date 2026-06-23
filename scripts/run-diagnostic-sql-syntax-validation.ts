/**
 * Parse every supabase/diagnostics/*.sql file with libpg-query (PostgreSQL grammar).
 * Read-only — no database connection or writes.
 *
 * Run: npm run qa:diagnostic-sql-syntax
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  analyzePostgresSql,
  detectInvalidBtrimArity,
  detectUnguardedXmlPatterns,
  detectUnsafeOptionalBinderColumnReferences,
  detectPreflightProbeCteIssues,
} from "./diagnostic-sql-analyzer";

const ROOT = resolve(process.cwd());
const DIAGNOSTICS_DIR = join(ROOT, "supabase/diagnostics");

const PARSER_LIBRARY = "libpg-query@17 (PostgreSQL 17 libpg_query WASM — gram.y / scan.l)";

type SelfTest = {
  name: string;
  sql: string;
  expectIssueKinds: string[];
  options?: {
    requireSelectOnly?: boolean;
    optionalRelations?: string[];
  };
};

const OPTIONAL_RELATIONS = [
  "published_outputs",
  "platform_feature_controls",
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
];

const SELF_TESTS: SelfTest[] = [
  {
    name: "rejects unknown column alias",
    sql: "SELECT v.version FROM (VALUES ('1')) AS expected(version);",
    expectIssueKinds: ["unknown_alias"],
  },
  {
    name: "accepts qualified alias matching FROM",
    sql: "SELECT expected.version FROM (VALUES ('1')) AS expected(version);",
    expectIssueKinds: [],
  },
  {
    name: "rejects cross-statement CTE reference",
    sql: `
      WITH clients_exists AS (SELECT true AS ok)
      SELECT ok FROM clients_exists;
      SELECT ok FROM clients_exists;
    `,
    expectIssueKinds: ["invalid_cte_scope"],
  },
  {
    name: "rejects invalid array indexing on xpath",
    sql: "SELECT xpath('/x', '<a/>')[1];",
    expectIssueKinds: ["syntax"],
  },
  {
    name: "accepts parenthesized xpath array subscript",
    sql: "SELECT ((xpath('/x', '<a/>'))[1]);",
    expectIssueKinds: [],
  },
  {
    name: "rejects malformed cast",
    sql: "SELECT 'x'::;",
    expectIssueKinds: ["syntax"],
  },
  {
    name: "rejects unclosed string across statements",
    sql: "SELECT 'a'; SELECT 'b;",
    expectIssueKinds: ["syntax"],
  },
  {
    name: "rejects non-select diagnostic statement",
    sql: "CREATE TABLE x(id int);",
    options: { requireSelectOnly: true },
    expectIssueKinds: ["unsafe_write"],
  },
  {
    name: "rejects direct optional relation reference",
    sql: "SELECT * FROM meeting_sessions;",
    options: { optionalRelations: ["meeting_sessions"] },
    expectIssueKinds: ["direct_optional_reference"],
  },
  {
    name: "flags unguarded xpath with query_to_xml",
    sql: "SELECT ((xpath('/row/cnt/text()', query_to_xml('SELECT 1', true, true, '')))[1]::text);",
    options: { requireSelectOnly: true },
    expectIssueKinds: ["unguarded_xpath"],
  },
  {
    name: "accepts native catalog probe without xpath",
    sql: "SELECT EXISTS (SELECT 1 FROM platform_feature_controls WHERE feature_key = 'x');",
    options: { requireSelectOnly: true },
    expectIssueKinds: [],
  },
  {
    name: "accepts to_regclass-guarded optional relation probe",
    sql: `
      WITH seed_probe AS (
        SELECT CASE
          WHEN to_regclass('public.platform_feature_controls') IS NULL THEN NULL::boolean
          ELSE (SELECT enabled FROM platform_feature_controls WHERE feature_key = 'x' LIMIT 1)
        END AS seed_ok
      )
      SELECT seed_ok FROM seed_probe;
    `,
    options: { requireSelectOnly: true, optionalRelations: ["platform_feature_controls"] },
    expectIssueKinds: [],
  },
  {
    name: "flags unguarded xmlparse document",
    sql: "SELECT xmlparse(document 'not xml');",
    options: { requireSelectOnly: true },
    expectIssueKinds: ["unguarded_xmlparse"],
  },
  {
    name: "flags direct optional binder_exports column reference",
    sql: "SELECT generation_idempotency_key FROM binder_exports;",
    expectIssueKinds: ["unsafe_optional_column_reference"],
  },
  {
    name: "accepts to_jsonb projection for optional binder_exports column",
    sql: `
      SELECT NULLIF(to_jsonb(be) ->> 'generation_idempotency_key', '')
      FROM public.binder_exports be;
    `,
    expectIssueKinds: [],
  },
  {
    name: "accepts information_schema catalog probe for optional column",
    sql: `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'binder_exports'
          AND column_name = 'generation_idempotency_key'
      );
    `,
    expectIssueKinds: [],
  },
  {
    name: "flags implicit probes CTE without typed output columns",
    sql: `
      WITH probes AS (
        SELECT 'a'::text AS probe_id, 'READY', 'detail text'
        UNION ALL
        SELECT 'b', 'WARNING', 'more detail'
      )
      SELECT probe_id, classification, detail FROM probes;
    `,
    expectIssueKinds: ["preflight_untyped_probes_cte"],
  },
  {
    name: "accepts typed probes CTE with explicit output column names",
    sql: `
      WITH probes (probe_id, classification, detail) AS (
        SELECT 'a'::text, 'READY', 'detail text'
        UNION ALL
        SELECT 'b', 'WARNING', 'more detail'
      )
      SELECT probe_id, classification, detail FROM probes;
    `,
    expectIssueKinds: [],
  },
  {
    name: "flags probes UNION branch with wrong column count",
    sql: `
      WITH probes (probe_id, classification, detail) AS (
        SELECT 'a'::text, 'READY'
        UNION ALL
        SELECT 'b', 'WARNING', 'ok'
      )
      SELECT probe_id, classification, detail FROM probes;
    `,
    expectIssueKinds: ["preflight_union_column_mismatch"],
  },
  {
    name: "flags invalid btrim arity",
    sql: "SELECT btrim(a, '::text', '', 'gi') FROM t;",
    expectIssueKinds: ["invalid_btrim_arity"],
  },
  {
    name: "accepts valid single-argument btrim",
    sql: "SELECT btrim(term) FROM t WHERE btrim(term) <> '';",
    expectIssueKinds: [],
  },
];

async function runSelfTests(): Promise<void> {
  console.log("Self-tests (parser + semantic checks):\n");
  let passed = 0;
  for (const test of SELF_TESTS) {
    const result = await analyzePostgresSql(test.sql, test.options);
    const xmlKinds = new Set(["unguarded_xpath", "unguarded_xml_cast", "unguarded_xmlparse"]);
    const needsXmlScan =
      test.expectIssueKinds.some((k) => xmlKinds.has(k)) ||
      (test.options?.requireSelectOnly && /\bxpath\s*\(|\bxmlparse\s*\(|::xml\b/i.test(test.sql));
    const xmlIssues = needsXmlScan ? detectUnguardedXmlPatterns(test.sql) : [];
    const needsOptionalColumnScan =
      test.expectIssueKinds.includes("unsafe_optional_column_reference") ||
      /\bbinder_exports\b/i.test(test.sql);
    const optionalColumnIssues = needsOptionalColumnScan
      ? detectUnsafeOptionalBinderColumnReferences(test.sql)
      : [];
    const preflightIssues = /\bfrom\s+probes\b/i.test(test.sql)
      ? detectPreflightProbeCteIssues(test.sql)
      : [];
    const btrimIssues = /\bbtrim\s*\(/i.test(test.sql)
      ? detectInvalidBtrimArity(test.sql)
      : [];
    const kinds = [...result.issues, ...xmlIssues, ...optionalColumnIssues, ...preflightIssues, ...btrimIssues].map((i) => i.kind).sort();
    const expected = [...test.expectIssueKinds].sort();
    const ok =
      kinds.length === expected.length && kinds.every((kind, idx) => kind === expected[idx]);
    if (ok) {
      passed++;
      console.log(`  ✓ ${test.name}`);
    } else {
      console.log(`  ✗ ${test.name}`);
      console.log(`      expected: [${expected.join(", ")}]`);
      console.log(`      got:      [${kinds.join(", ")}]`);
    }
  }
  console.log(`\nSelf-tests: ${passed}/${SELF_TESTS.length} passed\n`);
  if (passed !== SELF_TESTS.length) process.exit(1);
}

async function main(): Promise<void> {
  await runSelfTests();

  console.log(`Diagnostic SQL syntax validation — ${PARSER_LIBRARY}\n`);

  const files = readdirSync(DIAGNOSTICS_DIR)
    .filter((name) => name.endsWith(".sql") && !name.includes("resolved_core"))
    .sort();

  let passed = 0;
  const parsedOk: string[] = [];

  for (const file of files) {
    const path = join(DIAGNOSTICS_DIR, file);
    const sql = readFileSync(path, "utf8");
    const result = await analyzePostgresSql(sql, {
      requireSelectOnly: true,
      optionalRelations: OPTIONAL_RELATIONS,
    });

    const xmlIssues =
      file.includes("202606200008") || file.includes("phase9f") || file.includes("202606200009") || file.includes("phase9f2")
        || file.includes("202606200010") || file.includes("phase9f3")
        ? detectUnguardedXmlPatterns(sql)
        : [];

    const optionalColumnIssues =
      file.includes("202606200010") || file.includes("phase9f3")
        ? detectUnsafeOptionalBinderColumnReferences(sql)
        : [];

    const preflightIssues = file.startsWith("preflight_")
      ? detectPreflightProbeCteIssues(sql)
      : [];

    const btrimIssues =
      file.includes("202606200010") || file.includes("phase9f3")
        ? detectInvalidBtrimArity(sql)
        : [];

    const allIssues = [...result.issues, ...xmlIssues, ...optionalColumnIssues, ...preflightIssues, ...btrimIssues];

    if (allIssues.length === 0) {
      passed++;
      parsedOk.push(file);
      console.log(`  ✓ ${file} (${result.statementCount} statement(s))`);
    } else {
      console.log(`  ✗ ${file}`);
      for (const issue of allIssues) {
        const pos = issue.position !== undefined ? ` @${issue.position}` : "";
        console.log(`      [${issue.kind}]${pos} ${issue.message.split("\n")[0]}`);
      }
    }
  }

  console.log(`\nParser: ${PARSER_LIBRARY}`);
  console.log(`Parsed successfully: ${parsedOk.length}/${files.length}`);
  if (parsedOk.length > 0) {
    console.log("\nFiles parsed:");
    for (const file of parsedOk) console.log(`  - ${file}`);
  }

  console.log(`\n${passed}/${files.length} passed`);
  if (passed !== files.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
