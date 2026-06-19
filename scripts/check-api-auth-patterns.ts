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

type AuthKind =
  | "public"
  | "client"
  | "advisor"
  | "admin"
  | "optional"
  | "oauth-callback"
  | "debug-gated"
  | "cron-gated"
  | "unknown";

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
  hasJsonBodyParsing: boolean;
  isWrite: boolean;
};

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** Service-layer functions that write audit logs (scanner recognition). */
export const SERVICE_AUDIT_PATTERNS = [
  "prepareClientSafeOutput",
  "publishOutput",
  "reviewPublishedOutput",
  "withdrawOutput",
  "updateRelationshipStage",
  "setFeatureControl",
  "createMeetingSession",
  "saveMeetingPreparation",
  "startMeetingSession",
  "completeMeetingSession",
  "confirmMeetingFact",
  "recordAcknowledgement",
  "prepareMeetingSummary",
  "recordSectionShown",
  "submitClientReviewInformation",
  "recordActiveClientEvent",
] as const;

function hasServiceLayerAudit(source: string): boolean {
  return SERVICE_AUDIT_PATTERNS.some((pattern) => source.includes(pattern));
}

/**
 * Audited route-level guards and loaders.
 * Each entry is verified to establish auth via server session + DB assignment.
 * See docs/SECURITY_API_WARNINGS_AUDIT.md for audit evidence.
 */
export const AUDITED_AUTH_PATTERNS: ReadonlyArray<{
  pattern: string;
  kind: Exclude<AuthKind, "unknown" | "optional">;
  note: string;
}> = [
  { pattern: "requireAdminAccess", kind: "admin", note: "Central admin gate" },
  { pattern: "requireAdvisorAccess", kind: "advisor", note: "Central adviser gate" },
  {
    pattern: "requireAdvisorMeetingAuth",
    kind: "advisor",
    note: "Meeting Studio routes — wraps requireAdvisorAccess",
  },
  {
    pattern: "ensureUserClientProfile",
    kind: "client",
    note: "Supabase session + client row",
  },
  {
    pattern: "loadAssignedAdviserContact",
    kind: "client",
    note: "Assigned adviser contact via ensureUserClientProfile",
  },
  {
    pattern: "loadMyAdviserPageData",
    kind: "client",
    note: "My Adviser page via ensureUserClientProfile + advisor_user_id",
  },
  {
    pattern: "listClientUpcomingAppointments",
    kind: "client",
    note: "Client appointments filtered by session.authUser.id",
  },
  {
    pattern: "listAvailabilityForAssignedAdviser",
    kind: "client",
    note: "Availability for clients.advisor_user_id assignment only",
  },
  {
    pattern: "submitAdviserFeedback",
    kind: "client",
    note: "Feedback tied to session client + advisor_user_id",
  },
  {
    pattern: "loadFeedbackPromptState",
    kind: "client",
    note: "Prompt state via ensureUserClientProfile",
  },
  {
    pattern: "dismissFeedbackPrompt",
    kind: "client",
    note: "Dismiss updates session.client.id only",
  },
  {
    pattern: "verifyOAuthState",
    kind: "oauth-callback",
    note: "HMAC-signed OAuth state binds adviserUserId",
  },
  {
    pattern: "blockDebugRouteInProduction",
    kind: "debug-gated",
    note: "Returns 404 in production",
  },
  {
    pattern: "assertActiveClientPortalAccess",
    kind: "client",
    note: "Phase 9D active-client portal API gate",
  },
  {
    pattern: "assertClientFeatureApiAccess",
    kind: "client",
    note: "Phase 9D client feature entitlement gate",
  },
  {
    pattern: "validateCronSecret",
    kind: "cron-gated",
    note: "Internal cron secret gate",
  },
];

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

export function detectAuthKind(source: string, routePath: string): AuthKind {
  for (const entry of AUDITED_AUTH_PATTERNS) {
    if (source.includes(entry.pattern)) {
      return entry.kind;
    }
  }

  if (
    source.includes("ensureUserClientProfile") &&
    source.includes("authenticated: false")
  ) {
    return "optional";
  }

  if (
    routePath.includes("/health/") ||
    source.includes("buildAppHealthPayload") ||
    source.includes("createAdminSupabaseClient")
  ) {
    return "public";
  }

  return "unknown";
}

function isSecuredAuthKind(authKind: AuthKind): boolean {
  return (
    authKind !== "unknown" &&
    authKind !== "public"
  );
}

export function analyzeRouteSource(
  source: string,
  routePath: string,
  file = "inline",
): RouteRecord {
  const methods = detectMethods(source);
  const authKind = detectAuthKind(source, routePath);
  const writeMethods = methods.filter((method) => method !== "GET");

  return {
    file,
    routePath,
    methods,
    authKind,
    hasRateLimit: source.includes("rateLimitOrThrow"),
    hasAuditLog:
      source.includes("writeAuditLog") || hasServiceLayerAudit(source),
    hasToPublicError: source.includes("toPublicErrorMessage"),
    hasRejectUnexpected: source.includes("rejectUnexpectedFields"),
    hasRejectClientId:
      source.includes("rejectClientIdInBody") ||
      source.includes("rejectClientIdInFormData"),
    hasJsonBodyParsing: source.includes("parseJsonBodySafely"),
    isWrite: writeMethods.length > 0,
  };
}

function analyzeRoute(filePath: string): RouteRecord {
  const source = readFileSync(filePath, "utf8");
  const routePath = filePathToRoutePath(filePath);

  return analyzeRouteSource(
    source,
    routePath,
    relative(ROOT, filePath).replace(/\\/g, "/"),
  );
}

export function auditRoutes(routes: RouteRecord[]): RouteFinding[] {
  const findings: RouteFinding[] = [];

  for (const route of routes) {
    if (route.authKind === "unknown") {
      findings.push({
        severity: "warn",
        routePath: route.routePath,
        file: route.file,
        message:
          "No recognizable auth guard (requireAdmin/Advisor, ensureUserClientProfile, audited loaders, OAuth state, or documented public health)",
      });
    }

    if (route.authKind === "public" && !route.routePath.includes("/health/")) {
      findings.push({
        severity: "warn",
        routePath: route.routePath,
        file: route.file,
        message:
          "Uses service role without documented public-health exception",
      });
    }

    const writeMethods = route.methods.filter((method) => method !== "GET");
    if (
      writeMethods.length > 0 &&
      isSecuredAuthKind(route.authKind) &&
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
        message:
          "Write route missing toPublicErrorMessage in catch path — verify error sanitization",
      });
    }

    if (
      route.isWrite &&
      route.authKind === "client" &&
      route.hasJsonBodyParsing &&
      !route.hasRejectClientId &&
      !route.hasRejectUnexpected &&
      !route.routePath.includes("/signed-url")
    ) {
      findings.push({
        severity: "review",
        routePath: route.routePath,
        file: route.file,
        message:
          "Client write without rejectClientId/rejectUnexpectedFields — verify body validation",
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
  console.log("Warning audit: docs/SECURITY_API_WARNINGS_AUDIT.md");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Scanner self-test failed: ${message}`);
  }
}

function runSelfTests(): void {
  const unguarded = analyzeRouteSource(
    `export async function GET() { return Response.json({ ok: true }); }`,
    "/api/fixture/unguarded",
  );
  assert(unguarded.authKind === "unknown", "unguarded route must stay unknown");

  const unguardedFindings = auditRoutes([unguarded]);
  assert(
    unguardedFindings.some((f) => f.severity === "warn"),
    "unguarded route must produce WARN",
  );

  const myAdviser = analyzeRouteSource(
    `import { loadMyAdviserPageData } from "@/lib/supabase/adviserProfilePersistence";
     export async function GET() { await loadMyAdviserPageData(); }`,
    "/api/my-adviser",
  );
  assert(
    myAdviser.authKind === "client",
    "loadMyAdviserPageData must classify as client",
  );

  const oauth = analyzeRouteSource(
    `import { verifyOAuthState } from "@/lib/google/oauthState";
     export async function GET() { verifyOAuthState("x"); }`,
    "/api/google-calendar/callback",
  );
  assert(
    oauth.authKind === "oauth-callback",
    "verifyOAuthState must classify as oauth-callback",
  );

  const debug = analyzeRouteSource(
    `import { blockDebugRouteInProduction } from "@/lib/security/debugRouteGuard";
     export async function GET() { blockDebugRouteInProduction(); }`,
    "/api/debug/auth-cookies",
  );
  assert(
    debug.authKind === "debug-gated",
    "blockDebugRouteInProduction must classify as debug-gated",
  );

  const noRateLimit = analyzeRouteSource(
    `import { ensureUserClientProfile } from "@/lib/supabase/userProfile";
     export async function POST() { await ensureUserClientProfile(); }`,
    "/api/fixture/write-no-rl",
  );
  const rlFindings = auditRoutes([noRateLimit]);
  assert(
    rlFindings.some((f) => f.message.includes("missing rateLimitOrThrow")),
    "secured write without rate limit must WARN",
  );

  const emptyBodyDismiss = analyzeRouteSource(
    `import { dismissFeedbackPrompt } from "@/lib/supabase/adviserFeedbackPersistence";
     import { rateLimitOrThrow } from "@/lib/security/apiGuards";
     export async function POST(request: Request) {
       rateLimitOrThrow(request, { bucket: "writeHeavy" });
       await dismissFeedbackPrompt();
     }`,
    "/api/adviser-feedback/prompt",
  );
  const dismissFindings = auditRoutes([emptyBodyDismiss]);
  assert(
    !dismissFindings.some(
      (f) =>
        f.severity === "review" &&
        f.message.includes("rejectClientId"),
    ),
    "body-less client POST must not trigger rejectClientId REVIEW",
  );

  console.log("  OK   Scanner self-tests passed (6 cases)");
}

function main(): void {
  runSelfTests();

  const files = walkRouteFiles(API_ROOT);
  const routes = files.map(analyzeRoute);
  const findings = auditRoutes(routes);

  console.log(`\nAPI security scan — ${routes.length} route handler file(s)\n`);
  printInventory(routes);
  printFindings(findings);

  const hasWarn = findings.some((f) => f.severity === "warn");
  if (hasWarn) {
    process.exitCode = 1;
  }
}

main();
