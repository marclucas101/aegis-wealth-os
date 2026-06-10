import "server-only";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMetadata = {
  route?: string;
  action?: string;
  userRole?: string | null;
  status?: number | string;
  timingMs?: number;
  requestId?: string;
  [key: string]: unknown;
};

export type StructuredLogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: "aegis-wealth-os";
  environment: string;
  metadata?: Record<string, unknown>;
};

const REDACTED = "[redacted]";

const SENSITIVE_KEY_PATTERN =
  /^(password|token|access[_-]?token|refresh[_-]?token|service[_-]?role|servicerole|authorization|cookie|api[_-]?key|secret|supabase[_-]?key)$/i;

const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(service[_-]?role|anon|api)[_-]?key[=:\s]+[^\s]+/gi,
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /sb_[a-z]+_[A-Za-z0-9_-]+/gi,
];

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key.trim());
}

function redactString(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[max-depth]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTED;
      } else {
        result[key] = redactValue(nested, depth + 1);
      }
    }
    return result;
  }

  return redactString(String(value));
}

function sanitizeMetadata(
  metadata?: LogMetadata,
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized = redactValue(metadata) as Record<string, unknown>;
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function resolveEnvironment(): string {
  return (
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development"
  );
}

function shouldLogDebug(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  );
}

function writeLog(level: LogLevel, message: string, metadata?: LogMetadata): void {
  const entry: StructuredLogEntry = {
    level,
    message: redactString(message),
    timestamp: new Date().toISOString(),
    service: "aegis-wealth-os",
    environment: resolveEnvironment(),
    metadata: sanitizeMetadata(metadata),
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      if (shouldLogDebug()) {
        console.debug(line);
      }
      break;
    default:
      console.info(line);
  }
}

/** Generates a lightweight request correlation id when none is supplied. */
export function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function logInfo(message: string, metadata?: LogMetadata): void {
  writeLog("info", message, metadata);
}

export function logWarn(message: string, metadata?: LogMetadata): void {
  writeLog("warn", message, metadata);
}

export function logError(message: string, metadata?: LogMetadata): void {
  writeLog("error", message, metadata);
}

export function logDebug(message: string, metadata?: LogMetadata): void {
  writeLog("debug", message, metadata);
}

export const logger = {
  info: logInfo,
  warn: logWarn,
  error: logError,
  debug: logDebug,
  createRequestId,
  redactValue,
} as const;
