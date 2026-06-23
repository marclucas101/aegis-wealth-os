import "server-only";

export const PLANNING_OUTPUT_ERROR_CODES = {
  SOURCE_UNAVAILABLE: "PLANNING_OUTPUT_SOURCE_UNAVAILABLE",
  PREPARATION_FAILED: "PLANNING_OUTPUT_PREPARATION_FAILED",
  ALREADY_EXISTS: "PLANNING_OUTPUT_ALREADY_EXISTS",
  NOT_REVIEWABLE: "PLANNING_OUTPUT_NOT_REVIEWABLE",
  NOT_PUBLISHABLE: "PLANNING_OUTPUT_NOT_PUBLISHABLE",
  PUBLISH_FAILED: "PLANNING_OUTPUT_PUBLISH_FAILED",
  NOT_FOUND: "PLANNING_OUTPUT_NOT_FOUND",
  ALREADY_PUBLISHED: "PLANNING_OUTPUT_ALREADY_PUBLISHED",
  VERSION_CONFLICT: "PLANNING_OUTPUT_VERSION_CONFLICT",
  ACCESS_DENIED: "PLANNING_OUTPUT_ACCESS_DENIED",
} as const;

export type PlanningOutputOperation = "prepare" | "review" | "publish" | "withdraw";

export type PlanningOutputErrorCode =
  (typeof PLANNING_OUTPUT_ERROR_CODES)[keyof typeof PLANNING_OUTPUT_ERROR_CODES];

export class PlanningOutputError extends Error {
  readonly code: PlanningOutputErrorCode;
  readonly httpStatus: number;

  constructor(
    code: PlanningOutputErrorCode,
    message: string,
    httpStatus = 422,
  ) {
    super(message);
    this.name = "PlanningOutputError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type PlanningOutputPublicError = {
  code: PlanningOutputErrorCode | string;
  message: string;
};

export function resolvePlanningOutputPublicError(
  err: unknown,
  options: {
    fallbackMessage?: string;
    operation?: PlanningOutputOperation;
  } = {},
): PlanningOutputPublicError & { httpStatus: number } {
  const fallbackMessage =
    options.fallbackMessage ??
    (options.operation === "publish"
      ? "The output could not be published. Please try again."
      : options.operation === "review"
        ? "The output could not be reviewed. Please try again."
        : "The output could not be prepared. Please try again.");

  const defaultFailureCode =
    options.operation === "publish"
      ? PLANNING_OUTPUT_ERROR_CODES.PUBLISH_FAILED
      : options.operation === "review"
        ? PLANNING_OUTPUT_ERROR_CODES.NOT_REVIEWABLE
        : PLANNING_OUTPUT_ERROR_CODES.PREPARATION_FAILED;

  if (err instanceof PlanningOutputError) {
    return {
      code: err.code,
      message: err.message,
      httpStatus: err.httpStatus,
    };
  }

  if (err instanceof Error) {
    if (err.message.includes("Only draft outputs can be reviewed")) {
      return {
        code: PLANNING_OUTPUT_ERROR_CODES.NOT_REVIEWABLE,
        message: "This output is not in a reviewable draft state.",
        httpStatus: 409,
      };
    }
    if (err.message.includes("Output must be adviser_reviewed before publishing")) {
      return {
        code: PLANNING_OUTPUT_ERROR_CODES.NOT_PUBLISHABLE,
        message: "This output must be reviewed before it can be published.",
        httpStatus: 409,
      };
    }
    if (
      err.message.includes("Published output not found") ||
      err.message.includes("Failed to load published output")
    ) {
      return {
        code: PLANNING_OUTPUT_ERROR_CODES.NOT_FOUND,
        message: "Planning output not found.",
        httpStatus: 404,
      };
    }
    if (err.message.includes("Adviser assignment required")) {
      return {
        code: PLANNING_OUTPUT_ERROR_CODES.ACCESS_DENIED,
        message: "You no longer have access to prepare outputs for this client.",
        httpStatus: 403,
      };
    }
    if (err.message.includes("Cannot modify output in terminal status")) {
      return {
        code: PLANNING_OUTPUT_ERROR_CODES.NOT_PUBLISHABLE,
        message: "This output can no longer be published.",
        httpStatus: 409,
      };
    }
    if (err.message.includes("Failed to update published output")) {
      return {
        code: PLANNING_OUTPUT_ERROR_CODES.VERSION_CONFLICT,
        message: fallbackMessage,
        httpStatus: 409,
      };
    }
    if (
      options.operation === "publish" &&
      (err.message.includes("Non-allowlisted key") ||
        err.message.includes("Invalid financial readiness payload") ||
        err.message.includes("Client-safe payload must be a plain object"))
    ) {
      return {
        code: PLANNING_OUTPUT_ERROR_CODES.PUBLISH_FAILED,
        message: fallbackMessage,
        httpStatus: 500,
      };
    }
  }

  return {
    code: defaultFailureCode,
    message: fallbackMessage,
    httpStatus: 500,
  };
}
