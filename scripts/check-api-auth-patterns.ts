/**
 * Scans app/api route handlers for auth, rate-limit, and guard patterns.
 * Flags likely gaps as REVIEW items (may include false positives).
 *
 * Run: npm run security:api
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const API_ROOT = join(ROOT, "app", "api");

type AuthKind = "public" | "client" | "advisor" | "admin" | "optional" | "unknown";

type RouteFinding = {
  severity: "warn" | "review" | "info";
  routePath: string;
  file: string;
  message: string;
};

type RouteRecord = {
  file: string;
  routePath: string;
  methods: string[];
  authKind: AuthKind;
  hasRateLimit: boolean;
  hasAuditLog: boolean;
  hasToPublicError: boolean;
  hasRejectUnexpected: boolean;
  hasRejectClientId: boolean;
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

function filePathToRoutePath(filePath: string): string {
  const rel = relative(API_ROOT, filePath).replace(/\\/g, "/");
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

function detectAuthKind(source: string, routePath: string): AuthKind {
  if (source.includes("requireAdminAccess")) return "admin";
  if (source.includes("requireAdvisorAccess")) return "advisor";
  if (
    source.includes("ensureUserClientProfile") &&
    source.includes("authenticated: false")
  ) {
    return "optional";
  }
  if (source.includes("ensureUserClientProfile")) return "client";
  if (
    routePath.includes("/health/") ||
    source.includes("buildAppHealthPayload") ||
    source.includes("createAdminSupabaseClient")
  ) {
    return "public";
  }
  return "unknown";
}

function analyzeRoute(filePath: string): RouteRecord {
  const source = readFileSync(filePath, "utf8");
  const methods = detectMethods(source);
  const routePath = filePathToRoutePath(filePath);
  const authKind = detectAuthKind(source, routePath);
  const writeMethods = methods.filter((method) => method !== "GET");

  return {
    file: relative(ROOT, filePath).replace(/\\/g, "/"),
    routePath,
    methods,
    authKind,
    hasRateLimit: source.includes("rateLimitOrThrow"),
    hasAuditLog: source.includes("writeAuditLog"),
    hasToPublicError: source.includes("toPublicErrorMessage"),
    hasRejectUnexpected: source.includes("rejectUnexpectedFields"),
    hasRejectClientId:
      source.includes("rejectClientIdInBody") ||
      source.includes("rejectClientIdInFormData"),
    isWrite: writeMethods.length > 0,
  };
}

function auditRoutes(routes: RouteRecord[]): RouteFinding[] {
  const findings: RouteFinding[] = [];

  for (const route of routes) {
    if (route.authKind === "unknown") {
      findings.push({
        severity: "warn",
        routePath: route.routePath,
        file: route.file,
        message: "No recognizable auth guard (requireAdmin/Advisor, ensureUserClientProfile, or documented public health)",
      });
    }

    if (route.authKind === "public" && !route.routePath.includes("/health/")) {
      findings.push({
        severity: "warn",
        routePath: route.routePath,
        file: route.file,
        message: "Uses service role without documented public-health exception",
      });
    }

    const writeMethods = route.methods.filter((method) => method !== "GET");
    if (
      writeMethods.length > 0 &&
      route.authKind !== "public" &&
      route.authKind !== "optional" &&
      !route.hasRateLimit
    ) {
      findings.push({
        severity: "warn",
        routePath: route.routePath,
        file: route.file,
        message: `Write handler(s) ${writeMethods.join(", ")} missing rateLimitOrThrow`,
      });
    }

    if (
      route.isWrite &&
      route.authKind !== "public" &&
      !route.hasAuditLog &&
      !route.routePath.includes("/signed-url")
    ) {
      findings.push({
        severity: "info",
        routePath: route.routePath,
        file: route.file,
        message: "Write route without writeAuditLog — verify intentional",
      });
    }

    if (route.isWrite && !route.hasToPublicError) {
      findings.push({
        severity: "review",
        routePath: route.routePath,
        file: route.file,
        message: "Write route missing toPublicErrorMessage in catch path — verify error sanitization",
      });
    }

    if (
      route.isWrite &&
      route.authKind === "client" &&
      !route.hasRejectClientId &&
      !route.hasRejectUnexpected &&
      !route.routePath.includes("/signed-url")
    ) {
      findings.push({
        severity: "review",
        routePath: route.routePath,
        file: route.file,
        message: "Client write without rejectClientId/rejectUnexpectedFields — verify body validation",
      });
    }
  }

  return findings;
}

function printInventory(routes: RouteRecord[]): void {
  console.log(
    `${"Route".padEnd(58)} ${"Methods".padEnd(12)} Auth        RL   Audit`,
  );
  console.log("-".repeat(90));

  for (const route of routes) {
    const methods = route.methods.join(",") || "?";
    console.log(
      `${route.routePath.padEnd(58)} ${methods.padEnd(12)} ${route.authKind.padEnd(11)} ${route.hasRateLimit ? "yes" : "no "}  ${route.hasAuditLog ? "yes" : "no"}`,
    );
  }
}

function printFindings(findings: RouteFinding[]): void {
  console.log("\nSecurity pattern findings\n");

  const warns = findings.filter((f) => f.severity === "warn");
  const reviews = findings.filter((f) => f.severity === "review");
  const infos = findings.filter((f) => f.severity === "info");

  if (warns.length === 0) {
    console.log("  OK   No WARN-level auth/rate-limit gaps");
  } else {
    console.log(`  WARN ${warns.length} item(s):`);
    for (const finding of warns) {
      console.log(`       ${finding.routePath} — ${finding.message}`);
    }
  }

  if (reviews.length > 0) {
    console.log(`  REVIEW ${reviews.length} item(s) (manual verification):`);
    for (const finding of reviews) {
      console.log(`       ${finding.routePath} — ${finding.message}`);
    }
  }

  if (infos.length > 0) {
    console.log(`  INFO ${infos.length} item(s):`);
    for (const finding of infos) {
      console.log(`       ${finding.routePath} — ${finding.message}`);
    }
  }

  console.log("\nFull report: docs/API_SECURITY_REVIEW.md");
}

function main(): void {
  const files = walkRouteFiles(API_ROOT);
  const routes = files.map(analyzeRoute);
  const findings = auditRoutes(routes);

  console.log(`API security scan — ${routes.length} route handler file(s)\n`);
  printInventory(routes);
  printFindings(findings);

  const hasWarn = findings.some((f) => f.severity === "warn");
  if (hasWarn) {
    process.exitCode = 1;
  }
}

main();
