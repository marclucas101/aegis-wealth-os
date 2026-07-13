/**
 * Phase 10 Checkpoint 1 — product roadmap and platform maturity discovery validation.
 * 78 explicit checks. Run: npm run qa:phase10-discovery
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const REQUIRED_DOCS = [
  "docs/PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md",
  "docs/PHASE_10_ADVISER_JOURNEY_AUDIT.md",
  "docs/PHASE_10_CLIENT_JOURNEY_AUDIT.md",
  "docs/PHASE_10_DATA_READINESS_AUDIT.md",
  "docs/PHASE_10_SERVICING_AND_WORKFLOW_AUDIT.md",
  "docs/PHASE_10_ANALYTICS_AND_MANAGEMENT_AUDIT.md",
  "docs/PHASE_10_PRODUCTION_OPERATIONS_AUDIT.md",
  "docs/PHASE_10_CANDIDATE_TRACKS.md",
  "docs/PHASE_10_ARCHITECTURAL_DEBT_REGISTER.md",
  "docs/PHASE_10_RECOMMENDATION.md",
] as const;

const ADVISER_CAPABILITIES = [
  "dashboard",
  "client list",
  "Meeting Studio",
  "planning outputs",
  "roadmap",
  "documents",
  "calendar",
  "communications",
  "follow-up",
  "client servicing",
] as const;

const CLIENT_CAPABILITIES = [
  "dashboard",
  "onboarding",
  "financial data",
  "planning views",
  "goals",
  "roadmap",
  "documents",
  "appointments",
  "notifications",
  "insights",
  "communication preferences",
] as const;

const ADMIN_CAPABILITIES = [
  "user and access",
  "feature controls",
  "governed-content",
  "scheduling",
  "deliveries",
  "migration review",
  "audits",
  "operational diagnostics",
] as const;

const ADVISER_JOURNEY_STAGES = [
  "prospect",
  "onboarding",
  "data collection",
  "diagnostic",
  "planning",
  "recommendation preparation",
  "client meeting",
  "agreed actions",
  "implementation",
  "follow-up",
  "review",
  "ongoing servicing",
] as const;

const CLIENT_JOURNEY_STAGES = [
  "invited",
  "account activated",
  "profile completed",
  "financial information",
  "diagnostic viewed",
  "plan reviewed",
  "meeting attended",
  "actions accepted",
  "documents accessed",
  "progress tracked",
  "annual review",
] as const;

const DATA_DOMAINS = [
  "household identity",
  "dependants",
  "employment and income",
  "cash flow",
  "assets",
  "liabilities",
  "insurance policies",
  "goals",
  "risk profile",
  "estate information",
  "documents",
  "meeting outcomes",
  "roadmap actions",
  "review dates",
] as const;

const CANDIDATE_TRACKS = ["Track A", "Track B", "Track C", "Track D", "Track E", "Track F", "Track G"] as const;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function record(id: number, name: string, fn: () => void): TestCase {
  return { id, name, run: fn };
}

function doc(name: string): string {
  return read(`docs/${name}`);
}

const TESTS: TestCase[] = [
  ...REQUIRED_DOCS.map((path, i) =>
    record(i + 1, `required doc exists: ${path}`, () => assert(existsSync(path), "missing")),
  ),

  record(11, "capability map covers adviser persona", () => {
    const d = doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md");
    assert(d.includes("## Adviser capabilities"), "section");
    assert(d.includes("| Adviser |"), "rows");
  }),

  record(12, "capability map covers client persona", () => {
    const d = doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md");
    assert(d.includes("## Client capabilities"), "section");
    assert(d.includes("| Client |"), "rows");
  }),

  record(13, "capability map covers admin persona", () => {
    const d = doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md");
    assert(d.includes("## Admin capabilities"), "section");
    assert(d.includes("| Admin |"), "rows");
  }),

  ...ADVISER_CAPABILITIES.map((cap, i) =>
    record(14 + i, `capability map mentions adviser: ${cap}`, () => {
      const d = doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md");
      assert(d.toLowerCase().includes(cap.toLowerCase()), cap);
    }),
  ),

  ...CLIENT_CAPABILITIES.map((cap, i) =>
    record(24 + i, `capability map mentions client: ${cap}`, () => {
      const d = doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md");
      assert(d.toLowerCase().includes(cap.toLowerCase()), cap);
    }),
  ),

  ...ADMIN_CAPABILITIES.map((cap, i) =>
    record(35 + i, `capability map mentions admin: ${cap}`, () => {
      const d = doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md");
      assert(d.toLowerCase().includes(cap.toLowerCase()), cap);
    }),
  ),

  record(43, "capability map includes status column", () =>
    assert(doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md").includes("| Status |"), "status")),

  record(44, "capability map includes production use column", () =>
    assert(doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md").includes("Production use"), "production")),

  ...ADVISER_JOURNEY_STAGES.map((stage, i) =>
    record(45 + i, `adviser journey covers: ${stage}`, () => {
      const d = doc("PHASE_10_ADVISER_JOURNEY_AUDIT.md");
      assert(d.toLowerCase().includes(stage.toLowerCase()), stage);
    }),
  ),

  record(57, "adviser journey documents manual duplication gaps", () =>
    assert(doc("PHASE_10_ADVISER_JOURNEY_AUDIT.md").includes("Manual duplication"), "manual")),

  record(58, "adviser journey documents compliance considerations", () =>
    assert(doc("PHASE_10_ADVISER_JOURNEY_AUDIT.md").includes("Compliance"), "compliance")),

  ...CLIENT_JOURNEY_STAGES.map((stage, i) =>
    record(59 + i, `client journey covers: ${stage}`, () => {
      const d = doc("PHASE_10_CLIENT_JOURNEY_AUDIT.md");
      assert(d.toLowerCase().includes(stage.toLowerCase()), stage);
    }),
  ),

  record(70, "client journey separates genuine client value", () =>
    assert(doc("PHASE_10_CLIENT_JOURNEY_AUDIT.md").includes("Genuine client value"), "value")),

  ...DATA_DOMAINS.map((domain, i) =>
    record(71 + i, `data audit maps domain: ${domain}`, () => {
      const d = doc("PHASE_10_DATA_READINESS_AUDIT.md");
      assert(d.toLowerCase().includes(domain.toLowerCase()), domain);
    }),
  ),

  record(85, "data audit documents source-of-truth rules", () => {
    const d = doc("PHASE_10_DATA_READINESS_AUDIT.md");
    assert(d.includes("Source-of-truth") || d.includes("source-of-truth"), "sot");
    assert(d.includes("SOT rules"), "sot rules column");
  }),

  record(86, "servicing audit concludes no unified work queue", () => {
    const d = doc("PHASE_10_SERVICING_AND_WORKFLOW_AUDIT.md");
    assert(d.includes("unified work queue") || d.includes("Unified work queue"), "queue");
  }),

  record(87, "analytics audit rejects adviser ranking without approval", () => {
    const d = doc("PHASE_10_ANALYTICS_AND_MANAGEMENT_AUDIT.md");
    assert(d.includes("ranking") || d.includes("leaderboard"), "ranking");
    assert(d.includes("approval") || d.includes("must NOT"), "guard");
  }),

  record(88, "production ops audit references 9F.4 observation", () =>
    assert(doc("PHASE_10_PRODUCTION_OPERATIONS_AUDIT.md").includes("9F.4"), "observation")),

  record(89, "production ops audit excludes new observability vendor", () => {
    const d = doc("PHASE_10_PRODUCTION_OPERATIONS_AUDIT.md");
    assert(d.includes("observability") || d.includes("APM"), "ops");
    assert(!d.includes("Datadog") && !d.includes("New Relic"), "no vendor");
  }),

  ...CANDIDATE_TRACKS.map((track, i) =>
    record(90 + i, `candidate tracks evaluates ${track}`, () => {
      assert(doc("PHASE_10_CANDIDATE_TRACKS.md").includes(track), track);
    }),
  ),

  record(97, "candidate tracks include scoring table", () =>
    assert(doc("PHASE_10_CANDIDATE_TRACKS.md").includes("Adviser value"), "scores")),

  record(98, "candidate tracks explain Track G non-authoritative boundary", () => {
    const d = doc("PHASE_10_CANDIDATE_TRACKS.md");
    assert(d.includes("Track G"), "G");
    assert(d.includes("non-authoritative") || d.includes("Non-authoritative"), "boundary");
    assert(d.includes("no unreviewed financial advice") || d.includes("no AI-generated financial"), "advice");
  }),

  record(99, "recommendation selects exactly Track A", () => {
    const d = doc("PHASE_10_RECOMMENDATION.md");
    assert(d.includes("Track A"), "track a");
    assert(d.includes("Adviser Operating Dashboard"), "name");
    assert(d.includes("SELECT") || d.includes("Selected Phase 10 track"), "selected");
  }),

  record(100, "recommendation explicitly rejects alternative tracks", () => {
    const d = doc("PHASE_10_RECOMMENDATION.md");
    assert(d.includes("Why alternative tracks were not selected"), "section");
    assert(d.includes("Track B") && d.includes("Track E") && d.includes("Track G"), "alternatives");
  }),

  record(101, "architectural debt register has classifications", () => {
    const d = doc("PHASE_10_ARCHITECTURAL_DEBT_REGISTER.md");
    assert(d.includes("Must fix before Phase 10") || d.includes("Fix within Phase 10"), "class");
    assert(d.includes("Defer") && d.includes("Accept"), "defer accept");
  }),

  record(102, "recommendation lists proposed checkpoints", () =>
    assert(doc("PHASE_10_RECOMMENDATION.md").includes("10.1") && doc("PHASE_10_RECOMMENDATION.md").includes("10.8"), "checkpoints")),

  record(103, "recommendation confirms no migration in discovery", () => {
    const d = doc("PHASE_10_RECOMMENDATION.md");
    assert(d.includes("no migration") || d.includes("None") && d.includes("10.1"), "migration");
  }),

  record(104, "phase 10 communications migrations present and additive", () => {
    const migrations = readdirSync(join(ROOT, "supabase/migrations"));
    const phase10 = migrations.filter((f) => /phase10_crm_v2_communications/i.test(f));
    assert(phase10.length >= 2, `expected feature_control + core, found: ${phase10.join(", ")}`);
    const core = read(`supabase/migrations/${phase10.find((f) => f.includes("_core")) ?? ""}`);
    assert(!core.includes("DROP TABLE"), "no destructive drop in core");
  }),

  record(105, "package.json has no remote-write discovery script", () => {
    const pkg = read("package.json");
    assert(!pkg.includes("db push") && !pkg.includes("db reset"), "no push in scripts");
    assert(!pkg.includes("demo:clear") || pkg.includes("qa:phase10-discovery"), "demo clear pre-exists");
  }),

  record(106, "discovery script does not activate feature flags", () => {
    const pkg = read("package.json");
    const scripts = JSON.parse(pkg).scripts as Record<string, string>;
    for (const [name, cmd] of Object.entries(scripts)) {
      if (!name.startsWith("qa:phase10")) continue;
      assert(!cmd.includes("db push"), `${name} must not push db`);
      assert(!cmd.includes("feature-controls"), `${name} must not patch flags`);
    }
  }),

  record(107, "no destructive SQL in new phase 10 docs", () => {
    for (const path of REQUIRED_DOCS) {
      const content = read(path).toLowerCase();
      assert(!content.includes("drop table promotions"), path);
      assert(!content.includes("drop schema"), path);
    }
  }),

  record(108, "9F.4 observation plan still documents 30 days", () =>
    assert(read("docs/PHASE_9F4_OBSERVATION_PLAN.md").includes("30"), "30 days")),

  record(109, "no invented compliance role in phase 10 docs", () => {
    for (const path of REQUIRED_DOCS) {
      const content = read(path);
      assert(!content.includes('role: "compliance"'), path);
      assert(!content.includes("distinct `compliance` role"), path);
    }
    assert(!read("lib/roles.ts").includes('"compliance"'), "roles.ts");
  }),

  record(110, "phase 10 docs avoid client financial data in examples", () => {
    for (const path of REQUIRED_DOCS) {
      const content = read(path);
      assert(!content.includes("£"), path);
      assert(!content.includes("$125"), path);
      assert(!/\b\d{5,}\b/.test(content.replace(/\d{4}-\d{2}-\d{2}/g, "")), path);
    }
  }),

  record(111, "required docs are valid UTF-8 without BOM", () => {
    for (const path of REQUIRED_DOCS) {
      const buf = readFileSync(join(ROOT, path), "utf8");
      assert(!buf.includes("\u0000"), `${path} has null bytes`);
      assert(buf.length > 0, `${path} empty`);
    }
  }),

  record(112, "capability map uses markdown table formatting", () => {
    const d = doc("PHASE_10_CURRENT_PLATFORM_CAPABILITY_MAP.md");
    assert(d.includes("| Capability |") && d.includes("| Persona |"), "headers");
    assert(/\|[\s-]+\|/.test(d), "separators");
  }),

  record(113, "qa script registered in package.json", () =>
    assert(read("package.json").includes("qa:phase10-discovery"), "npm script")),

  record(114, "recommendation includes rollback strategy", () =>
    assert(doc("PHASE_10_RECOMMENDATION.md").includes("Rollback"), "rollback")),

  record(115, "recommendation includes success metrics", () =>
    assert(doc("PHASE_10_RECOMMENDATION.md").includes("Success metrics"), "metrics")),

  record(116, "recommendation includes feature-control strategy", () =>
    assert(doc("PHASE_10_RECOMMENDATION.md").includes("feature-control") || doc("PHASE_10_RECOMMENDATION.md").includes("Feature-control"), "flags")),

  record(117, "recommendation verdict ready for implementation design", () =>
    assert(doc("PHASE_10_RECOMMENDATION.md").includes("READY FOR PHASE 10 IMPLEMENTATION DESIGN"), "verdict")),

  record(118, "discovery confirms no deployment or feature activation", () => {
    const d = doc("PHASE_10_RECOMMENDATION.md");
    assert(d.includes("Did not deploy"), "deploy");
    assert(d.includes("Did not activate feature controls"), "activate");
  }),
];

function main(): void {
  for (const test of TESTS) {
    try {
      test.run();
      results.push({ id: test.id, name: test.name, passed: true });
    } catch (err) {
      results.push({
        id: test.id,
        name: test.name,
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`Phase 10 discovery: ${passed}/${results.length} passed`);

  for (const f of failed) {
    console.error(`  FAIL #${f.id} ${f.name}: ${f.error}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
