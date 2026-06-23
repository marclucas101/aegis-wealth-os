/**
 * Phase 9F.3 binder_exports partial-index predicate canonicalisation.
 * Mirrors SQL in phase9f3_202606200010_resolved_core.sql — keep in sync.
 */

const QUALIFICATION_PATTERN = /\b(?:public\.)?binder_exports\./gi;
const SIMPLE_QUALIFICATION_PATTERN = /\b(?:public\.)?binder_exports\./gi;
const CAST_PATTERN = /::(?:text|uuid|boolean|timestamp|timestamptz)\b/gi;
const WHITESPACE_PATTERN = /\s+/g;

function normalizePredicatePart(part: string): string {
  let s = part.replace(QUALIFICATION_PATTERN, "");
  s = s.replace(CAST_PATTERN, "");
  s = s.replace(/'([^']+)'::text/gi, "'$1'");
  s = s.replace(WHITESPACE_PATTERN, " ").toLowerCase().trim();
  return stripWrappingParens(s);
}

function stripWrappingParens(s: string): string {
  let t = s.trim();
  for (let i = 0; i < 8; i++) {
    const m = t.match(/^\((.*)\)$/);
    if (!m) break;
    const inner = m[1].trim();
    if (inner === t) break;
    t = inner;
  }
  return t;
}

/**
 * Anchored normalization for single-column IS NOT NULL partial-index predicates.
 * Does not strip casts or split conjuncts — used only for generation_idempotent
 * and published_document catalog checks.
 */
export function anchorNormalizeSimpleIsNotNullPredicate(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;

  let s = raw.replace(/^\s*where\s+/i, "").trim();
  if (s === "") return null;

  s = s.replace(SIMPLE_QUALIFICATION_PATTERN, "");
  s = s.replace(WHITESPACE_PATTERN, " ").toLowerCase().trim();

  return stripWrappingParens(s);
}

export function matchesAnchoredSimpleIsNotNullPredicate(
  raw: string | null | undefined,
  column: string,
): boolean {
  const normalized = anchorNormalizeSimpleIsNotNullPredicate(raw);
  const expected = `${column.toLowerCase()} is not null`;
  if (normalized !== expected) return false;
  if (/\bor\b/i.test(normalized)) return false;
  if (/\band\b/i.test(normalized)) return false;
  return true;
}

export function canonicalizeBinderIndexPredicate(
  raw: string | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;

  let s = raw.replace(/^\s*where\s+/i, "").trim();
  if (s === "") return null;

  s = s.replace(QUALIFICATION_PATTERN, "");
  s = s.replace(CAST_PATTERN, "");
  s = s.replace(/'([^']+)'::text/gi, "'$1'");
  s = s.replace(WHITESPACE_PATTERN, " ").toLowerCase().trim();

  if (/\sand\s/.test(s)) {
    const conjuncts = s
      .split(/\s+and\s+/i)
      .map((part) => normalizePredicatePart(part))
      .filter(Boolean)
      .sort();
    return conjuncts.join(" and ");
  }

  return stripWrappingParens(s);
}

export function parseAndConjuncts(predicate: string): string[] {
  return predicate
    .split(/\s+and\s+/i)
    .map((term) => stripWrappingParens(term.trim()))
    .filter(Boolean)
    .sort();
}

export function matchesIsNotNullPredicate(
  canonical: string | null,
  column: string,
): boolean {
  if (!canonical) return false;
  const expected = `${column.toLowerCase()} is not null`;
  if (canonical !== expected) return false;
  if (/\bor\b/i.test(canonical)) return false;
  if (/\band\b/i.test(canonical)) return false;
  return true;
}

export function matchesAndPredicate(
  canonical: string | null,
  requiredConjuncts: string[],
): boolean {
  if (!canonical) return false;
  if (/\bor\b/i.test(canonical)) return false;

  const actual = parseAndConjuncts(canonical);
  const required = [...requiredConjuncts]
    .map((c) => canonicalizeBinderIndexPredicate(c) ?? c)
    .sort();

  if (actual.length !== required.length) return false;
  return actual.every((term, i) => term === required[i]);
}

export const PHASE9F3_PARTIAL_INDEX_PREDICATES = {
  generation_idempotent: "generation_idempotency_key IS NOT NULL",
  published_document: "published_document_id IS NOT NULL",
  client_published_current:
    "status = 'published_to_client' AND published_document_id IS NOT NULL",
  lineage_current_published:
    "status = 'published_to_client' AND withdrawn_at IS NULL",
} as const;

export function extractPhase9f3ResolvedCore(sql: string): string {
  const begin = "-- PHASE9F3_RESOLVED_CORE_BEGIN";
  const end = "-- PHASE9F3_RESOLVED_CORE_END";
  const start = sql.indexOf(begin);
  const stop = sql.indexOf(end);
  if (start < 0 || stop < 0 || stop <= start) {
    throw new Error("PHASE9F3_RESOLVED_CORE markers not found");
  }
  return sql.slice(start + begin.length, stop).trim();
}
