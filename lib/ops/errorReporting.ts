import "server-only";

import { logger, type LogMetadata } from "./logger";

export type NormalizedError = {
  name: string;
  message: string;
  stack?: string;
  cause?: string;
};

export type ServerErrorContext = LogMetadata & {
  error?: unknown;
};

const PUBLIC_ERROR_MESSAGES = new Set([
  "Roadmap item not found",
  "Document not found",
  "no_profile",
]);

const USER_FACING_VALIDATION_FRAGMENTS = [
  "size limit",
  "not supported",
  "mime type",
  "empty",
  "required",
  "invalid",
  "must not be supplied",
];

/**
 * Converts unknown thrown values into a stable error shape for logging.
 */
export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      cause:
        err.cause instanceof Error
          ? err.cause.message
          : err.cause != null
            ? String(err.cause)
            : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: typeof err === "string" ? err : "Unknown error",
  };
}

/**
 * Maps internal/server errors to safe client-facing messages.
 * Preserves known user-facing validation and not-found errors.
 */
export function publicErrorMessage(err: unknown, fallback: string): string {
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

/**
 * Logs a server-side error with redacted metadata.
 *
 * Future integration points (not wired in Phase 4W):
 * - Sentry: Sentry.captureException(err, { extra: metadata })
 * - Logtail: logtail.error(message, metadata)
 * - Axiom: axiom.ingest({ level: "error", ...metadata })
 */
export function captureServerError(
  message: string,
  context: ServerErrorContext = {},
): NormalizedError {
  const { error, ...metadata } = context;
  const normalized = normalizeError(error ?? new Error(message));

  logger.error(message, {
    ...metadata,
    errorName: normalized.name,
    errorMessage: normalized.message,
    ...(process.env.NODE_ENV !== "production" && normalized.stack
      ? { stack: normalized.stack }
      : {}),
  });

  // Placeholder: forward to external error tracking when configured.
  // if (process.env.SENTRY_DSN) { /* Sentry.captureException(error) */ }
  // if (process.env.LOGTAIL_SOURCE_TOKEN) { /* Logtail client */ }
  // if (process.env.AXIOM_DATASET) { /* Axiom ingest */ }

  return normalized;
}
