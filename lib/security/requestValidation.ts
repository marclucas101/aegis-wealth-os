import "server-only";

export type UnexpectedFieldsResult =
  | { rejected: true; error: string }
  | { rejected: false };

export type RejectUnexpectedFieldsOptions = {
  /** Reject client_id / clientId (default true). Set false when body may include client scope. */
  rejectClientId?: boolean;
  /** Allow role field (admin role update route only). */
  allowRole?: boolean;
  /** Additional field names to reject. */
  extraFields?: readonly string[];
  /** Sensitive fields explicitly allowed for this route. */
  allowFields?: readonly string[];
};

const SENSITIVE_FIELDS = [
  "user_id",
  "userId",
  "advisor_id",
  "advisorId",
  "client_id",
  "clientId",
  "role",
  "service_role",
  "serviceRole",
] as const;

function buildForbiddenList(
  options: RejectUnexpectedFieldsOptions,
): string[] {
  const allow = new Set(options.allowFields ?? []);
  const fields: string[] = [];

  for (const field of SENSITIVE_FIELDS) {
    if (allow.has(field)) continue;

    if (
      (field === "client_id" || field === "clientId") &&
      options.rejectClientId === false
    ) {
      continue;
    }

    if (field === "role" && options.allowRole) {
      continue;
    }

    fields.push(field);
  }

  if (options.extraFields?.length) {
    for (const field of options.extraFields) {
      if (!allow.has(field)) {
        fields.push(field);
      }
    }
  }

  return fields;
}

function findForbiddenKey(
  record: Record<string, unknown>,
  forbiddenKeys: string[],
): string | null {
  for (const key of forbiddenKeys) {
    if (key in record) {
      return key;
    }
  }

  return null;
}

/**
 * Rejects request bodies that supply privileged identity or escalation fields.
 * Does not validate shape — only blocks sensitive keys the server must derive.
 */
export function rejectUnexpectedFields(
  body: unknown,
  options: RejectUnexpectedFieldsOptions = {},
): UnexpectedFieldsResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { rejected: false };
  }

  const rejectClientId = options.rejectClientId !== false;
  const forbiddenKeys = buildForbiddenList({
    ...options,
    rejectClientId,
  });

  const hit = findForbiddenKey(body as Record<string, unknown>, forbiddenKeys);
  if (hit) {
    return {
      rejected: true,
      error: `${hit} must not be supplied by the client`,
    };
  }

  return { rejected: false };
}

/** Rejects multipart form fields that supply privileged identity fields. */
export function rejectUnexpectedFormFields(
  formData: FormData,
  options: RejectUnexpectedFieldsOptions = {},
): UnexpectedFieldsResult {
  const rejectClientId = options.rejectClientId !== false;
  const forbiddenKeys = buildForbiddenList({
    ...options,
    rejectClientId,
  });

  for (const key of forbiddenKeys) {
    if (formData.has(key)) {
      return {
        rejected: true,
        error: `${key} must not be supplied by the client`,
      };
    }
  }

  return { rejected: false };
}
