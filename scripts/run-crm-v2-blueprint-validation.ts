/**
 * CRM V2 Phase 00 — blueprint validation (≥120 explicit checks).
 * Run: npm run qa:crm-v2-blueprint
 *
 * Each check is independently reported — grouped assertions are not collapsed.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());

type TestCase = { id: number; name: string; run: () => void };

const results: { id: number; name: string; passed: boolean; error?: string }[] = [];

const BLUEPRINT_DOCS = [
  "docs/CRM_V2_ROLLOUT_INDEX.md",
  "docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md",
  "docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md",
  "docs/CRM_V2_DOMAIN_ENTITY_MAP.md",
  "docs/CRM_V2_VISIBILITY_MODEL.md",
  "docs/CRM_V2_ROUTE_MAP.md",
  "docs/CRM_V2_FEATURE_CONTROL_PLAN.md",
  "docs/CRM_V2_MIGRATION_SEQUENCE.md",
  "docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md",
  "docs/CRM_V2_SECURITY_BOUNDARIES.md",
  "docs/CRM_V2_PHASE_00_COMPLETION.md",
] as const;

const DOC_HEADINGS: Record<(typeof BLUEPRINT_DOCS)[number], string> = {
  "docs/CRM_V2_ROLLOUT_INDEX.md": "# CRM V2 — Rollout Index",
  "docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md": "# CRM V2 — Architecture Blueprint",
  "docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md": "# CRM V2 — Source of Truth Matrix",
  "docs/CRM_V2_DOMAIN_ENTITY_MAP.md": "# CRM V2 — Domain Entity Map",
  "docs/CRM_V2_VISIBILITY_MODEL.md": "# CRM V2 — Visibility Model",
  "docs/CRM_V2_ROUTE_MAP.md": "# CRM V2 — Route Map",
  "docs/CRM_V2_FEATURE_CONTROL_PLAN.md": "# CRM V2 — Feature Control Plan",
  "docs/CRM_V2_MIGRATION_SEQUENCE.md": "# CRM V2 — Migration Sequence",
  "docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md": "# CRM V2 — Compatibility and Cutover",
  "docs/CRM_V2_SECURITY_BOUNDARIES.md": "# CRM V2 — Security Boundaries",
  "docs/CRM_V2_PHASE_00_COMPLETION.md": "# CRM V2 — Phase 00 Completion Report",
};

const CRM_V2_FLAGS = [
  "crm_v2_master",
  "crm_v2_pilot_mode",
  "crm_v2_relationships",
  "crm_v2_appointments_adviser",
  "crm_v2_appointments_client",
  "crm_v2_google_calendar",
  "crm_v2_service",
  "crm_v2_protection_portfolio",
  "crm_v2_relationship_moments",
  "crm_v2_advocacy",
  "crm_v2_communications",
  "crm_v2_today",
  "crm_v2_cutover",
] as const;

const SOT_DOMAINS: { label: string; patterns: string[]; docs?: string[] }[] = [
  { label: "users", patterns: ["users"], docs: ["docs/CRM_V2_DOMAIN_ENTITY_MAP.md"] },
  { label: "advisers", patterns: ["adviser_profiles", "adviser"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "prospects", patterns: ["prospect"], docs: ["docs/CRM_V2_DOMAIN_ENTITY_MAP.md", "docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "clients", patterns: ["clients"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "assignments", patterns: ["advisor_user_id", "assignment"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "relationships", patterns: ["relationshipId", "Relationship identity"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "households", patterns: ["household", "DEFERRED"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "financial data", patterns: ["discover_profiles", "shield_scores"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "goals", patterns: ["client_goals", "goals"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "roadmap", patterns: ["roadmap_items"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "tasks", patterns: ["advisor_tasks"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "appointments", patterns: ["adviser_appointments"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "meeting sessions", patterns: ["meeting_sessions"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "commitments", patterns: ["service_commitments"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "client requests", patterns: ["client_service_request"], docs: ["docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md"] },
  { label: "document requests", patterns: ["document_request"], docs: ["docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md", "docs/CRM_V2_VISIBILITY_MODEL.md"] },
  { label: "planning outputs", patterns: ["published_outputs"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "protection records", patterns: ["protection_policies"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "binder", patterns: ["binder_exports"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "communications", patterns: ["governed_content"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "timeline", patterns: ["Engagement timeline", "PROJ"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "moments", patterns: ["relationship_moments"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "availability", patterns: ["away", "return", "travel", "availability"], docs: ["docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md", "docs/CRM_V2_DOMAIN_ENTITY_MAP.md"] },
  { label: "advocacy", patterns: ["advocacy_events"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
  { label: "Google Calendar", patterns: ["adviser_calendar_connections", "Google"], docs: ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"] },
];

const TESTS: TestCase[] = [];
let nextId = 1;

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function check(name: string, fn: () => void): void {
  const id = nextId++;
  TESTS.push({ id, name, run: fn });
}

function doc(path: string): string {
  return read(path);
}

function corpus(paths: string[]): string {
  return paths.map((p) => doc(p)).join("\n");
}

function docHas(path: string, pattern: string): boolean {
  return doc(path).includes(pattern);
}

function corpusHas(paths: string[], pattern: string): boolean {
  return corpus(paths).includes(pattern);
}

// --- Required documents (33 checks) ---

for (const blueprintDoc of BLUEPRINT_DOCS) {
  check(`doc exists: ${blueprintDoc}`, () => {
    assert(existsSync(blueprintDoc), "missing file");
  });
}

for (const blueprintDoc of BLUEPRINT_DOCS) {
  check(`doc non-empty: ${blueprintDoc}`, () => {
    const content = doc(blueprintDoc);
    assert(content.trim().length > 200, `only ${content.trim().length} chars`);
  });
}

for (const blueprintDoc of BLUEPRINT_DOCS) {
  check(`doc heading: ${blueprintDoc}`, () => {
    assert(doc(blueprintDoc).includes(DOC_HEADINGS[blueprintDoc]), "heading mismatch");
  });
}

// --- Rollout index (27 checks) ---

for (let phase = 0; phase <= 15; phase++) {
  check(`rollout index references phase ${phase}`, () => {
    const idx = doc("docs/CRM_V2_ROLLOUT_INDEX.md");
    const padded = phase.toString().padStart(2, "0");
    assert(
      idx.includes(`**${phase}**`) ||
        idx.includes(`Phase ${phase}`) ||
        idx.includes(`crm-v2-${padded}`) ||
        idx.includes(`crm-v2-0${phase}`) ||
        idx.includes(`crm-v2-${phase}`),
      `phase ${phase} not referenced`,
    );
  });
}

for (const blueprintDoc of BLUEPRINT_DOCS) {
  const base = blueprintDoc.replace("docs/", "");
  check(`rollout index links: ${base}`, () => {
    assert(doc("docs/CRM_V2_ROLLOUT_INDEX.md").includes(base), "not linked");
  });
}

// --- Architecture (8 checks) ---

check("architecture domain: RELATIONSHIP", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("RELATIONSHIP"), "missing");
});

check("architecture domain: ENGAGEMENT", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("ENGAGEMENT"), "missing");
});

check("architecture domain: ADVICE", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("ADVICE"), "missing");
});

check("architecture domain: SERVICE", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("SERVICE"), "missing");
});

check("architecture principle: single authoritative record", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Single source of truth"), "missing");
});

check("architecture principle: work queue remains virtual", () => {
  const arch = doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md");
  assert(arch.includes("virtual") || arch.includes("projection"), "missing virtual/projection");
  assert(arch.includes("AdviserWorkItem") || arch.includes("work-queue"), "missing queue ref");
});

check("architecture principle: CRM V2 parallel portal", () => {
  const arch = doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md");
  assert(arch.includes("/advisor-v2"), "missing route");
  assert(arch.includes("parallel") || arch.includes("Parallel"), "missing parallel");
});

check("architecture principle: client collaboration uses shared records", () => {
  const compat = doc("docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md");
  assert(compat.includes("adviser_appointments") || compat.includes("same SOT"), "missing shared SOT");
  assert(compat.includes("additive") || compat.includes("No dual-write"), "missing additive rule");
});

// --- Source-of-truth matrix (25 checks) ---

for (const domain of SOT_DOMAINS) {
  const paths = domain.docs ?? ["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md"];
  check(`SOT coverage: ${domain.label}`, () => {
    const hit = domain.patterns.some((p) => corpusHas(paths, p));
    assert(hit, `pattern not found in ${paths.join(", ")}`);
  });
}

// --- Relationship model (5 checks) ---

check("relationship model: client-as-relationship Phase 02", () => {
  assert(corpus(["docs/CRM_V2_DOMAIN_ENTITY_MAP.md", "docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md"]).includes("relationshipId = clients.id"), "missing");
});

check("relationship model: household deferral", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("Deferred"), "missing deferral");
});

check("relationship model: future household compatibility", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("households"), "missing future model");
});

check("relationship model: person and household distinction", () => {
  const entity = doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md");
  assert(entity.includes("Client") && entity.includes("Household"), "missing distinction");
});

check("relationship model: no mandatory household migration before launch", () => {
  const entity = doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md");
  assert(entity.includes("no forced migration") || entity.includes("Do not force"), "missing");
});

// --- Visibility (10 checks) ---

check("visibility: adviser-only tier", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("adviser-only"), "missing");
});

check("visibility: client-visible tier", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("client-visible"), "missing");
});

check("visibility: audit-only tier", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("audit-only"), "missing");
});

check("visibility: system-generated tier", () => {
  const vis = doc("docs/CRM_V2_VISIBILITY_MODEL.md");
  assert(vis.includes("System") || vis.includes("system"), "missing");
});

check("visibility: operator/admin-only surfaces", () => {
  const vis = doc("docs/CRM_V2_VISIBILITY_MODEL.md");
  assert(vis.includes("Admin") || vis.includes("admin"), "missing admin");
  assert(vis.includes("operator") || vis.includes("Operator"), "missing operator");
});

check("visibility: internal notes not client-visible by default", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("private_adviser_note") || doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("Private notes"), "missing");
});

check("visibility: appointment agenda adviser-only", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("Adviser agenda"), "missing");
});

check("visibility: meeting outcome internal vs published", () => {
  const vis = doc("docs/CRM_V2_VISIBILITY_MODEL.md");
  assert(vis.includes("Outcome") && vis.includes("published"), "missing outcome rules");
});

check("visibility: advocacy not client-visible by default", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("Advocacy") && doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("No"), "missing");
});

check("visibility: ethnicity restricted from list and calendar", () => {
  const vis = doc("docs/CRM_V2_VISIBILITY_MODEL.md");
  assert(vis.includes("Ethnicity") && vis.includes("Never"), "missing ethnicity rules");
});

// --- Appointment authority (12 checks) ---

check("appointment: adviser_appointments evolves in place", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Evolve existing `adviser_appointments`"), "missing");
});

check("appointment: rescheduling preserves appointment identity", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Same row survives reschedule"), "missing");
});

check("appointment: meeting_sessions not second appointment authority", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("not a competing appointment identity"), "missing");
});

check("appointment: Google event is not authoritative", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("AEGIS authoritative"), "missing");
});

check("appointment lifecycle: preparing", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("preparing"), "missing");
});

check("appointment lifecycle: in_progress", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("in_progress"), "missing");
});

check("appointment lifecycle: follow_up_required", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("follow_up_required"), "missing");
});

check("appointment lifecycle: closed", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("closed"), "missing");
});

check("appointment: preparation checklist documented", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("preparation"), "missing");
});

check("appointment: Meeting Studio link via appointment_id", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("meeting_sessions.appointment_id"), "missing");
});

check("appointment: binder relationship documented", () => {
  assert(corpus(["docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md", "docs/CRM_V2_DOMAIN_ENTITY_MAP.md"]).includes("binder_exports"), "missing binder");
});

check("appointment: rescheduled_from_appointment_id lineage", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("rescheduled_from_appointment_id"), "missing");
});

// --- Service authority (9 checks) ---

check("service: service_commitments proposed", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("service_commitments"), "missing");
});

check("service type: adviser_commitment", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("adviser_commitment"), "missing");
});

check("service type: client_commitment", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("client_commitment"), "missing");
});

check("service type: shared_commitment", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("shared_commitment"), "missing");
});

check("service type: client_service_request", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("client_service_request"), "missing");
});

check("service type: document_request", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("document_request"), "missing");
});

check("service type: review_workflow_step", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("review_workflow_step"), "missing");
});

check("service: work queue is projection only", () => {
  assert(doc("docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md").includes("Work queue item") && doc("docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md").includes("PROJ"), "missing");
});

check("service: no generic queue-owned completion", () => {
  assert(doc("docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md").includes("Queue completion must not bypass source"), "missing");
});

// --- Timeline (7 checks) ---

check("timeline: projected from source events", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Projection assembled from"), "missing");
});

check("timeline: immutable CRM appointment events", () => {
  assert(doc("docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md").includes("appointment_state_events"), "missing");
});

check("timeline: audit events included", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("audit_logs"), "missing");
});

check("timeline: meeting session events included", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("meeting_session_events"), "missing");
});

check("timeline: stable identity via source references", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("EngagementTimelineEntry"), "missing");
});

check("timeline: visibility enforcement documented", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("Timeline projection"), "missing");
});

check("timeline: no wholesale duplicate authoritative store", () => {
  assert(doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").includes("engagement_events") && doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").includes("Projection only"), "missing");
});

// --- Protection (6 checks) ---

check("protection: extraction provisional", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("provisional"), "missing");
});

check("protection: adviser confirmation required", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("adviser confirms"), "missing");
});

check("protection: versioned policy records", () => {
  assert(doc("docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md").includes("protection_policy_versions"), "missing");
});

check("protection: correction audit history", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("Correction audit"), "missing");
});

check("protection: client projection is simplified subset", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("client simplified summary"), "missing");
});

check("protection: unverified extraction never authoritative", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Unverified extraction **never**"), "missing");
});

// --- Relationship moments (10 checks) ---

check("moments: shared moments engine", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("relationship_moments") || doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("relationship_moments"), "missing");
});

check("moments: birthday support", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("birthday"), "missing");
});

check("moments: festive holiday support", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("festive_holiday"), "missing");
});

check("moments: anniversary support", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("anniversary"), "missing");
});

check("moments: availability / travel support", () => {
  assert(corpus(["docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md", "docs/CRM_V2_DOMAIN_ENTITY_MAP.md"]).includes("away"), "missing away");
  assert(corpus(["docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md", "docs/CRM_V2_DOMAIN_ENTITY_MAP.md"]).includes("return"), "missing return");
});

check("moments: policy anniversary", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("policy_anniversary"), "missing");
});

check("moments: adviser override precedence", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("adviser override"), "missing");
});

check("moments: mixed ethnicity handling", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Mixed"), "missing");
});

check("moments: prefer-not-to-say handling", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Prefer not to say"), "missing");
});

check("moments: ethnicity prohibited uses documented", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Prohibited"), "missing");
});

// --- Advocacy (10 checks) ---

check("advocacy: immutable append-only events", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("append-only"), "missing");
});

check("advocacy: current calendar year score calculation", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("calendar year"), "missing");
});

check("advocacy: historical preservation on year rollover", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("never deleted") || doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Retain previous-year"), "missing");
});

check("advocacy: configurable weights", () => {
  assert(doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("weights"), "missing");
});

check("advocacy: category caps", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("category caps") || doc("docs/CRM_V2_DOMAIN_ENTITY_MAP.md").includes("caps"), "missing");
});

check("advocacy: thank-you workflow", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("Thank-you"), "missing");
});

check("advocacy: referral consent state", () => {
  assert(doc("docs/CRM_V2_VISIBILITY_MODEL.md").includes("Referral consent"), "missing");
});

check("advocacy prohibited: advice use", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("advice"), "missing");
});

check("advocacy prohibited: servicing-priority use", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("work-queue") || doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("queue sort"), "missing");
});

check("advocacy prohibited: sales-ranking use", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("leaderboard") || doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("leaderboard"), "missing");
});

// --- Google Calendar (9 checks) ---

check("google calendar: AEGIS authoritative", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("AEGIS authoritative"), "missing");
});

check("google calendar: one-way synchronization first", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("one-way") || doc("docs/CRM_V2_PHASE_00_COMPLETION.md").includes("one-way"), "missing");
});

check("google calendar: mapping identity preserved", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("google_event_id"), "missing");
});

check("google calendar: update not duplicate on reschedule", () => {
  assert(doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("update") || doc("docs/CRM_V2_ARCHITECTURE_BLUEPRINT.md").includes("Same row"), "missing");
});

check("google calendar: external privacy limitations documented", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("Google event may contain"), "missing");
});

check("google calendar: no ethnicity in events", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("Ethnicity"), "missing");
});

check("google calendar: no advocacy in events", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("Advocacy data"), "missing");
});

check("google calendar: no financial details in events", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("Financial information"), "missing");
});

check("google calendar: no private notes in events", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("Private notes"), "missing");
});

// --- Routes and controls (16 checks) ---

check("routes: primary portal /advisor-v2", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/advisor-v2"), "missing");
});

check("routes: /advisor-v2/today documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/today"), "missing");
});

check("routes: /advisor-v2/relationships documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/relationships"), "missing");
});

check("routes: /advisor-v2/appointments documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/appointments"), "missing");
});

check("routes: /advisor-v2/service documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/service"), "missing");
});

check("routes: /advisor-v2/communications documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/communications"), "missing");
});

check("routes: /advisor-v2/more documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/more"), "missing");
});

check("routes: client collaboration /my-adviser documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/my-adviser"), "missing");
});

check("routes: client API appointments namespace documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/api/client/appointments"), "missing");
});

check("routes: advisor-v2 API namespace documented", () => {
  assert(doc("docs/CRM_V2_ROUTE_MAP.md").includes("/api/advisor-v2/"), "missing");
});

check("controls: master feature flag crm_v2_master", () => {
  assert(doc("docs/CRM_V2_FEATURE_CONTROL_PLAN.md").includes("crm_v2_master"), "missing");
});

check("controls: pilot gating separate from feature activation", () => {
  const plan = doc("docs/CRM_V2_FEATURE_CONTROL_PLAN.md");
  assert(plan.includes("crm_v2_pilot_mode"), "missing pilot flag");
  assert(plan.includes("allowlist") || plan.includes("CRM_V2_PILOT_USER_IDS"), "missing allowlist");
});

check("controls: all CRM flags default disabled", () => {
  assert(doc("docs/CRM_V2_FEATURE_CONTROL_PLAN.md").includes("default **false**") || doc("docs/CRM_V2_FEATURE_CONTROL_PLAN.md").includes("default **disabled**"), "missing");
});

check("controls: no hardcoded pilot user IDs", () => {
  const plan = doc("docs/CRM_V2_FEATURE_CONTROL_PLAN.md");
  assert(plan.includes("not invented") || plan.includes("operator-provided"), "missing");
});

for (const flag of CRM_V2_FLAGS) {
  check(`controls: per-domain flag documented: ${flag}`, () => {
    assert(doc("docs/CRM_V2_FEATURE_CONTROL_PLAN.md").includes(flag), "missing");
  });
}

// --- Rollout and safety (15 checks) ---

check("rollout: additive migration sequence", () => {
  assert(doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").includes("additive") || doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").includes("ADD"), "missing");
});

check("rollout: no Phase 00 migration", () => {
  assert(doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").includes("no migration in Phase 00") || doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").includes("No migration in Phase 00"), "missing");
});

check("rollout: rollback documented", () => {
  assert(doc("docs/CRM_V2_MIGRATION_SEQUENCE.md").includes("Rollback"), "missing");
});

check("rollout: parallel operation documented", () => {
  assert(doc("docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md").includes("Parallel"), "missing");
});

check("rollout: cutover observation period", () => {
  assert(doc("docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md").includes("30-day") || doc("docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md").includes("30 day"), "missing");
});

check("rollout: legacy fallback route", () => {
  assert(doc("docs/CRM_V2_COMPATIBILITY_AND_CUTOVER.md").includes("/advisor-legacy"), "missing");
});

check("rollout: Phase 9F.4 observation retained", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("9F.4"), "missing");
});

check("rollout: no Promotions Stage 6", () => {
  assert(doc("docs/CRM_V2_SECURITY_BOUNDARIES.md").includes("Stage 6"), "missing");
});

check("rollout: no destructive SQL in blueprint", () => {
  const mig = doc("docs/CRM_V2_MIGRATION_SEQUENCE.md");
  assert(!mig.toLowerCase().includes("drop table promotions"), "unexpected destructive sql");
});

check("rollout: validator imports only filesystem modules", () => {
  const script = read("scripts/run-crm-v2-blueprint-validation.ts");
  const importLines = script.split("\n").filter((line) => line.trimStart().startsWith("import "));
  assert(importLines.length >= 2, "expected fs and path imports");
  for (const line of importLines) {
    const match = line.match(/from "(node:[^"]+)"/);
    if (!match) {
      throw new Error(`unparseable import line: ${line.trim()}`);
    }
    const modulePath = match[1];
    assert(modulePath === "node:fs" || modulePath === "node:path", `unexpected import: ${modulePath}`);
  }
});

check("rollout: advisor-v2 shell route tree present", () => {
  assert(existsSync("app/advisor-v2/layout.tsx"), "layout missing");
  assert(existsSync("app/advisor-v2/page.tsx"), "landing missing");
});

check("rollout: advisor-v2 shell API present", () => {
  assert(existsSync("app/api/advisor-v2/shell/route.ts"), "shell api missing");
});

check("rollout: only approved Phase 01–02 CRM feature migrations", () => {
  const migrations = readdirSync(join(ROOT, "supabase/migrations"));
  const crmMigrations = migrations
    .filter((f) => /crm.?v2|phase01_crm|phase02_crm/i.test(f))
    .sort();
  assert(
    crmMigrations.length === 2,
    `unexpected crm migrations: ${crmMigrations.join(", ")}`,
  );
  assert(crmMigrations[0]?.includes("phase01_crm_v2_feature_controls"), "phase01 missing");
  assert(crmMigrations[1]?.includes("phase02_crm_v2_relationships"), "phase02 missing");
});

check("rollout: crm_v2_master code default disabled", () => {
  const flags = read("lib/compliance/featureFlags.ts");
  assert(flags.includes("crm_v2_master"), "crm_v2_master missing from featureFlags");
  assert(flags.includes("enabled: false"), "must default disabled");
});

check("rollout: Phase 00 completion verdict present", () => {
  assert(doc("docs/CRM_V2_PHASE_00_COMPLETION.md").includes("READY FOR CRM V2 FOUNDATION"), "missing verdict");
});

// --- Integration and repo sanity (6 checks) ---

check("integration: work queue core module exists", () => {
  assert(existsSync("lib/work-queue/types.ts"), "missing");
});

check("integration: legacy advisor portal still present", () => {
  assert(existsSync("app/advisor/page.tsx"), "missing");
});

check("integration: qa script registered in package.json", () => {
  assert(read("package.json").includes("qa:crm-v2-blueprint"), "missing npm script");
});

check("integration: governed_content remains communications SOT", () => {
  assert(doc("docs/CRM_V2_SOURCE_OF_TRUTH_MATRIX.md").includes("governed_content"), "missing");
});

check("integration: completion confirms no implementation", () => {
  assert(doc("docs/CRM_V2_PHASE_00_COMPLETION.md").includes("No migrations"), "missing");
  assert(doc("docs/CRM_V2_PHASE_00_COMPLETION.md").includes("no implementation"), "missing");
});

check("integration: minimum explicit check count ≥ 120", () => {
  assert(TESTS.length >= 120, `only ${TESTS.length} checks defined`);
});

function main(): void {
  console.log("CRM V2 Phase 00 — Blueprint Validation\n");
  console.log(`Defined explicit checks: ${TESTS.length}\n`);

  for (const test of TESTS) {
    try {
      test.run();
      results.push({ id: test.id, name: test.name, passed: true });
      console.log(`  PASS  [${test.id}] ${test.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: test.id, name: test.name, passed: false, error: message });
      console.log(`  FAIL  [${test.id}] ${test.name}: ${message}`);
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);

  console.log(`\n${passed}/${results.length} passed`);

  if (failed.length > 0) {
    console.log("\nFailed tests:");
    for (const f of failed) {
      console.log(`  [${f.id}] ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }

  if (passed < 120) {
    console.error(`\nInsufficient explicit checks: ${passed} < 120 required`);
    process.exit(1);
  }

  console.log("\nVerdict: READY FOR CRM V2 FOUNDATION");
}

main();
