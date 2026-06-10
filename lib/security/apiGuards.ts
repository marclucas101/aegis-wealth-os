import "server-only";

export type JsonParseResult =
  | { ok: true; body: unknown }
  | { ok: false; error: string };

export type ClientIdRejectResult =
  | { rejected: true; error: string }
  | { rejected: false };

export type RequestMetadata = {
  ip_address: string | null;
  user_agent: string | null;
};

export type StringValidationResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

export type EnumValidationResult<T extends string> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const CLIENT_ID_REJECT_ERROR =
  "client_id must not be supplied by the client";

/** Rejects request bodies that attempt to supply client_id / clientId. */
export function rejectClientIdInBody(body: unknown): ClientIdRejectResult {
  if (
    body &&
    typeof body === "object" &&
    ("clientId" in body || "client_id" in body)
  ) {
    return { rejected: true, error: CLIENT_ID_REJECT_ERROR };
  }

  return { rejected: false };
}

/** Rejects multipart form submissions that attempt to supply client_id / clientId. */
export function rejectClientIdInFormData(
  formData: FormData,
): ClientIdRejectResult {
  if (formData.has("client_id") || formData.has("clientId")) {
    return { rejected: true, error: CLIENT_ID_REJECT_ERROR };
  }

  return { rejected: false };
}

/**
 * Parses JSON from a request body without throwing.
 * When allowEmpty is true, an empty body resolves to null.
 */
export async function parseJsonBodySafely(
  request: Request,
  options?: { allowEmpty?: boolean },
): Promise<JsonParseResult> {
  try {
    const text = await request.text();

    if (!text.trim()) {
      if (options?.allowEmpty) {
        return { ok: true, body: null };
      }

      return { ok: false, error: "Request body is required" };
    }

    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
}

/** Extracts client IP and user agent from standard proxy headers. */
export function getRequestMetadata(request: Request): RequestMetadata {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip_address =
    forwarded?.split(",")[0]?.trim() ?? realIp?.trim() ?? null;
  const user_agent = request.headers.get("user-agent");

  return {
    ip_address,
    user_agent: user_agent?.trim() ? user_agent.trim() : null,
  };
}

/** Validates a required non-empty string field. */
export function validateRequiredString(
  value: unknown,
  fieldName: string,
): StringValidationResult {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: `Missing or invalid ${fieldName}` };
  }

  return { ok: true, value: value.trim() };
}

/** Validates that a value is one of the allowed enum strings. */
export function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fieldName: string,
): EnumValidationResult<T> {
  if (
    typeof value !== "string" ||
    !(allowed as readonly string[]).includes(value)
  ) {
    return { ok: false, error: `Missing or invalid ${fieldName}` };
  }

  return { ok: true, value: value as T };
}

const PUBLIC_ERROR_MESSAGES = new Set([
  "Roadmap item not found",
  "Document not found",
  "no_profile",
]);

const USER_FACING_VALIDATION_FRAGMENTS = [
  "size limit",
  "not supported",
  "MIME type",
  "empty",
  "required",
  "invalid",
  "must not be supplied",
];

/**
 * Maps internal/server errors to safe client-facing messages.
 * Preserves known user-facing validation and not-found errors.
 */
export function toPublicErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) {
    return fallback;
  }

  const message = err.message;

  if (PUBLIC_ERROR_MESSAGES.has(message)) {
    return message;
  }

  const isUserFacing = USER_FACING_VALIDATION_FRAGMENTS.some((fragment) =>
    message.toLowerCase().includes(fragment),
  );

  if (isUserFacing) {
    return message;
  }

  return fallback;
}
