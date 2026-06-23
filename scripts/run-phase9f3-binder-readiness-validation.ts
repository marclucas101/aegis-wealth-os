/**
 * Phase 9F.3 binder readiness validation — section policy and catalog checks.
 * Run: npx tsx scripts/run-phase9f3-binder-readiness-validation.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { classifyClientPublicationAvailability } from "../lib/binder/binderPublicationAvailability";
import { parseBinderReadinessQuery } from "../lib/binder/binderReadinessRoute";
import {
  assertReadinessResponseSafe,
  buildBinderSectionReadiness,
  canGenerateWithSelectedSections,
} from "../lib/binder/binderContentPreparation";
import {
  evaluateBinderGenerationEligibility,
} from "../lib/binder/binderGenerationEligibility";
import { defaultSectionsForPurpose } from "../lib/binder/binderPackPurpose";
import {
  assertSectionsResolvableForGeneration,
  BINDER_DEFAULT_GENERATION_SECTIONS,
  BINDER_MANDATORY_SECTIONS,
  BINDER_PLANNING_SECTIONS,
  BINDER_SOURCE_UNAVAILABLE_CODE,
  meetsMinimumGenerationContract,
  reasonCodeToAdviserPrerequisite,
} from "../lib/binder/binderSectionPolicy";
import { assessSectionAvailability, type BinderSectionContext } from "../lib/binder/binderSectionCatalog";
import {
  buildGenerationSectionList,
  normalizeBinderSectionIds,
} from "../lib/binder/binderSectionRegistry";
import type { PublishedOutputRow } from "../lib/supabase/compliancePublication";
import type { AppClientRow } from "../lib/supabase/userProfile";

const ROOT = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(ROOT, path), "utf8");
}

function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  }
}

function mockClient(overrides: Partial<AppClientRow> = {}): AppClientRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    advisor_user_id: "33333333-3333-4333-8333-333333333333",
    display_name: "Test Client",
    relationship_stage: "active_client",
    next_review_due: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as AppClientRow;
}

function mockPublication(overrides: Partial<PublishedOutputRow>): PublishedOutputRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    client_id: "11111111-1111-4111-8111-111111111111",
    output_type: "roadmap_summary",
    publication_status: "published",
    output_audience: "client_published",
    published_at: "2026-06-01T00:00:00.000Z",
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    withdrawn_at: null,
    superseded_at: null,
    expires_at: null,
    source_input_version: "v1",
    algorithm_version: "v1",
    payload: { summary: "Planning summary" },
    ...overrides,
  } as PublishedOutputRow;
}

function baseContext(overrides: Partial<BinderSectionContext> = {}): BinderSectionContext {
  return {
    client: mockClient(),
    meetingDate: "2026-06-24",
    allPublications: [],
    currentPublications: [],
    ...overrides,
  };
}

function main(): void {
  console.log("Phase 9F.3 binder readiness validation\n");

  check("default generation excludes optional next_review_date", () => {
    if (BINDER_DEFAULT_GENERATION_SECTIONS.includes("next_review_date")) {
      throw new Error("next_review_date should be optional, not default-requested");
    }
  });

  check("missing mandatory meeting date fails generation contract", () => {
    const sections = assessSectionAvailability("meeting_date", baseContext({ meetingDate: null }));
    expectThrowsSourceUnavailable(() =>
      assertSectionsResolvableForGeneration(
        [
          assessSectionAvailability("cover_page", baseContext({ meetingDate: null })),
          assessSectionAvailability("client_adviser_info", baseContext({ meetingDate: null })),
          sections,
        ],
        null,
      ),
    );
    if (sections.reasonCode !== "REQUIRED_INPUT_MISSING") {
      throw new Error(`expected REQUIRED_INPUT_MISSING, got ${sections.reasonCode}`);
    }
  });

  check("missing optional next_review_date does not fail whole pack", () => {
    const assessed = [
      assessSectionAvailability("cover_page", baseContext()),
      assessSectionAvailability("client_adviser_info", baseContext()),
      assessSectionAvailability("meeting_date", baseContext()),
      assessSectionAvailability(
        "financial_overview",
        baseContext({
          allPublications: [mockPublication({ output_type: "financial_overview" })],
          currentPublications: [mockPublication({ output_type: "financial_overview" })],
        }),
      ),
      assessSectionAvailability("next_review_date", baseContext()),
    ];
    const included = assertSectionsResolvableForGeneration(assessed, "2026-06-24");
    if (!included.some((entry) => entry.sectionId === "financial_overview")) {
      throw new Error("financial overview should be included");
    }
    if (included.some((entry) => entry.sectionId === "next_review_date")) {
      throw new Error("optional next_review_date should be omitted");
    }
  });

  check("missing all planning sections fails with SOURCE_UNAVAILABLE", () => {
    const assessed = BINDER_MANDATORY_SECTIONS.map((sectionId) =>
      assessSectionAvailability(sectionId, baseContext()),
    );
    expectThrowsSourceUnavailable(() =>
      assertSectionsResolvableForGeneration(assessed, "2026-06-24"),
    );
  });

  check("one current published planning source satisfies minimum contract", () => {
    const publication = mockPublication({ output_type: "roadmap_summary" });
    const context = baseContext({
      allPublications: [publication],
      currentPublications: [publication],
    });
    const assessed = [
      ...BINDER_MANDATORY_SECTIONS.map((sectionId) => assessSectionAvailability(sectionId, context)),
      assessSectionAvailability("roadmap", context),
      assessSectionAvailability("my_plan", context),
    ];
    const included = assertSectionsResolvableForGeneration(assessed, "2026-06-24");
    if (!meetsMinimumGenerationContract({
      meetingDate: "2026-06-24",
      includedSectionIds: included.map((entry) => entry.sectionId),
    })) {
      throw new Error("minimum contract should pass");
    }
  });

  check("draft source is unavailable as SOURCE_NOT_CURRENT", () => {
    const draft = mockPublication({
      output_type: "roadmap_summary",
      publication_status: "draft",
    });
    const result = classifyClientPublicationAvailability([draft], ["roadmap_summary"]);
    if (result.reasonCode !== "SOURCE_NOT_CURRENT" || result.available) {
      throw new Error("draft should be SOURCE_NOT_CURRENT");
    }
  });

  check("withdrawn source is unavailable as SOURCE_NOT_CURRENT", () => {
    const withdrawn = mockPublication({
      output_type: "roadmap_summary",
      publication_status: "withdrawn",
      withdrawn_at: "2026-06-20T00:00:00.000Z",
    });
    const result = classifyClientPublicationAvailability([withdrawn], ["roadmap_summary"]);
    if (result.reasonCode !== "SOURCE_NOT_CURRENT") {
      throw new Error(`expected SOURCE_NOT_CURRENT, got ${result.reasonCode}`);
    }
  });

  check("superseded source is unavailable as SOURCE_NOT_CURRENT", () => {
    const superseded = mockPublication({
      output_type: "client_plan_summary",
      publication_status: "superseded",
      superseded_at: "2026-06-20T00:00:00.000Z",
    });
    const result = classifyClientPublicationAvailability([superseded], ["client_plan_summary"]);
    if (result.reasonCode !== "SOURCE_NOT_CURRENT") {
      throw new Error(`expected SOURCE_NOT_CURRENT, got ${result.reasonCode}`);
    }
  });

  check("adviser-internal source is unavailable as SOURCE_NOT_CLIENT_VISIBLE", () => {
    const internal = mockPublication({
      output_type: "financial_overview",
      output_audience: "adviser_internal",
    });
    const result = classifyClientPublicationAvailability([internal], ["financial_overview"]);
    if (result.reasonCode !== "SOURCE_NOT_CLIENT_VISIBLE") {
      throw new Error(`expected SOURCE_NOT_CLIENT_VISIBLE, got ${result.reasonCode}`);
    }
  });

  check("current published client-safe source is accepted", () => {
    const current = mockPublication({ output_type: "financial_overview" });
    const result = classifyClientPublicationAvailability([current], ["financial_overview"]);
    if (!result.available || result.reasonCode !== null) {
      throw new Error("current client published source should be available");
    }
  });

  check("readiness and generation share catalog assessor", () => {
    const resolver = read("lib/binder/binderSectionResolvers.ts");
    const readiness = read("lib/binder/binderReadinessService.ts");
    if (!resolver.includes("assessRequestedSections") || !readiness.includes("assessRequestedSections")) {
      throw new Error("readiness and resolver must share assessRequestedSections");
    }
  });

  check("UI uses friendly readiness message not raw error code", () => {
    const ui = read("components/aegis/advisor/AdvisorClientBinderPanel.tsx");
    if (!ui.includes("BINDER_READINESS_USER_MESSAGE")) {
      throw new Error("friendly readiness message constant missing from UI");
    }
    if (ui.includes("BINDER_SOURCE_UNAVAILABLE") && ui.includes("{error}")) {
      throw new Error("UI should not display raw binder error codes as primary message");
    }
    const route = read("app/api/advisor/clients/[clientId]/binder-export/route.ts");
    if (!route.includes("BINDER_READINESS_USER_MESSAGE")) {
      throw new Error("route must map SOURCE_UNAVAILABLE to friendly message");
    }
  });

  check("readiness API returns only safe operational fields", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-export/readiness/route.ts");
    for (const forbidden of ["storage_path", "signedUrl", "payload", "display_name", "full_name"]) {
      if (route.includes(forbidden)) {
        throw new Error(`readiness route must not expose ${forbidden}`);
      }
    }
    if (!route.includes("assessBinderReadiness")) {
      throw new Error("readiness route must use assessBinderReadiness");
    }
  });

  check("prerequisite labels contain no UUIDs or storage paths", () => {
    for (const section of BINDER_PLANNING_SECTIONS) {
      const label = reasonCodeToAdviserPrerequisite(section, "NO_PUBLISHED_SOURCE");
      if (/[0-9a-f]{8}-[0-9a-f]{4}/i.test(label) || label.includes("clients/")) {
        throw new Error(`unsafe prerequisite label: ${label}`);
      }
    }
  });

  check("readiness provides a valid fixed action href", () => {
    const readiness = buildBinderSectionReadiness({
      sectionId: "financial_overview",
      clientId: "client-abc",
      purpose: "meeting_preparation",
      allPublications: [],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (!readiness.action?.href.startsWith("/advisor/clients/client-abc/planning-outputs")) {
      throw new Error("expected fixed planning outputs href");
    }
    if (readiness.action.href.includes("published_outputs")) {
      throw new Error("action must not reference database tables");
    }
  });

  check("no database ID in readiness output", () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const publication = mockPublication({ output_type: "roadmap_summary" });
    const result = {
      purpose: "meeting_preparation" as const,
      ready: false,
      availableSections: ["cover_page"],
      unavailableSections: [{ sectionId: "roadmap", reasonCode: "NO_PUBLISHED_SOURCE" as const }],
      sections: ["financial_overview", "roadmap"].map((sectionId) =>
        buildBinderSectionReadiness({
          sectionId: sectionId as never,
          clientId,
          purpose: "meeting_preparation",
          allPublications: [publication],
          meetingDate: "2026-06-24",
          hasNextReviewDate: false,
        }),
      ),
    };
    assertReadinessResponseSafe(result);
    const serialized = JSON.stringify(result);
    if (serialized.includes('"id"')) {
      throw new Error("readiness must not include publication id fields");
    }
    if (!serialized.includes(clientId)) {
      throw new Error("client id may appear in allowlisted action hrefs");
    }
  });

  check("no arbitrary URL from database content", () => {
    const malicious = mockPublication({
      output_type: "client_plan_summary",
      safe_payload: { summary: "https://evil.example/phish" },
    } as Partial<PublishedOutputRow>);
    const readiness = buildBinderSectionReadiness({
      sectionId: "my_plan",
      clientId: "client-abc",
      purpose: "meeting_preparation",
      allPublications: [malicious],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (readiness.action?.href.includes("evil.example")) {
      throw new Error("readiness must not echo database URL content");
    }
  });

  check("draft source produces Review action", () => {
    const draft = mockPublication({
      output_type: "client_plan_summary",
      publication_status: "draft",
    });
    const readiness = buildBinderSectionReadiness({
      sectionId: "my_plan",
      clientId: "client-abc",
      purpose: "meeting_preparation",
      allPublications: [draft],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (readiness.status !== "draft_available" || readiness.action?.type !== "review") {
      throw new Error("draft should produce review action");
    }
  });

  check("unpublished approved source produces Publish action", () => {
    const reviewed = mockPublication({
      output_type: "roadmap_summary",
      publication_status: "adviser_reviewed",
    });
    const readiness = buildBinderSectionReadiness({
      sectionId: "roadmap",
      clientId: "client-abc",
      purpose: "meeting_preparation",
      allPublications: [reviewed],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (readiness.status !== "not_published" || readiness.action?.type !== "publish") {
      throw new Error("reviewed output should produce publish action");
    }
  });

  check("missing source produces Create action", () => {
    const readiness = buildBinderSectionReadiness({
      sectionId: "roadmap",
      clientId: "client-abc",
      purpose: "meeting_preparation",
      allPublications: [],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (readiness.status !== "not_created" || readiness.action?.type !== "create") {
      throw new Error("missing source should produce create action");
    }
  });

  check("published source is selectable in readiness model", () => {
    const publication = mockPublication({ output_type: "financial_overview" });
    const readiness = buildBinderSectionReadiness({
      sectionId: "financial_overview",
      clientId: "client-abc",
      purpose: "meeting_preparation",
      allPublications: [publication],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (readiness.status !== "available") {
      throw new Error("published source should be available");
    }
  });

  check("meeting summary is not mandatory for meeting_preparation", () => {
    const readiness = buildBinderSectionReadiness({
      sectionId: "meeting_summary",
      clientId: "client-abc",
      purpose: "meeting_preparation",
      allPublications: [],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (readiness.requiredForPurpose) {
      throw new Error("meeting summary must not be required for preparation");
    }
    if (readiness.selectedByDefault) {
      throw new Error("meeting summary must not be selected by default");
    }
  });

  check("optional unavailable section does not block generation", () => {
    const publication = mockPublication({ output_type: "roadmap_summary" });
    const sections = [
      buildBinderSectionReadiness({
        sectionId: "meeting_date",
        clientId: "client-abc",
        purpose: "meeting_preparation",
        allPublications: [publication],
        meetingDate: "2026-06-24",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "roadmap",
        clientId: "client-abc",
        purpose: "meeting_preparation",
        allPublications: [publication],
        meetingDate: "2026-06-24",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "financial_overview",
        clientId: "client-abc",
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-24",
        hasNextReviewDate: false,
      }),
    ];
    const canGenerate = canGenerateWithSelectedSections({
      meetingDate: "2026-06-24",
      sections,
      selectedSectionIds: ["roadmap"],
    });
    if (!canGenerate) {
      throw new Error("unselected unavailable optional section should not block generation");
    }
  });

  check("selected unavailable section blocks generation", () => {
    const sections = [
      buildBinderSectionReadiness({
        sectionId: "roadmap",
        clientId: "client-abc",
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-24",
        hasNextReviewDate: false,
      }),
    ];
    const canGenerate = canGenerateWithSelectedSections({
      meetingDate: "2026-06-24",
      sections,
      selectedSectionIds: ["roadmap"],
    });
    if (canGenerate) {
      throw new Error("selected unavailable section must block generation");
    }
  });

  check("generation succeeds with one selected published planning section", () => {
    const publication = mockPublication({ output_type: "client_plan_summary" });
    const sections = defaultSectionsForPurpose("meeting_preparation").map((sectionId) =>
      buildBinderSectionReadiness({
        sectionId,
        clientId: "client-abc",
        purpose: "meeting_preparation",
        allPublications: [publication],
        meetingDate: "2026-06-24",
        hasNextReviewDate: false,
      }),
    );
    const canGenerate = canGenerateWithSelectedSections({
      meetingDate: "2026-06-24",
      sections,
      selectedSectionIds: ["my_plan"],
    });
    if (!canGenerate) {
      throw new Error("one published planning section should allow generation");
    }
  });

  check("client assignment is required for content preparation API", () => {
    const route = read("app/api/advisor/clients/[clientId]/publications/route.ts");
    if (!route.includes("resolveAccessibleClient")) {
      throw new Error("publications route must resolve accessible client");
    }
    if (!route.includes("canPublishClientOutput")) {
      throw new Error("publications route must check publish entitlement");
    }
  });

  check("output publishing remains explicit", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    if (!planning.includes("window.confirm")) {
      throw new Error("planning outputs publish must require confirmation");
    }
    if (!planning.includes("Review draft")) {
      throw new Error("review step must be explicit");
    }
  });

  check("create draft calls preparation route only", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    if (!planning.includes('method: "POST"') || !planning.includes("/publications")) {
      throw new Error("create draft must POST publications");
    }
    if (!planning.includes("JSON.stringify({ outputType: createType })")) {
      throw new Error("create draft must send outputType only");
    }
  });

  check("ready-for-publication calls publish route not prepare", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    const publishMatches = planning.match(/\/publish/g) ?? [];
    if (publishMatches.length < 1) {
      throw new Error("publish route must be used");
    }
    if (planning.includes("handlePublish") && !planning.includes("/publish")) {
      throw new Error("handlePublish must target publish route");
    }
    if (planning.match(/handlePublish[\s\S]*?\/publications`/)) {
      throw new Error("publish must not call draft preparation route");
    }
  });

  check("published card does not expose create draft", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    if (!planning.includes("createBlocked")) {
      throw new Error("cards must block create when draft/reviewed/published exists");
    }
    if (!planning.includes('phase === "published"')) {
      throw new Error("published phase must be handled separately");
    }
  });

  check("planning output preparation allowlist covers required types", () => {
    const preparation = read("lib/compliance/planningOutputPreparation.ts");
    for (const type of [
      "client_plan_summary",
      "goal_plan_summary",
      "roadmap_summary",
      "financial_readiness_snapshot",
    ]) {
      if (!preparation.includes(`"${type}"`)) {
        throw new Error(`${type} must be in preparation allowlist`);
      }
    }
  });

  check("missing financial source returns safe 422 code", () => {
    const errors = read("lib/compliance/planningOutputErrors.ts");
    const preparation = read("lib/compliance/planningOutputPreparation.ts");
    if (!errors.includes("SOURCE_UNAVAILABLE: \"PLANNING_OUTPUT_SOURCE_UNAVAILABLE\"")) {
      throw new Error("SOURCE_UNAVAILABLE code must be defined");
    }
    if (!preparation.includes("Complete the client's financial profile before creating this output.")) {
      throw new Error("financial prerequisite message missing");
    }
    if (!preparation.includes("422")) {
      throw new Error("missing financial source must use 422");
    }
  });

  check("missing goals source returns safe 422 code", () => {
    const preparation = read("lib/compliance/planningOutputPreparation.ts");
    if (!preparation.includes("Add at least one client goal before preparing agreed priorities.")) {
      throw new Error("goals prerequisite message missing");
    }
  });

  check("missing roadmap actions returns safe 422 code", () => {
    const preparation = read("lib/compliance/planningOutputPreparation.ts");
    if (!preparation.includes("Create roadmap actions before preparing the wealth roadmap.")) {
      throw new Error("roadmap prerequisite message missing");
    }
  });

  check("raw errors do not reach browser from route helper", () => {
    const routeHelper = read("lib/compliance/planningOutputRoute.ts");
    const errors = read("lib/compliance/planningOutputErrors.ts");
    if (!routeHelper.includes("resolvePlanningOutputPublicError")) {
      throw new Error("route helper must sanitize errors");
    }
    if (routeHelper.includes("stack") || routeHelper.includes("Supabase")) {
      throw new Error("route helper must not expose stack or Supabase details");
    }
    if (!errors.includes("PREPARATION_FAILED")) {
      throw new Error("generic failures must map to PREPARATION_FAILED");
    }
  });

  check("planning output routes use structured error envelope", () => {
    for (const path of [
      "app/api/advisor/clients/[clientId]/publications/route.ts",
      "app/api/advisor/clients/[clientId]/publications/[outputId]/review/route.ts",
      "app/api/advisor/clients/[clientId]/publications/[outputId]/publish/route.ts",
    ]) {
      const route = read(path);
      if (!route.includes("planningOutputErrorResponse")) {
        throw new Error(`${path} must use planningOutputErrorResponse`);
      }
    }
    const routeHelper = read("lib/compliance/planningOutputRoute.ts");
    if (!routeHelper.includes("logError")) {
      throw new Error("planningOutputErrorResponse must log failure stage");
    }
  });

  check("card-specific error rendering and scoped loading", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    for (const token of ["cardFeedback", "activeAction", "clearCardFeedback", "parseApiJson"]) {
      if (!planning.includes(token)) {
        throw new Error(`planning outputs missing ${token}`);
      }
    }
    if (planning.includes('setError("Failed to prepare output")')) {
      throw new Error("page-level generic prepare error must be removed");
    }
  });

  check("planning outputs page contrast uses light foreground tokens", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    for (const token of ["text-[#F3F1EA]", "text-[#F3F1EA]/70", "border-[#D1A866]/35"]) {
      if (!planning.includes(token)) {
        throw new Error(`planning outputs missing contrast token ${token}`);
      }
    }
    if (planning.includes("text-[#10283A] sm:text-2xl")) {
      throw new Error("page title must not use dark navy on shell background");
    }
  });

  check("planning outputs mobile layout remains readable", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    for (const token of ["flex-col", "sm:flex-row", "lg:flex-row", "flex-wrap"]) {
      if (!planning.includes(token)) {
        throw new Error(`responsive layout token missing: ${token}`);
      }
    }
  });

  check("successful mutation triggers reload", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    if (!planning.includes("requestReload")) {
      throw new Error("mutations must refresh output list");
    }
  });

  check("publish uses type-specific payload sanitizer", () => {
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    if (!workflow.includes("buildPublishedSafePayload")) {
      throw new Error("publish must use buildPublishedSafePayload");
    }
    if (!workflow.includes("sanitizeClientPlanSummary({")) {
      throw new Error("plan summaries must use sanitizeClientPlanSummary on publish");
    }
    const publishBlock = workflow.slice(
      workflow.indexOf("function buildPublishedSafePayload"),
      workflow.indexOf("export async function publishOutput"),
    );
    if (publishBlock.includes("sanitizeFinancialReadinessPayload({") === false) {
      throw new Error("financial outputs must still sanitize on publish");
    }
    if (
      workflow.includes(
        "const mergedPayload = sanitizeFinancialReadinessPayload({",
      )
    ) {
      throw new Error("publish must not always use financial readiness sanitizer");
    }
  });

  check("publish route uses publish operation and output lookup", () => {
    const route = read("app/api/advisor/clients/[clientId]/publications/[outputId]/publish/route.ts");
    for (const token of [
      'operation: "publish"',
      "loadPublishedOutputById",
      "lifecycleStatus",
      "outputId",
      "preparePlanningOutputFromSources",
    ]) {
      if (token === "preparePlanningOutputFromSources" && route.includes(token)) {
        throw new Error("publish route must not call preparation");
      }
      if (token !== "preparePlanningOutputFromSources" && !route.includes(token)) {
        throw new Error(`publish route missing ${token}`);
      }
    }
  });

  check("publish failures map to publish error codes", () => {
    const errors = read("lib/compliance/planningOutputErrors.ts");
    for (const code of [
      "PLANNING_OUTPUT_PUBLISH_FAILED",
      "PLANNING_OUTPUT_NOT_FOUND",
      "PLANNING_OUTPUT_ALREADY_PUBLISHED",
      "PLANNING_OUTPUT_VERSION_CONFLICT",
    ]) {
      if (!errors.includes(code)) {
        throw new Error(`missing publish error code ${code}`);
      }
    }
    if (!errors.includes('operation === "publish"')) {
      throw new Error("error resolver must be operation-aware for publish");
    }
  });

  check("list and publish share adviser_reviewed lifecycle", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    const workflow = read("lib/compliance/publicationWorkflow.ts");
    if (!planning.includes('"adviser_reviewed"')) {
      throw new Error("UI must treat adviser_reviewed as ready for publication");
    }
    if (!workflow.includes('existing.publication_status !== "adviser_reviewed"')) {
      throw new Error("publish must require adviser_reviewed");
    }
  });

  check("publish route error helper logs operation and output id", () => {
    const routeHelper = read("lib/compliance/planningOutputRoute.ts");
    for (const token of ["operation", "outputId", "lifecycleStatus"]) {
      if (!routeHelper.includes(token)) {
        throw new Error(`planning output route helper missing ${token}`);
      }
    }
  });

  check("screenshot state with three published planning sections is eligible", () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const sections = [
      buildBinderSectionReadiness({
        sectionId: "cover_page",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "client_adviser_info",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "meeting_date",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "financial_overview",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [mockPublication({ output_type: "financial_overview" })],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "my_plan",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [mockPublication({ output_type: "client_plan_summary" })],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "agreed_priorities",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [mockPublication({ output_type: "goal_plan_summary" })],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "document_index",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "roadmap",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "meeting_summary",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
    ];

    const selected = [
      "financial_overview",
      "my_plan",
      "agreed_priorities",
      "document_index",
    ];
    const eligibility = evaluateBinderGenerationEligibility({
      purpose: "meeting_preparation",
      meetingDate: "2026-06-23",
      selectedSectionIds: selected,
      sectionReadiness: sections,
    });
    if (!eligibility.eligible) {
      throw new Error(`expected eligible screenshot state, got ${JSON.stringify(eligibility.blockingReasons)}`);
    }
    if (eligibility.contentSectionCount !== 4) {
      throw new Error(`expected 4 content sections, got ${eligibility.contentSectionCount}`);
    }
    if (!canGenerateWithSelectedSections({
      meetingDate: "2026-06-23",
      sections,
      selectedSectionIds: selected,
    })) {
      throw new Error("legacy helper should agree with evaluator");
    }
  });

  check("optional unavailable roadmap does not block when unselected", () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const sections = [
      buildBinderSectionReadiness({
        sectionId: "meeting_date",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "financial_overview",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [mockPublication({ output_type: "financial_overview" })],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "roadmap",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
    ];
    const eligibility = evaluateBinderGenerationEligibility({
      purpose: "meeting_preparation",
      meetingDate: "2026-06-23",
      selectedSectionIds: ["financial_overview"],
      sectionReadiness: sections,
    });
    if (!eligibility.eligible) {
      throw new Error("unselected unavailable roadmap must not block");
    }
  });

  check("selected unavailable roadmap blocks generation", () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const sections = [
      buildBinderSectionReadiness({
        sectionId: "meeting_date",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "financial_overview",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [mockPublication({ output_type: "financial_overview" })],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
      buildBinderSectionReadiness({
        sectionId: "roadmap",
        clientId,
        purpose: "meeting_preparation",
        allPublications: [],
        meetingDate: "2026-06-23",
        hasNextReviewDate: false,
      }),
    ];
    const eligibility = evaluateBinderGenerationEligibility({
      purpose: "meeting_preparation",
      meetingDate: "2026-06-23",
      selectedSectionIds: ["financial_overview", "roadmap"],
      sectionReadiness: sections,
    });
    if (eligibility.eligible) {
      throw new Error("selected unavailable roadmap must block");
    }
  });

  check("binder panel uses shared eligibility evaluator", () => {
    const ui = read("components/aegis/advisor/AdvisorClientBinderPanel.tsx");
    if (!ui.includes("evaluateBinderGenerationEligibility")) {
      throw new Error("binder panel must use shared eligibility evaluator");
    }
    if (ui.includes("!canGenerate && !readiness.ready")) {
      throw new Error("banner must not use contradictory readiness flags");
    }
  });

  check("roadmap editor route and planning card link exist", () => {
    const page = read("app/advisor/clients/[clientId]/roadmap/page.tsx");
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    const route = read("app/api/advisor/clients/[clientId]/roadmap-actions/route.ts");
    if (!page.includes("AdvisorClientRoadmapEditor")) {
      throw new Error("roadmap editor page missing");
    }
    if (!planning.includes("Add roadmap actions")) {
      throw new Error("planning outputs must link to roadmap editor");
    }
    if (!route.includes("resolveAccessibleClient")) {
      throw new Error("roadmap actions route must enforce client access");
    }
    if (!route.includes("rejectClientIdInBody")) {
      throw new Error("roadmap actions route must reject clientId in body");
    }
  });

  check("wealth roadmap is not selected by default", () => {
    const purpose = read("lib/binder/binderPackPurpose.ts");
    if (!purpose.includes('sectionId === "roadmap") return false')) {
      throw new Error("roadmap must not be selected by default");
    }
  });

  check("generation route validates shared eligibility", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-export/route.ts");
    if (!route.includes("evaluateBinderGenerationEligibility")) {
      throw new Error("generation route must validate eligibility");
    }
    if (!route.includes("parseBinderGenerationSections")) {
      throw new Error("generation route must use shared section parser");
    }
  });

  check("five content sections with duplicate metadata normalize to valid generation list", () => {
    const raw = [
      "cover_page",
      "client_adviser_info",
      "meeting_date",
      "financial_overview",
      "my_plan",
      "agreed_priorities",
      "document_index",
      "roadmap",
    ];
    const sections = buildGenerationSectionList(raw);
    if (sections.length !== 8) {
      throw new Error(`expected 8 canonical sections, got ${sections.length}: ${sections.join(",")}`);
    }
    if (sections.filter((section) => section === "cover_page").length !== 1) {
      throw new Error("duplicate cover_page must dedupe");
    }
    if (!sections.includes("roadmap")) {
      throw new Error("roadmap must remain canonical");
    }
  });

  check("roadmap aliases normalize to canonical roadmap section", () => {
    const result = normalizeBinderSectionIds([
      "wealth_roadmap",
      "roadmap_summary",
      "roadmap",
    ]);
    if (result.rejected.length > 0) {
      throw new Error("known aliases must not be rejected");
    }
    if (result.canonical.length !== 1 || result.canonical[0] !== "roadmap") {
      throw new Error("aliases must dedupe to roadmap");
    }
  });

  check("section parser rejects unknown binder ids", () => {
    const result = normalizeBinderSectionIds([
      "financial_overview",
      "not_a_real_section",
    ]);
    if (result.rejected.length !== 1 || result.rejected[0] !== "not_a_real_section") {
      throw new Error("unknown section must be rejected");
    }
  });

  check("binder panel submits deduped generation section list", () => {
    const ui = read("components/aegis/advisor/AdvisorClientBinderPanel.tsx");
    if (!ui.includes("buildGenerationSectionList(selectedSections)")) {
      throw new Error("binder panel must build canonical generation sections");
    }
    if (ui.includes('"cover_page",\n            "client_adviser_info"')) {
      throw new Error("binder panel must not manually duplicate auto-included sections");
    }
  });

  check("roadmap binder section maps to roadmap_summary output type", () => {
    const catalog = read("lib/binder/binderSectionCatalog.ts");
    const registry = read("lib/binder/binderSectionRegistry.ts");
    if (!registry.includes('roadmap: ["roadmap_summary"]')) {
      throw new Error("registry must map roadmap to roadmap_summary");
    }
    if (!catalog.includes("BINDER_SECTION_OUTPUT_TYPES")) {
      throw new Error("catalog must use shared output-type mapping");
    }
  });

  check("documented test flow avoids direct Supabase editing", () => {
    const doc = read("docs/PHASE_9F3_CREATE_TEST_PLANNING_OUTPUT.md");
    if (doc.includes("published_outputs") && doc.includes("INSERT")) {
      throw new Error("test doc must not require SQL inserts");
    }
    if (!doc.includes("Planning outputs")) {
      throw new Error("test doc must describe planning outputs UI");
    }
  });

  check("return navigation restores Meeting Packs tab", () => {
    const planning = read("components/aegis/advisor/AdvisorPlanningOutputsClient.tsx");
    const workspace = read("components/aegis/advisor/AdvisorClientWorkspace.tsx");
    const page = read("app/advisor/clients/[clientId]/page.tsx");
    if (!planning.includes("returnTab")) {
      throw new Error("planning outputs must link back with returnTab");
    }
    if (!workspace.includes("parseWorkspaceTab")) {
      throw new Error("workspace must parse tab from URL");
    }
    if (!page.includes("returnTab")) {
      throw new Error("client page must honour returnTab");
    }
  });

  check("binder panel exposes grouped readiness messaging", () => {
    const ui = read("components/aegis/advisor/AdvisorClientBinderPanel.tsx");
    for (const label of [
      "Required before generation",
      "Optional additions",
      "Created after the meeting",
      "Refresh readiness",
      "Generate pack with",
    ]) {
      if (!ui.includes(label)) {
        throw new Error(`binder panel missing ${label}`);
      }
    }
  });

  check("planning outputs shared route exists", () => {
    const page = read("app/advisor/clients/[clientId]/planning-outputs/page.tsx");
    if (!page.includes("AdvisorPlanningOutputsClient")) {
      throw new Error("planning outputs page missing");
    }
  });

  check("readiness query parser accepts UI parameter names", () => {
    const params = new URLSearchParams({
      meetingDate: "2026-06-23",
      purpose: "meeting_preparation",
      selectedSections: "roadmap,financial_overview",
    });
    const parsed = parseBinderReadinessQuery(params);
    if (!parsed.ok || parsed.query.meetingDate !== "2026-06-23") {
      throw new Error("meetingDate parse failed");
    }
    if (parsed.query.purpose !== "meeting_preparation") {
      throw new Error("purpose parse failed");
    }
    if (parsed.query.selectedSectionIds?.length !== 2) {
      throw new Error("selectedSections parse failed");
    }
  });

  check("invalid meeting date returns parser failure", () => {
    const parsed = parseBinderReadinessQuery(new URLSearchParams({ meetingDate: "2026-13-40" }));
    if (parsed.ok) {
      throw new Error("invalid meeting date should fail");
    }
  });

  check("zero-output readiness sections do not require publication ids", () => {
    const readiness = buildBinderSectionReadiness({
      sectionId: "financial_overview",
      clientId: "11111111-1111-4111-8111-111111111111",
      purpose: "meeting_preparation",
      allPublications: [],
      meetingDate: "2026-06-24",
      hasNextReviewDate: false,
    });
    if (readiness.status !== "not_created" || !readiness.action) {
      throw new Error("missing source should be actionable without throwing");
    }
    assertReadinessResponseSafe({ sections: [readiness], ready: false });
  });

  check("readiness route uses structured error envelope", () => {
    const route = read("app/api/advisor/clients/[clientId]/binder-export/readiness/route.ts");
    if (!route.includes("READINESS_FAILED")) {
      throw new Error("route must expose readiness failure code");
    }
    if (!route.includes("parseBinderReadinessQuery")) {
      throw new Error("route must validate query via shared parser");
    }
    if (!route.includes('isFeatureEnabled("binder_export")')) {
      throw new Error("route must gate on binder_export only");
    }
    if (route.includes("binder_client_publication")) {
      throw new Error("readiness must not require binder_client_publication");
    }
    if (!route.includes("logError")) {
      throw new Error("route must log private failure stage");
    }
  });

  check("binder panel matches readiness query parameters", () => {
    const ui = read("components/aegis/advisor/AdvisorClientBinderPanel.tsx");
    if (!ui.includes('meetingDate: date') || !ui.includes("purpose")) {
      throw new Error("UI must send meetingDate and purpose");
    }
    if (!ui.includes("parseReadinessResponse")) {
      throw new Error("UI must guard JSON parsing");
    }
    if (!ui.includes("Retry readiness check")) {
      throw new Error("UI must expose readiness retry");
    }
  });

  check("readiness safety rejects publication id fields", () => {
    expectThrows(() =>
      assertReadinessResponseSafe({
        sections: [{ sectionId: "roadmap", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
      }),
    );
  });

  if (process.exitCode === 1) {
    console.error("\nBinder readiness validation failed");
    process.exit(1);
  }
  console.log("\nAll binder readiness validation tests passed");
}

function expectThrowsSourceUnavailable(fn: () => void): void {
  try {
    fn();
    throw new Error("expected SOURCE_UNAVAILABLE throw");
  } catch (err) {
    if (!(err instanceof Error) || err.message !== BINDER_SOURCE_UNAVAILABLE_CODE) {
      throw err;
    }
  }
}

function expectThrows(fn: () => void): void {
  try {
    fn();
    throw new Error("expected throw");
  } catch (err) {
    if (err instanceof Error && err.message === "expected throw") {
      throw err;
    }
  }
}

main();
