import "server-only";

import { NextResponse } from "next/server";

import {
  buildRateLimitKey,
  checkRateLimit,
  RATE_LIMIT_PRESETS,
  type RateLimitConfig,
} from "./rateLimit";
import {
  rejectUnexpectedFields,
  rejectUnexpectedFormFields,
  type RejectUnexpectedFieldsOptions,
  type UnexpectedFieldsResult,
} from "./requestValidation";

export {
  RATE_LIMIT_PRESETS,
  rejectUnexpectedFields,
  rejectUnexpectedFormFields,
  type RejectUnexpectedFieldsOptions,
  type UnexpectedFieldsResult,
};
export type { RateLimitConfig } from "./rateLimit";

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

/** Alias for {@link parseJsonBodySafely}. */
export const parseJsonBodySafe = parseJsonBodySafely;

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

export type RateLimitGuardResult<T = never> =
  | { ok: true }
  | { ok: false; response: NextResponse<T> };

/**
 * Derives a stable rate-limit actor key: authenticated user id when available,
 * otherwise client IP (x-forwarded-for / x-real-ip) or "unknown".
 */
export function getRequestActorKey(
  request: Request,
  userId?: string | null,
): string {
  if (userId?.trim()) {
    return `user:${userId.trim()}`;
  }

  const { ip_address } = getRequestMetadata(request);
  if (ip_address) {
    return `ip:${ip_address}`;
  }

  return "ip:unknown";
}

/** Standard 429 JSON payload — routes may extend with route-specific `reason` fields. */
export function createRateLimitedResponse(retryAfterMs: number): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

  return NextResponse.json(
    {
      ok: false as const,
      error: "Too many requests. Please try again later.",
      retryAfterMs,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

/**
 * Applies in-memory rate limiting for the current request actor.
 * Returns a 429 response when the limit is exceeded.
 *
 * WARNING: Not suitable for multi-instance production — see rateLimit.ts.
 */
export function rateLimitOrThrow<T = never>(
  request: Request,
  options: {
    userId?: string | null;
    bucket: keyof typeof RATE_LIMIT_PRESETS | string;
    config?: RateLimitConfig;
  },
): RateLimitGuardResult<T> {
  const config =
    options.config ??
    (options.bucket in RATE_LIMIT_PRESETS
      ? RATE_LIMIT_PRESETS[options.bucket as keyof typeof RATE_LIMIT_PRESETS]
      : RATE_LIMIT_PRESETS.writeHeavy);

  const actorKey = getRequestActorKey(request, options.userId);
  const limitKey = buildRateLimitKey(options.bucket, actorKey);
  const result = checkRateLimit(limitKey, config);

  if (result.limited) {
    return {
      ok: false,
      response: createRateLimitedResponse(result.retryAfterMs) as NextResponse<T>,
    };
  }

  return { ok: true };
}

/** Returns 405 when the request method is not in the allowed list. */
export function assertAllowedMethods(
  request: Request,
  allowed: readonly string[],
): { ok: true } | { ok: false; response: NextResponse } {
  if (allowed.includes(request.method)) {
    return { ok: true };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "Method not allowed" },
      {
        status: 405,
        headers: { Allow: allowed.join(", ") },
      },
    ),
  };
}
