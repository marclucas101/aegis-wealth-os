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
    | "unqualified_column"
    | "empty_statement";
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
        if (optionalSet.has(ref.relname)) {
          issues.push({
            kind: "direct_optional_reference",
            message: `Direct reference to optional relation "${ref.relname}" detected; use catalog gate/query_to_xml pattern`,
            position: ref.location,
          });
        }
      }
    }
    analyzeStatement(stmt, issues);
  }

  return { statementCount: statements.length, issues };
}
