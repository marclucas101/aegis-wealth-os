/**
 * Parse every supabase/diagnostics/*.sql file with libpg-query (PostgreSQL grammar).
 * Read-only — no database connection or writes.
 *
 * Run: npm run qa:diagnostic-sql-syntax
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { analyzePostgresSql } from "./diagnostic-sql-analyzer";

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
];

async function runSelfTests(): Promise<void> {
  console.log("Self-tests (parser + semantic checks):\n");
  let passed = 0;
  for (const test of SELF_TESTS) {
    const result = await analyzePostgresSql(test.sql, test.options);
    const kinds = result.issues.map((i) => i.kind).sort();
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
    .filter((name) => name.endsWith(".sql"))
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

    if (result.issues.length === 0) {
      passed++;
      parsedOk.push(file);
      console.log(`  ✓ ${file} (${result.statementCount} statement(s))`);
    } else {
      console.log(`  ✗ ${file}`);
      for (const issue of result.issues) {
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
