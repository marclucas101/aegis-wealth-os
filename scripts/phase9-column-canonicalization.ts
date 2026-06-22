/**
 * Phase 9 column default canonicalization — mirrors SQL in phase9_column_defs.cte.sql.
 * Used by regression tests; keep in sync with diagnostic SQL.
 */

export type ExpectedColumnParts = {
  dataType: string;
  nullable: "YES" | "NO";
  defaultRaw: string;
  udtName: string | null;
};

const USER_DEFINED_UDT_BY_OBJECT: Record<string, string> = {
  "clients.relationship_stage": "relationship_stage",
  "published_outputs.output_audience": "output_audience",
  "published_outputs.publication_status": "publication_status",
  "meeting_sessions.status": "meeting_session_status",
  "meeting_sessions.relationship_stage_at_start": "relationship_stage",
};

function stripOuterParens(value: string): string {
  let current = value.trim();
  for (let i = 0; i < 3; i += 1) {
    const match = current.match(/^\((.*)\)$/);
    if (!match) break;
    current = match[1].trim();
  }
  return current;
}

export function parseExpectedColumnDetail(
  expectedDetail: string,
  objectName: string,
): ExpectedColumnParts {
  const [dataType, nullable, ...defaultParts] = expectedDetail.split("|");
  const defaultRaw = defaultParts.join("|");
  const udtName =
    dataType === "USER-DEFINED"
      ? (USER_DEFINED_UDT_BY_OBJECT[objectName] ?? objectName.split(".")[1] ?? null)
      : null;
  return {
    dataType,
    nullable: nullable === "YES" ? "YES" : "NO",
    defaultRaw,
    udtName,
  };
}

export function canonicalizeColumnDefault(
  rawDefault: string | null | undefined,
  dataType: string,
  udtName: string | null,
): string {
  const raw = stripOuterParens((rawDefault ?? "").trim());
  if (!raw) return "";

  const type = dataType.toLowerCase();

  if (type === "json" || type === "jsonb") {
    const jsonbLiteral = raw.replace(/^'(.+)'::jsonb$/i, "$1").replace(/^'(.+)'$/i, "$1");
    if (jsonbLiteral === "{}") return "jsonb:{}";
    try {
      const parsed = JSON.parse(jsonbLiteral) as unknown;
      return `jsonb:${JSON.stringify(parsed)}`;
    } catch {
      return `raw:${raw}`;
    }
  }

  if (type === "boolean") {
    const lowered = stripOuterParens(raw).toLowerCase();
    if (["false", "'false'::boolean", "false::boolean"].includes(lowered)) return "boolean:false";
    if (["true", "'true'::boolean", "true::boolean"].includes(lowered)) return "boolean:true";
    return `raw:${raw}`;
  }

  if (dataType === "USER-DEFINED" && udtName) {
    const enumLabel =
      raw.match(/^'([^']+)'::[\w.]+$/i)?.[1] ??
      raw.match(/^'([^']+)'$/)?.[1] ??
      (raw.includes("(") || raw.includes("'") ? null : raw);
    if (enumLabel !== null) return `enum:${udtName}:${enumLabel}`;
    return `raw:${raw}`;
  }

  if (type === "text") {
    const textLabel = raw.match(/^'([^']+)'(::text)?$/i)?.[1];
    if (textLabel !== undefined) return `text:${textLabel}`;
    if (!raw.includes("(") && !raw.includes("'")) return `text:${raw}`;
    return `raw:${raw}`;
  }

  if (type === "uuid") {
    return raw ? `raw:${raw}` : "";
  }

  const numericMatch = raw.match(/^\(?(-?\d+(?:\.\d+)?)\)?(?:::)?[\w]*$/);
  if (numericMatch) return `numeric:${numericMatch[1]}`;

  return `raw:${raw}`;
}

export function canonicalizeExpectedColumn(
  expectedDetail: string,
  objectName: string,
): string {
  const parts = parseExpectedColumnDetail(expectedDetail, objectName);
  const typeKey =
    parts.dataType === "USER-DEFINED" && parts.udtName
      ? `USER-DEFINED|${parts.udtName}`
      : parts.dataType.toLowerCase();
  const defaultCanonical = canonicalizeColumnDefault(
    parts.defaultRaw,
    parts.dataType === "USER-DEFINED" ? "USER-DEFINED" : parts.dataType,
    parts.udtName,
  );
  return `${typeKey}|${parts.nullable}|${defaultCanonical}`;
}

export function canonicalizeActualColumn(
  dataType: string,
  udtSchema: string,
  udtName: string,
  isNullable: string,
  rawDefault: string,
): string {
  const typeKey =
    dataType === "USER-DEFINED"
      ? `USER-DEFINED|${udtName}`
      : dataType.toLowerCase();
  const defaultCanonical = canonicalizeColumnDefault(
    rawDefault,
    dataType,
    dataType === "USER-DEFINED" ? udtName : null,
  );
  return `${typeKey}|${isNullable}|${defaultCanonical}`;
}

export function columnDefinitionsConflict(
  expectedDetail: string,
  objectName: string,
  actual: {
    dataType: string;
    udtSchema: string;
    udtName: string;
    isNullable: string;
    rawDefault: string;
  },
): boolean {
  const expected = parseExpectedColumnDetail(expectedDetail, objectName);

  if (actual.isNullable !== expected.nullable) return true;

  if (expected.dataType === "USER-DEFINED") {
    if (actual.dataType !== "USER-DEFINED") return true;
    if (expected.udtName && actual.udtName !== expected.udtName) return true;
  } else if (actual.dataType.toLowerCase() !== expected.dataType.toLowerCase()) {
    return true;
  }

  if (expected.nullable === "YES" && expected.defaultRaw === "") {
    return false;
  }

  const actualDefault = (actual.rawDefault ?? "").trim();
  if (expected.nullable === "NO" && expected.defaultRaw !== "" && !actualDefault) {
    return true;
  }

  const expectedCanonical = canonicalizeExpectedColumn(expectedDetail, objectName);
  const actualCanonical = canonicalizeActualColumn(
    actual.dataType,
    actual.udtSchema,
    actual.udtName,
    actual.isNullable,
    actual.rawDefault,
  );
  return expectedCanonical !== actualCanonical;
}
