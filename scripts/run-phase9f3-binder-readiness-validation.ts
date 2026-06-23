/**
 * Phase 9F.3 binder readiness validation — section policy and catalog checks.
 * Run: npx tsx scripts/run-phase9f3-binder-readiness-validation.ts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { classifyClientPublicationAvailability } from "../lib/binder/binderPublicationAvailability";
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

main();
