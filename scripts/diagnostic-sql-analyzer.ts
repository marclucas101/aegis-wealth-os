/**
 * PostgreSQL diagnostic SQL analysis using libpg-query (official PostgreSQL parser).
 * Syntax: libpg-query parse (gram.y / scan.l)
 * Semantic (aliases, unresolved relation qualifiers): AST scope walk
 */

import { formatSqlError, loadModule, parseSync, type SqlError } from "libpg-query";

export type SqlAnalysisIssue = {
  kind:
    | "syntax"
    | "unknown_alias"
    | "invalid_cte_scope"
    | "unsafe_write"
    | "direct_optional_reference"
    | "unsafe_optional_column_reference"
    | "preflight_untyped_probes_cte"
    | "preflight_union_column_mismatch"
    | "preflight_final_select_mismatch"
    | "unqualified_column"
    | "empty_statement"
    | "unguarded_xpath"
    | "unguarded_xml_cast"
    | "unguarded_xmlparse";
  message: string;
  position?: number;
};

export type SqlAnalysisResult = {
  statementCount: number;
  issues: SqlAnalysisIssue[];
};

type Scope = {
  ctes: Set<string>;
  aliases: Set<string>;
};

type AnalyzeOptions = {
  requireSelectOnly?: boolean;
  optionalRelations?: string[];
};

const CATALOG_RELATIONS = new Set([
  "pg_class",
  "pg_namespace",
  "pg_constraint",
  "pg_indexes",
  "pg_policies",
  "pg_trigger",
  "pg_type",
  "pg_enum",
  "pg_extension",
  "pg_attribute",
  "information_schema.columns",
  "information_schema.tables",
  "information_schema.routine_privileges",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getStringField(node: unknown): string | null {
  if (!isRecord(node)) return null;
  const str = node.String;
  if (isRecord(str) && typeof str.sval === "string") return str.sval;
  return null;
}

function collectCteNames(withClause: unknown, into: Set<string>): void {
  if (!isRecord(withClause)) return;
  const ctes = withClause.ctes;
  if (!isRecord(ctes) || !Array.isArray(ctes)) return;
  for (const cte of ctes) {
    if (!isRecord(cte)) continue;
    const common = cte.CommonTableExpr;
    if (isRecord(common) && typeof common.ctename === "string") {
      into.add(common.ctename);
    }
  }
}

function addAlias(aliasNode: unknown, into: Set<string>): void {
  if (!isRecord(aliasNode)) return;
  if (typeof aliasNode.aliasname === "string") into.add(aliasNode.aliasname);
}

function collectFromAliases(fromClause: unknown, into: Set<string>): void {
  if (!Array.isArray(fromClause)) return;
  for (const item of fromClause) {
    if (!isRecord(item)) continue;
    if (item.RangeVar) {
      const rv = item.RangeVar;
      if (!isRecord(rv)) continue;
      if (isRecord(rv.alias) && typeof rv.alias.aliasname === "string") {
        into.add(rv.alias.aliasname);
      } else if (typeof rv.relname === "string") {
        into.add(rv.relname);
      }
    }
    if (item.RangeSubselect) {
      const rs = item.RangeSubselect;
      if (isRecord(rs)) addAlias(rs.alias, into);
    }
    if (item.JoinExpr) {
      const join = item.JoinExpr;
      if (isRecord(join)) {
        collectFromAliases([join.larg], into);
        collectFromAliases([join.rarg], into);
      }
    }
    if (item.RangeFunction) {
      const rf = item.RangeFunction;
      if (isRecord(rf)) addAlias(rf.alias, into);
    }
  }
}

function validateColumnRef(
  columnRef: unknown,
  scope: Scope,
  issues: SqlAnalysisIssue[],
): void {
  if (!isRecord(columnRef) || !Array.isArray(columnRef.fields) || columnRef.fields.length === 0) {
    return;
  }
  const parts = columnRef.fields.map(getStringField).filter((p): p is string => p !== null);
  if (parts.length === 0) return;

  const location = typeof columnRef.location === "number" ? columnRef.location : undefined;

  if (parts.length === 1) {
    return;
  }

  const qualifier = parts[0];
  if (scope.aliases.has(qualifier) || scope.ctes.has(qualifier)) {
    return;
  }

  if (CATALOG_RELATIONS.has(qualifier)) {
    return;
  }

  issues.push({
    kind: "unknown_alias",
    message: `Column reference "${parts.join(".")}" uses qualifier "${qualifier}" not present in FROM/WITH scope`,
    position: location,
  });
}

function walkNode(
  node: unknown,
  scope: Scope,
  issues: SqlAnalysisIssue[],
  parentKey?: string,
): void {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    for (const item of node) walkNode(item, scope, issues, parentKey);
    return;
  }

  if (!isRecord(node)) return;

  if (node.ColumnRef) {
    validateColumnRef(node.ColumnRef, scope, issues);
    return;
  }

  if (node.SelectStmt) {
    analyzeSelectStmt(node.SelectStmt, scope, issues);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "SelectStmt") continue;
    walkNode(value, scope, issues, key);
  }
}

function analyzeSelectStmt(selectStmt: unknown, parentScope: Scope, issues: SqlAnalysisIssue[]): void {
  if (!isRecord(selectStmt)) return;

  const scope: Scope = {
    ctes: new Set(parentScope.ctes),
    aliases: new Set<string>(),
  };

  collectCteNames(selectStmt.withClause, scope.ctes);
  collectFromAliases(selectStmt.fromClause, scope.aliases);

  walkNode(selectStmt.targetList, scope, issues);
  walkNode(selectStmt.fromClause, scope, issues);
  walkNode(selectStmt.whereClause, scope, issues);
  walkNode(selectStmt.havingClause, scope, issues);
  walkNode(selectStmt.sortClause, scope, issues);
  walkNode(selectStmt.groupClause, scope, issues);

  if (Array.isArray(selectStmt.fromClause)) {
    for (const fromItem of selectStmt.fromClause) {
      if (!isRecord(fromItem)) continue;
      const rangeSubselect = fromItem.RangeSubselect;
      if (isRecord(rangeSubselect) && isRecord(rangeSubselect.subquery)) {
        const nestedScope: Scope = { ctes: new Set(scope.ctes), aliases: new Set<string>() };
        walkNode(rangeSubselect.subquery, nestedScope, issues);
      }
    }
  }

  if (selectStmt.larg || selectStmt.rarg) {
    analyzeSelectStmt(selectStmt.larg, scope, issues);
    analyzeSelectStmt(selectStmt.rarg, scope, issues);
  }
}

function collectFromRangeVars(fromClause: unknown, into: Array<{ relname: string; location?: number }>): void {
  if (!Array.isArray(fromClause)) return;
  for (const item of fromClause) {
    if (!isRecord(item)) continue;
    if (item.RangeVar) {
      const rv = item.RangeVar;
      if (isRecord(rv) && typeof rv.relname === "string" && !rv.schemaname) {
        into.push({
          relname: rv.relname,
          location: typeof rv.location === "number" ? rv.location : undefined,
        });
      }
    }
    if (item.JoinExpr) {
      const join = item.JoinExpr;
      if (isRecord(join)) {
        collectFromRangeVars([join.larg], into);
        collectFromRangeVars([join.rarg], into);
      }
    }
  }
}

function extractStatementCtes(stmtRoot: unknown): Set<string> {
  const names = new Set<string>();
  if (!isRecord(stmtRoot)) return names;
  const stmt = stmtRoot.stmt ?? stmtRoot;
  if (!isRecord(stmt)) return names;

  const select = stmt.SelectStmt;
  if (isRecord(select)) collectCteNames(select.withClause, names);

  return names;
}

function extractFromRelations(stmtRoot: unknown): Array<{ relname: string; location?: number }> {
  const relations: Array<{ relname: string; location?: number }> = [];
  if (!isRecord(stmtRoot)) return relations;
  const stmt = stmtRoot.stmt ?? stmtRoot;
  if (!isRecord(stmt)) return relations;

  const select = stmt.SelectStmt;
  if (isRecord(select)) collectFromRangeVars(select.fromClause, relations);

  return relations;
}

function validateCrossStatementCteScope(
  statements: unknown[],
  issues: SqlAnalysisIssue[],
): void {
  const priorCtes = new Set<string>();

  for (const stmt of statements) {
    const localCtes = extractStatementCtes(stmt);
    for (const { relname, location } of extractFromRelations(stmt)) {
      if (priorCtes.has(relname) && !localCtes.has(relname)) {
        issues.push({
          kind: "invalid_cte_scope",
          message: `Relation "${relname}" was a CTE in an earlier statement but is not in scope for this statement`,
          position: location,
        });
      }
    }
    for (const name of localCtes) priorCtes.add(name);
  }
}

function analyzeStatement(stmtWrapper: unknown, issues: SqlAnalysisIssue[]): void {
  if (!isRecord(stmtWrapper) || !isRecord(stmtWrapper.stmt)) return;
  const rootScope: Scope = { ctes: new Set(), aliases: new Set() };
  walkNode(stmtWrapper.stmt, rootScope, issues);
}

function getStatementKind(stmtWrapper: unknown): string | null {
  if (!isRecord(stmtWrapper) || !isRecord(stmtWrapper.stmt)) return null;
  const keys = Object.keys(stmtWrapper.stmt);
  return keys.length > 0 ? keys[0] : null;
}

function collectRangeVarsInNode(node: unknown, out: Array<{ relname: string; location?: number }>): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) collectRangeVarsInNode(item, out);
    return;
  }
  if (!isRecord(node)) return;

  if (isRecord(node.RangeVar) && typeof node.RangeVar.relname === "string") {
    out.push({
      relname: node.RangeVar.relname,
      location: typeof node.RangeVar.location === "number" ? node.RangeVar.location : undefined,
    });
  }

  for (const value of Object.values(node)) {
    collectRangeVarsInNode(value, out);
  }
}

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

/** Migration 010 columns on binder_exports that must not be referenced directly in pre-apply diagnostics. */
export const PHASE9F3_OPTIONAL_BINDER_COLUMNS = [
  "binder_lineage_id",
  "generation_status",
  "generation_idempotency_key",
  "storage_bucket",
  "file_size_bytes",
  "mime_type",
  "content_hash",
  "generation_error_code",
  "generation_completed_at",
  "published_document_id",
  "supersedes_binder_id",
  "withdrawn_at",
  "withdrawal_reason",
] as const;

function isInsideSingleQuotedLiteral(sql: string, index: number): boolean {
  let inLiteral = false;
  for (let i = 0; i < index; i += 1) {
    if (sql[i] === "'") {
      if (sql[i + 1] === "'") {
        i += 1;
        continue;
      }
      inLiteral = !inLiteral;
    }
  }
  return inLiteral;
}

/**
 * Flags direct binder_exports column references that PostgreSQL resolves at plan time
 * even when wrapped in CASE/EXISTS guards. Approved: information_schema/pg catalogs,
 * to_jsonb(row) ->> 'column', or column names only inside string literals.
 */
export function detectUnsafeOptionalBinderColumnReferences(
  sql: string,
  columns: readonly string[] = PHASE9F3_OPTIONAL_BINDER_COLUMNS,
): SqlAnalysisIssue[] {
  const issues: SqlAnalysisIssue[] = [];
  const executable = stripSqlComments(sql);
  if (!/\bbinder_exports\b/i.test(executable)) {
    return issues;
  }

  for (const column of columns) {
    const pattern = new RegExp(`\\b${column}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(executable)) !== null) {
      const index = match.index;
      if (isInsideSingleQuotedLiteral(executable, index)) {
        continue;
      }

      const windowStart = Math.max(0, index - 8);
      const windowEnd = Math.min(executable.length, index + column.length + 8);
      const window = executable.slice(windowStart, windowEnd);

      if (/->>\s*'$/i.test(executable.slice(Math.max(0, index - 5), index))) {
        continue;
      }
      if (/information_schema\.columns/i.test(window) || /column_name\s*=/i.test(window)) {
        continue;
      }
      if (/pg_attribute/i.test(window) || /pg_get_constraintdef/i.test(window)) {
        continue;
      }
      if (/constraint_def\s+ILIKE/i.test(window) || /key_columns_ordered\s*=/i.test(window)) {
        continue;
      }
      if (/predicate_canonical\s+ILIKE/i.test(window) || /expected_detail/i.test(window)) {
        continue;
      }

      issues.push({
        kind: "unsafe_optional_column_reference",
        message: `Direct reference to migration-owned column "${column}" on binder_exports; use to_jsonb(row) ->> '${column}' or catalog probes`,
        position: index,
      });
    }
  }

  return issues;
}

export const PREFLIGHT_RESULT_COLUMNS = ["probe_id", "classification", "detail"] as const;

const PREFLIGHT_FINAL_SELECT_PATTERN =
  /select\s+probe_id\s*,\s*classification\s*,\s*detail\s+from\s+probes\b/i;

const TYPED_PROBES_CTE_PATTERN =
  /probes\s*\(\s*probe_id\s*,\s*classification\s*,\s*detail\s*\)\s*as\s*\(/i;

const IMPLICIT_PROBES_CTE_PATTERN = /\bprobes\s+as\s*\(/i;

function countSelectListColumns(selectList: string): number {
  let depth = 0;
  let commas = 0;
  let inString = false;
  for (let i = 0; i < selectList.length; i += 1) {
    const ch = selectList[i];
    if (ch === "'") {
      if (inString && selectList[i + 1] === "'") {
        i += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) commas += 1;
  }
  return commas + 1;
}

function extractProbesCteBody(sql: string): string | null {
  const match = sql.match(
    /\bprobes\s*(?:\(\s*probe_id\s*,\s*classification\s*,\s*detail\s*\))?\s*as\s*\(/i,
  );
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < sql.length && depth > 0) {
    if (sql[i] === "(") depth += 1;
    else if (sql[i] === ")") depth -= 1;
    i += 1;
  }
  return depth === 0 ? sql.slice(start, i - 1) : null;
}

/**
 * Validates preflight diagnostics that expose probe_id, classification, detail from a probes CTE.
 */
export function detectPreflightProbeCteIssues(sql: string): SqlAnalysisIssue[] {
  const issues: SqlAnalysisIssue[] = [];
  const executable = stripSqlComments(sql);

  if (!/\bfrom\s+probes\b/i.test(executable)) {
    return issues;
  }

  if (!PREFLIGHT_FINAL_SELECT_PATTERN.test(executable)) {
    issues.push({
      kind: "preflight_final_select_mismatch",
      message:
        "Preflight final SELECT must be exactly: SELECT probe_id, classification, detail FROM probes",
    });
  }

  if (IMPLICIT_PROBES_CTE_PATTERN.test(executable) && !TYPED_PROBES_CTE_PATTERN.test(executable)) {
    const body = extractProbesCteBody(executable);
    const firstBranch = body?.split(/\bunion\s+all\b/i)[0] ?? "";
    const firstBranchFullyAliased =
      /\bas\s+probe_id\b/i.test(firstBranch) &&
      /\bas\s+classification\b/i.test(firstBranch) &&
      /\bas\s+detail\b/i.test(firstBranch);
    if (!firstBranchFullyAliased) {
      issues.push({
        kind: "preflight_untyped_probes_cte",
        message:
          "probes CTE must declare explicit output columns: probes (probe_id, classification, detail) AS (",
      });
    }
  }

  const body = extractProbesCteBody(executable);
  if (body) {
    const branches = body.split(/\bunion\s+all\b/i);
    branches.forEach((branch, index) => {
      const selectMatch = branch.match(/\bselect\s+([\s\S]*?)$/i);
      if (!selectMatch) {
        issues.push({
          kind: "preflight_union_column_mismatch",
          message: `probes UNION ALL branch ${index + 1} is missing a SELECT list`,
        });
        return;
      }
      const columnCount = countSelectListColumns(selectMatch[1].trim());
      if (columnCount !== PREFLIGHT_RESULT_COLUMNS.length) {
        issues.push({
          kind: "preflight_union_column_mismatch",
          message: `probes UNION ALL branch ${index + 1} has ${columnCount} columns; expected ${PREFLIGHT_RESULT_COLUMNS.length} (probe_id, classification, detail)`,
        });
      }
    });
  }

  return issues;
}

/**
 * Detects diagnostic SQL patterns that call xpath/XML parsers without runtime guards.
 * query_to_xml on zero rows returns an empty document and crashes xpath() at runtime.
 */
export function detectUnguardedXmlPatterns(sql: string): SqlAnalysisIssue[] {
  const issues: SqlAnalysisIssue[] = [];
  const executable = stripSqlComments(sql);
  const lower = executable.toLowerCase();

  if (/\bxpath\s*\(/.test(lower)) {
    const hasWellFormedGuard = /\bxml_is_well_formed_document\s*\(/.test(lower);
    const usesQueryToXml = /\bquery_to_xml\s*\(/.test(lower);
    if (!hasWellFormedGuard || usesQueryToXml) {
      issues.push({
        kind: "unguarded_xpath",
        message: usesQueryToXml
          ? "xpath(query_to_xml(...)) is unsafe when the source query returns zero rows (empty XML document)"
          : "xpath(...) without xml_is_well_formed_document guard",
      });
    }
  }

  if (/\bxmlparse\s*\(\s*document\b/i.test(executable)) {
    if (!/\bxml_is_well_formed_document\s*\(/.test(lower)) {
      issues.push({
        kind: "unguarded_xmlparse",
        message: "xmlparse(document ...) without xml_is_well_formed_document guard",
      });
    }
  }

  const xmlCastPattern = /(?<!xml_is_well_formed_document\s*\(\s*)'[^']*'::xml\b/gi;
  if (xmlCastPattern.test(executable) && !/\bxml_is_well_formed_document\s*\(/.test(lower)) {
    issues.push({
      kind: "unguarded_xml_cast",
      message: "direct ::xml cast without xml_is_well_formed_document guard",
    });
  }

  return issues;
}

function hasToRegclassGuard(sql: string, relname: string): boolean {
  return new RegExp(`to_regclass\\s*\\(\\s*'public\\.${relname}'\\s*\\)`, "i").test(sql);
}

export async function analyzePostgresSql(sql: string, options: AnalyzeOptions = {}): Promise<SqlAnalysisResult> {
  await loadModule();
  const trimmed = sql.trim();
  if (!trimmed) {
    return { statementCount: 0, issues: [{ kind: "empty_statement", message: "SQL is empty" }] };
  }

  const issues: SqlAnalysisIssue[] = [];

  let parsed: { stmts?: unknown[] };
  try {
    parsed = parseSync(trimmed) as { stmts?: unknown[] };
  } catch (error) {
    const message =
      error instanceof Error && "sqlDetails" in error
        ? formatSqlError(error as SqlError, trimmed, { showQuery: false })
        : error instanceof Error
          ? error.message
          : String(error);
    issues.push({
      kind: "syntax",
      message,
      position:
        error instanceof Error && "sqlDetails" in error && isRecord((error as SqlError).sqlDetails)
          ? ((error as SqlError).sqlDetails?.cursorPosition ?? undefined)
          : undefined,
    });
    return { statementCount: 0, issues };
  }

  const statements = parsed.stmts ?? [];
  const optionalSet = new Set(options.optionalRelations ?? []);
  validateCrossStatementCteScope(statements, issues);
  for (const stmt of statements) {
    if (options.requireSelectOnly) {
      const kind = getStatementKind(stmt);
      if (kind !== "SelectStmt") {
        issues.push({
          kind: "unsafe_write",
          message: `Non-SELECT statement detected in diagnostic SQL: ${kind ?? "unknown statement type"}`,
        });
      }
    }

    if (optionalSet.size > 0) {
      const refs: Array<{ relname: string; location?: number }> = [];
      collectRangeVarsInNode(stmt, refs);
      for (const ref of refs) {
        if (optionalSet.has(ref.relname) && !hasToRegclassGuard(trimmed, ref.relname)) {
          issues.push({
            kind: "direct_optional_reference",
            message: `Direct reference to optional relation "${ref.relname}" detected; use to_regclass guard or query_to_xml pattern`,
            position: ref.location,
          });
        }
      }
    }
    analyzeStatement(stmt, issues);
  }

  return { statementCount: statements.length, issues };
}
