/**
 * Regression tests for Phase 9 column canonicalization.
 * Run: npm run qa:phase9-column-canonicalization
 */

import {
  canonicalizeColumnDefault,
  canonicalizeExpectedColumn,
  columnDefinitionsConflict,
} from "./phase9-column-canonicalization";

type TestCase = { name: string; run: () => void };

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const tests: TestCase[] = [
  {
    name: "'prospect'::relationship_stage matches expected prospect",
    run: () => {
      const expected = "USER-DEFINED|NO|prospect";
      check(
        !columnDefinitionsConflict(expected, "clients.relationship_stage", {
          dataType: "USER-DEFINED",
          udtSchema: "public",
          udtName: "relationship_stage",
          isNullable: "NO",
          rawDefault: "'prospect'::relationship_stage",
        }),
        "enum cast default should match",
      );
    },
  },
  {
    name: "'draft'::publication_status matches expected draft",
    run: () => {
      check(
        !columnDefinitionsConflict("USER-DEFINED|NO|draft", "published_outputs.publication_status", {
          dataType: "USER-DEFINED",
          udtSchema: "public",
          udtName: "publication_status",
          isNullable: "NO",
          rawDefault: "'draft'::publication_status",
        }),
        "publication_status cast should match",
      );
    },
  },
  {
    name: "'draft'::meeting_session_status matches expected draft",
    run: () => {
      check(
        !columnDefinitionsConflict("USER-DEFINED|NO|draft", "meeting_sessions.status", {
          dataType: "USER-DEFINED",
          udtSchema: "public",
          udtName: "meeting_session_status",
          isNullable: "NO",
          rawDefault: "'draft'::meeting_session_status",
        }),
        "meeting_session_status cast should match",
      );
    },
  },
  {
    name: "'{}'::jsonb matches expected {}",
    run: () => {
      check(
        !columnDefinitionsConflict("jsonb|NO|{}", "published_outputs.safe_payload", {
          dataType: "jsonb",
          udtSchema: "pg_catalog",
          udtName: "jsonb",
          isNullable: "NO",
          rawDefault: "'{}'::jsonb",
        }),
        "jsonb empty object cast should match",
      );
      check(
        canonicalizeColumnDefault("'{}'::jsonb", "jsonb", null) === "jsonb:{}",
        "canonical jsonb default",
      );
    },
  },
  {
    name: "false matches equivalent boolean cast forms",
    run: () => {
      for (const raw of ["false", "'false'::boolean", "(false)"]) {
        check(
          !columnDefinitionsConflict("boolean|NO|false", "roadmap_items.client_visible", {
            dataType: "boolean",
            udtSchema: "pg_catalog",
            udtName: "bool",
            isNullable: "NO",
            rawDefault: raw,
          }),
          `boolean default ${raw} should match`,
        );
      }
    },
  },
  {
    name: "wrong enum type remains conflicting",
    run: () => {
      check(
        columnDefinitionsConflict("USER-DEFINED|NO|draft", "meeting_sessions.status", {
          dataType: "USER-DEFINED",
          udtSchema: "public",
          udtName: "publication_status",
          isNullable: "NO",
          rawDefault: "'draft'::publication_status",
        }),
        "wrong udt_name must conflict",
      );
    },
  },
  {
    name: "wrong enum label remains conflicting",
    run: () => {
      check(
        columnDefinitionsConflict("USER-DEFINED|NO|prospect", "clients.relationship_stage", {
          dataType: "USER-DEFINED",
          udtSchema: "public",
          udtName: "relationship_stage",
          isNullable: "NO",
          rawDefault: "'active_client'::relationship_stage",
        }),
        "wrong enum label must conflict",
      );
    },
  },
  {
    name: "different JSONB content remains conflicting",
    run: () => {
      check(
        columnDefinitionsConflict("jsonb|NO|{}", "meeting_sessions.summary_payload", {
          dataType: "jsonb",
          udtSchema: "pg_catalog",
          udtName: "jsonb",
          isNullable: "NO",
          rawDefault: "'{\"a\":1}'::jsonb",
        }),
        "different json object must conflict",
      );
    },
  },
  {
    name: "missing defaults remain conflicting",
    run: () => {
      check(
        columnDefinitionsConflict("USER-DEFINED|NO|prospect", "clients.relationship_stage", {
          dataType: "USER-DEFINED",
          udtSchema: "public",
          udtName: "relationship_stage",
          isNullable: "NO",
          rawDefault: "",
        }),
        "missing required default must conflict",
      );
    },
  },
  {
    name: "nullable differences remain conflicting",
    run: () => {
      check(
        columnDefinitionsConflict("text|NO|adviser", "roadmap_items.task_owner", {
          dataType: "text",
          udtSchema: "pg_catalog",
          udtName: "text",
          isNullable: "YES",
          rawDefault: "'adviser'::text",
        }),
        "nullable mismatch must conflict",
      );
    },
  },
];

function main(): void {
  console.log(`Phase 9 column canonicalization regression — ${tests.length} tests\n`);
  let passed = 0;
  for (const test of tests) {
    try {
      test.run();
      passed++;
      console.log(`  ✓ ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  ✗ ${test.name}: ${message}`);
    }
  }
  console.log(`\n${passed}/${tests.length} passed`);
  if (passed !== tests.length) process.exit(1);

  const sample = canonicalizeExpectedColumn("USER-DEFINED|NO|client_published", "published_outputs.output_audience");
  check(sample.includes("enum:output_audience:client_published"), "expected canonical sample");
}

main();
