/**
 * Scans app/api for route.ts handlers and prints an inventory with review flags.
 * Run: npx tsx scripts/check-api-routes.ts
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

type RouteRecord = {
  file: string;
  routePath: string;
  methods: string[];
  hasAuth: boolean;
  authKind: "public" | "client" | "advisor" | "admin" | "optional" | "unknown";
  hasRateLimit: boolean;
  hasAuditLog: boolean;
  isWrite: boolean;
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function walkRouteFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkRouteFiles(fullPath, acc);
      continue;
    }

    if (entry === "route.ts") {
      acc.push(fullPath);
    }
  }

  return acc.sort();
}

function filePathToRoutePath(filePath: string, apiRoot: string): string {
  const rel = relative(apiRoot, filePath).replace(/\\/g, "/");
  const withoutRoute = rel.replace(/\/route\.ts$/, "");
  const segments = withoutRoute.split("/").map((segment) => {
    if (segment.startsWith("[") && segment.endsWith("]")) {
      return `:${segment.slice(1, -1)}`;
    }
    return segment;
  });

  return `/api/${segments.join("/")}`;
}

function detectMethods(source: string): string[] {
  const methods: string[] = [];

  for (const method of HTTP_METHODS) {
    const pattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`);
    if (pattern.test(source)) {
      methods.push(method);
    }
  }

  return methods;
}

function detectAuthKind(source: string): RouteRecord["authKind"] {
  if (source.includes("requireAdminAccess")) return "admin";
  if (source.includes("requireAdvisorAccess")) return "advisor";
  if (
    source.includes("ensureUserClientProfile") &&
    source.includes('authenticated: false')
  ) {
    return "optional";
  }
  if (source.includes("ensureUserClientProfile")) return "client";
  if (source.includes("createAdminSupabaseClient")) return "public";
  return "unknown";
}

function hasWriteMethods(methods: string[]): boolean {
  return methods.some((method) => method !== "GET");
}

function analyzeRoute(filePath: string, apiRoot: string): RouteRecord {
  const source = readFileSync(filePath, "utf8");
  const methods = detectMethods(source);
  const authKind = detectAuthKind(source);
  const hasAuth = authKind !== "public" && authKind !== "unknown";
  const hasRateLimit = source.includes("rateLimitOrThrow");
  const hasAuditLog = source.includes("writeAuditLog");
  const isWrite = hasWriteMethods(methods);

  return {
    file: relative(process.cwd(), filePath).replace(/\\/g, "/"),
    routePath: filePathToRoutePath(filePath, apiRoot),
    methods,
    hasAuth,
    authKind,
    hasRateLimit,
    hasAuditLog,
    isWrite,
  };
}

function printTable(routes: RouteRecord[]): void {
  console.log(
    `${"Route".padEnd(58)} ${"Methods".padEnd(12)} Auth        RateLimit  Audit`,
  );
  console.log("-".repeat(98));

  for (const route of routes) {
    const methods = route.methods.join(",") || "?";
    console.log(
      `${route.routePath.padEnd(58)} ${methods.padEnd(12)} ${route.authKind.padEnd(11)} ${route.hasRateLimit ? "yes" : "no ".padEnd(9)} ${route.hasAuditLog ? "yes" : "no"}`,
    );
  }
}

function printReviewFlags(routes: RouteRecord[]): void {
  const writeWithoutRateLimit = routes.filter(
    (route) => route.isWrite && !route.hasRateLimit && route.authKind !== "public",
  );
  const unknownAuth = routes.filter((route) => route.authKind === "unknown");
  const writeWithoutAudit = routes.filter(
    (route) =>
      route.isWrite &&
      !route.hasAuditLog &&
      route.authKind !== "public" &&
      !route.routePath.includes("/signed-url"),
  );

  console.log("\nReview flags\n");

  if (writeWithoutRateLimit.length === 0) {
    console.log("  OK   No authenticated write routes missing rateLimitOrThrow");
  } else {
    console.log("  WARN Write routes without rate limiting (review before production):");
    for (const route of writeWithoutRateLimit) {
      console.log(`       ${route.routePath} (${route.methods.join(", ")})`);
    }
  }

  if (unknownAuth.length === 0) {
    console.log("  OK   All routes have a recognizable auth pattern");
  } else {
    console.log("  WARN Routes with unknown auth pattern:");
    for (const route of unknownAuth) {
      console.log(`       ${route.routePath}`);
    }
  }

  if (writeWithoutAudit.length > 0) {
    console.log("  INFO Write routes without audit logging (may be intentional):");
    for (const route of writeWithoutAudit) {
      console.log(`       ${route.routePath} (${route.methods.join(", ")})`);
    }
  }
}

function main(): void {
  const apiRoot = join(process.cwd(), "app", "api");
  const files = walkRouteFiles(apiRoot);
  const routes = files.map((file) => analyzeRoute(file, apiRoot));

  console.log(`Detected ${routes.length} API route handler file(s)\n`);
  printTable(routes);
  printReviewFlags(routes);
  console.log(`\nFull inventory: docs/API_ROUTE_INVENTORY.md`);
}

main();
