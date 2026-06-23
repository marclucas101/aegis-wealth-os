import "server-only";

/** Stable operational error codes for binder generation — safe for API responses. */
export const BINDER_ERROR_CODES = {
  RENDER_FAILED: "BINDER_RENDER_FAILED",
  STORAGE_FAILED: "BINDER_STORAGE_FAILED",
  TOO_LARGE: "BINDER_TOO_LARGE",
  SOURCE_UNAVAILABLE: "BINDER_SOURCE_UNAVAILABLE",
  GENERATION_CONFLICT: "BINDER_GENERATION_CONFLICT",
  NOT_READY: "BINDER_NOT_READY",
  ACCESS_DENIED: "BINDER_ACCESS_DENIED",
  PUBLICATION_DENIED: "BINDER_PUBLICATION_DENIED",
  NOT_PUBLISHABLE: "BINDER_NOT_PUBLISHABLE",
  ALREADY_WITHDRAWN: "BINDER_ALREADY_WITHDRAWN",
  PUBLICATION_CONFLICT: "BINDER_PUBLICATION_CONFLICT",
  CONFIRMATION_REQUIRED: "BINDER_CONFIRMATION_REQUIRED",
  READINESS_FAILED: "BINDER_READINESS_FAILED",
  READINESS_INVALID_INPUT: "BINDER_READINESS_INVALID_INPUT",
  INVALID_SECTIONS: "BINDER_INVALID_SECTIONS",
} as const;

export type BinderErrorCode =
  (typeof BINDER_ERROR_CODES)[keyof typeof BINDER_ERROR_CODES];

export class BinderServiceError extends Error {
  readonly code: BinderErrorCode;

  constructor(code: BinderErrorCode, message?: string) {
    super(message ?? code);
    this.name = "BinderServiceError";
    this.code = code;
  }
}

export function toBinderPublicError(
  err: unknown,
  fallback = "Binder operation failed",
): { error: string; code?: BinderErrorCode } {
  if (err instanceof BinderServiceError) {
    return { error: err.code, code: err.code };
  }
  return { error: fallback };
}
