import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type AppHealthStatus = "ok" | "degraded" | "error";

export type AppHealthPayload = {
  ok: boolean;
  status: AppHealthStatus;
  timestamp: string;
  environment: string;
  version: string | null;
  uptimeSeconds: number | null;
};

export type SupabaseHealthPayload = {
  ok: boolean;
  timestamp: string;
  databaseReachable: boolean;
  tablesAccessible: boolean;
  error?: string;
};

const APP_START_TIME_MS = Date.now();

let cachedVersion: string | null | undefined;

export function isProductionHealthMode(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  );
}

export function resolveRuntimeEnvironment(): string {
  return (
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development"
  );
}

/** Reads package version without exposing secrets. Cached after first read. */
export function getAppVersion(): string | null {
  if (cachedVersion !== undefined) {
    return cachedVersion;
  }

  try {
    const packagePath = resolve(process.cwd(), "package.json");
    const raw = readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    cachedVersion =
      typeof parsed.version === "string" && parsed.version.trim()
        ? parsed.version.trim()
        : null;
  } catch {
    cachedVersion = null;
  }

  return cachedVersion;
}

export function getProcessUptimeSeconds(): number | null {
  if (typeof process.uptime === "function") {
    return Math.floor(process.uptime());
  }

  return Math.max(0, Math.floor((Date.now() - APP_START_TIME_MS) / 1000));
}

export function buildAppHealthPayload(): AppHealthPayload {
  const timestamp = new Date().toISOString();

  return {
    ok: true,
    status: "ok",
    timestamp,
    environment: resolveRuntimeEnvironment(),
    version: getAppVersion(),
    uptimeSeconds: getProcessUptimeSeconds(),
  };
}

export function sanitizeHealthErrorMessage(message: string): string {
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/(service[_-]?role|anon|api)[_-]?key[=:\s]+[^\s]+/gi, "[redacted]")
    .replace(/\b(public\.|from\s+)\w+/gi, "[redacted]");
}

export function isDatabaseConnectionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound") ||
    normalized.includes("timeout") ||
    normalized.includes("failed to fetch")
  );
}
